#!/usr/bin/env python3
"""GFTV PolicyBot — Telegram bot for the GFTV PolicySpot."""

import asyncio
import html
import logging
from pathlib import Path

import rich_api
import supabase_client
from config import CACHE_TTL, TELEGRAM_API_HASH, TELEGRAM_API_ID, TELEGRAM_BOT_TOKEN
from database import (
    cache_get,
    cache_set,
    cache_purge_expired,
    get_search,
    init_db,
    save_search,
)
from telethon import TelegramClient, events
from telethon.tl.custom import Button
from utils import (
    CATEGORIES,
    PAGE_SIZE,
    find_search_hit_page,
    format_article_markdown,
    format_article_pages,
    has_lang_subsections,
    kb_article,
    kb_articles,
    kb_cancel_home,
    kb_categories,
    kb_home,
    kb_search_results,
    match_query,
)

logging.basicConfig(
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("policybot")

_sessions = Path(__file__).parent / "sessions"
_sessions.mkdir(exist_ok=True)

client = TelegramClient(str(_sessions / "policybot"), TELEGRAM_API_ID, TELEGRAM_API_HASH)


# ── Supabase helpers (sync calls wrapped in asyncio.to_thread) ────────────────

async def _fetch_articles(cat_code: str, sort: str) -> list:
    key = f"articles:{cat_code}:{sort}"
    if (hit := cache_get(key)) is not None:
        return hit

    cat = CATEGORIES[cat_code]
    rows = await asyncio.to_thread(
        lambda: supabase_client.client
        .table(cat["table"])
        .select("*")
        .eq("is_published", True)
        .is_("parent_id", "null")
        .execute()
        .data
    )
    articles: list = rows or []

    if sort == "v":
        counts = await _fetch_view_counts()
        for art in articles:
            art["_views"] = counts.get(art["id"], 0)
        articles.sort(key=lambda x: x["_views"], reverse=True)
    else:
        articles.sort(key=lambda x: x.get("order_index", 0))

    cache_set(key, articles, ttl=CACHE_TTL)
    return articles


async def _fetch_view_counts() -> dict:
    key = "view_counts:all"
    if (hit := cache_get(key)) is not None:
        return hit

    rows = await asyncio.to_thread(
        lambda: supabase_client.client
        .table("gftvpolicy_pagevisits")
        .select("section_id")
        .execute()
        .data
    )
    counts: dict = {}
    for row in rows or []:
        sid = row["section_id"]
        counts[sid] = counts.get(sid, 0) + 1

    cache_set(key, counts, ttl=CACHE_TTL)
    return counts


async def _fetch_article(cat_code: str, slug: str) -> tuple:
    key = f"article:{cat_code}:{slug}"
    if (hit := cache_get(key)) is not None:
        return hit[0], hit[1]

    cat = CATEGORIES[cat_code]
    art_rows = await asyncio.to_thread(
        lambda: supabase_client.client
        .table(cat["table"])
        .select("*")
        .eq("slug", slug)
        .eq("is_published", True)
        .execute()
        .data
    )
    if not art_rows:
        return None, []

    article = art_rows[0]
    sub_rows = await asyncio.to_thread(
        lambda: supabase_client.client
        .table(cat["table"])
        .select("*")
        .eq("parent_id", article["id"])
        .eq("is_published", True)
        .order("order_index")
        .execute()
        .data
    )
    subsections: list = sub_rows or []
    cache_set(key, [article, subsections], ttl=CACHE_TTL)
    return article, subsections


async def _track_views(section_ids: list, doc: str, slug: str) -> None:
    for sid in section_ids:
        try:
            await asyncio.to_thread(
                lambda s=sid: supabase_client.client
                .table("gftvpolicy_pagevisits")
                .insert({"section_id": s, "doc": doc, "slug": slug, "device_type": "Others"})
                .execute()
            )
        except Exception as exc:
            logger.warning("track_view failed sid=%s: %s", sid, exc)


async def _search_all(query: str) -> list:
    """Search titles and full body content of every published section.

    Matching is done on Markdown-normalised text (see utils.plain_text), so
    a query like "defined under Section 28" still hits content stored as
    "defined under **Section 28**" or split across lines. Exact-phrase hits
    are listed before all-words hits."""
    results: list = []
    for cat_code, cat in CATEGORIES.items():
        try:
            rows = await asyncio.to_thread(
                lambda t=cat["table"]: supabase_client.client
                .table(t)
                .select("id,slug,title,content,type,parent_id")
                .eq("is_published", True)
                .execute()
                .data
            )
            all_items = rows or []
            id_to_slug = {r["id"]: r["slug"] for r in all_items}
            for item in all_items:
                score = match_query(query, item.get("title") or "", item.get("content") or "")
                if score:
                    pid = item.get("parent_id")
                    results.append({
                        "cat_code":    cat_code,
                        "cat_name":    cat["name"],
                        "cat_emoji":   cat["emoji"],
                        "id":          item["id"],
                        "slug":        item["slug"],
                        "title":       item["title"],
                        "parent_id":   pid,
                        "parent_slug": id_to_slug.get(pid) if pid else None,
                        "_score":      score,
                    })
        except Exception as exc:
            logger.error("search error table=%s: %s", cat["table"], exc)
    # Stable sort: phrase matches first, otherwise keep category/DB order.
    results.sort(key=lambda r: -r["_score"])
    return results


# ── Message text builders ─────────────────────────────────────────────────────

def _txt_home() -> str:
    return (
        "<b>📋 GFTV PolicyBot</b>\n\n"
        "Browse GFTV's policies, guidelines, and standards.\n\n"
        "Choose an option below to get started."
    )


def _txt_help() -> str:
    return (
        "<b>❓ Help</b>\n\n"
        "<b>Commands</b>\n"
        "/start — Open the main menu\n"
        "/browse — Browse policy categories\n"
        "/search <i>query</i> — Search all policies\n"
        "/help — Show this message\n\n"
        "<b>Navigation</b>\n"
        "Use the inline buttons to browse categories and articles. "
        "Long articles are split across pages; use ◀ / ▶ to navigate.\n\n"
        "<b>Sorting</b>\n"
        "In any article list tap <b>↕ Sort: Views</b> or <b>↕ Sort: Order</b> to toggle.\n\n"
        "<b>Search</b>\n"
        "Just send me any message and I'll search all policies for it. "
        "You can also use <code>/search query</code>. "
        "Tapping a result opens the article on the page where your search text appears."
    )


def _txt_categories() -> str:
    return "<b>📚 Policy Categories</b>\n\nSelect a category to browse:"


def _txt_articles(cat_code: str, page: int, total_pages: int, sort: str) -> str:
    cat = CATEGORIES[cat_code]
    sort_label = "sorted by views" if sort == "v" else "sorted by order"
    return (
        f"{cat['emoji']} <b>{html.escape(cat['name'])}</b>\n"
        f"<i>Page {page} / {total_pages} · {sort_label}</i>"
    )


def _txt_search_prompt() -> str:
    return (
        "🔍 <b>Search Policies</b>\n\n"
        "Just send your search query as a message — any text you send me is searched.\n"
        "Or type: <code>/search your query</code>"
    )


def _txt_search_results(query: str, results: list, page: int, total_pages: int) -> str:
    if not results:
        return f"🔍 <b>Search: {html.escape(query)}</b>\n\n<i>No results found.</i>"
    lines = [
        f"🔍 <b>Search: {html.escape(query)}</b>",
        f"<i>{len(results)} result(s) — Page {page} / {total_pages}</i>",
        "",
    ]
    start = (page - 1) * PAGE_SIZE
    for r in results[start : start + PAGE_SIZE]:
        prefix = "  ↳ " if r.get("parent_id") else ""
        lines.append(f"{prefix}{r['cat_emoji']} <b>{html.escape(r['title'])}</b>")
        lines.append(f"   <i>{r['cat_name']}</i>")
    return "\n".join(lines)


# ── Navigation helpers ────────────────────────────────────────────────────────

async def _show_articles(event, cat_code: str, page: int, sort: str) -> None:
    articles = await _fetch_articles(cat_code, sort)
    total_pages = max(1, (len(articles) + PAGE_SIZE - 1) // PAGE_SIZE)
    page = max(1, min(page, total_pages))
    page_items = articles[(page - 1) * PAGE_SIZE : page * PAGE_SIZE]
    await event.edit(
        _txt_articles(cat_code, page, total_pages, sort),
        buttons=kb_articles(cat_code, page_items, page, total_pages, sort),
        parse_mode="html",
    )


async def _show_article(event, cat_code: str, slug: str, page: int, lang: str = "all") -> None:
    article, subsections = await _fetch_article(cat_code, slug)
    if article is None:
        await event.answer("Article not found.", alert=True)
        return

    _has_lang = has_lang_subsections(subsections)
    md_pages = format_article_markdown(article, subsections, lang)
    total = len(md_pages)
    page = max(0, min(page, total - 1))
    buttons = kb_article(cat_code, slug, page, total, has_lang=_has_lang, lang=lang)

    # Rich Messages (Bot API 10.1+) render the article's own Markdown
    # directly — tables/headings/images included inline, no HTML conversion
    # or separate image attachments needed. Telethon can't send these
    # itself, so this goes straight to the HTTP Bot API. Telethon has no
    # track record yet with this brand-new endpoint, so fall back to the
    # proven HTML path on any failure rather than leaving the user stuck.
    try:
        await rich_api.edit_rich_article(event.chat_id, event.message_id, md_pages[page], buttons)
    except Exception as exc:
        logger.warning("Rich message edit failed for %s/%s, falling back to HTML: %s", cat_code, slug, exc)
        html_pages, image_urls = format_article_pages(article, subsections, lang)
        html_page = min(page, len(html_pages) - 1)
        await event.edit(html_pages[html_page], buttons=buttons, parse_mode="html")
        if page == 0:
            for img_url in image_urls[:3]:
                try:
                    await client.send_file(event.sender_id, img_url)
                except Exception as img_exc:
                    logger.warning("Failed to send image %s: %s", img_url, img_exc)

    if page == 0:
        all_ids = [article["id"]] + [s["id"] for s in subsections]
        asyncio.create_task(_track_views(all_ids, CATEGORIES[cat_code]["doc"], slug))


async def _show_search_hit(event, hit: dict, query: str) -> None:
    """Open the article for a search hit on the paginated page where the
    query text appears (or, for a subsection hit, at least on the page
    holding that subsection's heading)."""
    cat_code = hit["cat_code"]
    is_sub = bool(hit.get("parent_id") and hit.get("parent_slug"))
    slug = hit["parent_slug"] if is_sub else hit["slug"]

    article, subsections = await _fetch_article(cat_code, slug)
    if article is None:
        await event.answer("Article not found.", alert=True)
        return
    md_pages = format_article_markdown(article, subsections, "all")
    page = find_search_hit_page(
        md_pages, subsections, query, sub_id=hit["id"] if is_sub else None, lang="all",
    )
    await _show_article(event, cat_code, slug, page, "all")


async def _run_search(event, query: str, is_new: bool) -> None:
    if not query:
        await (event.respond if is_new else event.edit)(
            "Please provide a search term.",
            parse_mode="html",
        )
        return
    results = await _search_all(query)
    save_search(event.sender_id, query, results)
    total_pages = max(1, (len(results) + PAGE_SIZE - 1) // PAGE_SIZE)
    text = _txt_search_results(query, results, 1, total_pages)
    btns = kb_search_results(results, 1, total_pages)
    if is_new:
        await event.respond(text, buttons=btns, parse_mode="html")
    else:
        await event.edit(text, buttons=btns, parse_mode="html")


# ── Event handlers ────────────────────────────────────────────────────────────

@client.on(events.NewMessage(func=lambda e: e.is_private))
async def on_message(event: events.NewMessage.Event) -> None:
    text: str = event.raw_text or ""

    # Any non-command text is treated as a search query — no need to tap
    # 🔍 Search or use /search first. Stickers/media with no caption are ignored.
    if not text.startswith("/"):
        query = text.strip()
        if query:
            await _run_search(event, query, is_new=True)
        return

    cmd = text.split()[0].lstrip("/").split("@")[0].lower()

    if cmd == "start":
        await event.respond(_txt_home(), buttons=kb_home(), parse_mode="html")

    elif cmd == "help":
        await event.respond(
            _txt_help(),
            buttons=[[Button.inline("🏠 Home", b"HOME")]],
            parse_mode="html",
        )

    elif cmd == "browse":
        await event.respond(_txt_categories(), buttons=kb_categories(), parse_mode="html")

    elif cmd == "search":
        parts = text.split(maxsplit=1)
        if len(parts) < 2 or not parts[1].strip():
            await event.respond(
                "🔍 <b>Search</b>\n\nUsage: <code>/search your query here</code>",
                buttons=[[Button.inline("🏠 Home", b"HOME")]],
                parse_mode="html",
            )
            return
        await _run_search(event, parts[1].strip(), is_new=True)


@client.on(events.CallbackQuery())
async def on_callback(event: events.CallbackQuery.Event) -> None:
    if not event.is_private:
        await event.answer("This bot only works in DMs.", alert=True)
        return

    data = event.data.decode("utf-8", errors="replace")
    uid  = event.sender_id

    try:
        if data == "HOME":
            await event.edit(_txt_home(), buttons=kb_home(), parse_mode="html")

        elif data == "CAT":
            await event.edit(_txt_categories(), buttons=kb_categories(), parse_mode="html")

        elif data == "HELP":
            await event.edit(
                _txt_help(),
                buttons=[[Button.inline("🏠 Home", b"HOME")]],
                parse_mode="html",
            )

        elif data == "SEARCH":
            await event.edit(_txt_search_prompt(), buttons=kb_cancel_home(), parse_mode="html")

        elif data == "NOOP":
            await event.answer()

        elif data.startswith("C|"):
            _, cat_code, page_s, sort = data.split("|")
            await _show_articles(event, cat_code, int(page_s), sort)

        elif data.startswith("A|"):
            # Format: A|cat|slug|page|lang  (lang defaults to "all" if absent)
            parts = data.split("|", 4)
            _, cat_code, slug, page_s = parts[:4]
            lang = parts[4] if len(parts) > 4 else "all"
            await _show_article(event, cat_code, slug, int(page_s), lang)

        elif data.startswith("AS|"):
            # Search hit: open its article on the page where the query text
            # appears. Resolved from the saved search.
            idx = int(data.split("|")[1])
            query, results = get_search(uid)
            if not query or idx >= len(results):
                await event.answer("Search expired — please search again.", alert=True)
                return
            await _show_search_hit(event, results[idx], query)

        elif data.startswith("SR|"):
            page = int(data.split("|")[1])
            query, results = get_search(uid)
            if not query:
                await event.answer("Search expired — please search again.", alert=True)
                return
            total_pages = max(1, (len(results) + PAGE_SIZE - 1) // PAGE_SIZE)
            await event.edit(
                _txt_search_results(query, results, page, total_pages),
                buttons=kb_search_results(results, page, total_pages),
                parse_mode="html",
            )

        else:
            await event.answer()

    except Exception as exc:
        logger.exception("callback error data=%r uid=%s: %s", data, uid, exc)
        try:
            await event.answer("Something went wrong. Please try again.", alert=True)
        except Exception:
            pass


# ── Periodic maintenance ──────────────────────────────────────────────────────

async def _maintenance_loop() -> None:
    """Purge expired cache rows from SQLite once per hour."""
    while True:
        await asyncio.sleep(3600)
        try:
            cache_purge_expired()
            logger.debug("Cache purge complete.")
        except Exception as exc:
            logger.warning("Cache purge failed: %s", exc)


# ── Entry point ───────────────────────────────────────────────────────────────

async def main() -> None:
    init_db()
    await client.start(bot_token=TELEGRAM_BOT_TOKEN)
    me = await client.get_me()
    logger.info("Started as @%s (id=%s)", me.username, me.id)
    asyncio.create_task(_maintenance_loop())
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
