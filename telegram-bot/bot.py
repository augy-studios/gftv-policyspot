#!/usr/bin/env python3
"""GFTV PolicyBot — Telegram bot for the GFTV PolicySpot."""

import asyncio
import html
import logging
from pathlib import Path

import rich_api
import supabase_client
from config import CACHE_TIME_TO_LIVE_SECONDS, TELEGRAM_API_HASH, TELEGRAM_API_ID, TELEGRAM_BOT_TOKEN
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
    SORT_BY_VIEWS,
    build_article_keyboard,
    build_articles_keyboard,
    build_cancel_home_keyboard,
    build_categories_keyboard,
    build_home_keyboard,
    build_search_results_keyboard,
    find_search_hit_page,
    format_article_markdown,
    format_article_pages,
    has_language_subsections,
    match_query,
)

logging.basicConfig(
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("policybot")

_sessions_folder = Path(__file__).parent / "sessions"
_sessions_folder.mkdir(exist_ok=True)

client = TelegramClient(str(_sessions_folder / "policybot"), TELEGRAM_API_ID, TELEGRAM_API_HASH)


# ── Supabase helpers (sync calls wrapped in asyncio.to_thread) ────────────────
#
# The Supabase Python client is synchronous, so each query is written as a
# small inner function and run with asyncio.to_thread(). That keeps the bot
# responsive to other users while the database answers.

def _count_pages(item_count: int) -> int:
    """How many pages of PAGE_SIZE items are needed (always at least 1)."""
    page_count = (item_count + PAGE_SIZE - 1) // PAGE_SIZE
    return max(1, page_count)


async def _fetch_articles(category_code: str, sort: str) -> list:
    """Return the top-level articles of a category, sorted by order or by views."""
    cache_key = f"articles:{category_code}:{sort}"
    cached_articles = cache_get(cache_key)
    if cached_articles is not None:
        return cached_articles

    category = CATEGORIES[category_code]

    def query_top_level_articles():
        return (
            supabase_client.client
            .table(category["table"])
            .select("*")
            .eq("is_published", True)
            .is_("parent_id", "null")
            .execute()
            .data
        )

    rows = await asyncio.to_thread(query_top_level_articles)
    articles: list = rows or []

    if sort == SORT_BY_VIEWS:
        view_counts = await _fetch_view_counts()
        for article in articles:
            article["_views"] = view_counts.get(article["id"], 0)
        articles.sort(key=_get_view_count, reverse=True)
    else:
        articles.sort(key=_get_order_index)

    cache_set(cache_key, articles, time_to_live_seconds=CACHE_TIME_TO_LIVE_SECONDS)
    return articles


def _get_view_count(article: dict) -> int:
    """Sort key: the article's view count."""
    return article["_views"]


def _get_order_index(article: dict) -> int:
    """Sort key: the article's position in the document."""
    return article.get("order_index", 0)


async def _fetch_view_counts() -> dict:
    """Return a dictionary of {section_id: number of recorded visits}."""
    cache_key = "view_counts:all"
    cached_counts = cache_get(cache_key)
    if cached_counts is not None:
        return cached_counts

    def query_page_visits():
        return (
            supabase_client.client
            .table("gftvpolicy_pagevisits")
            .select("section_id")
            .execute()
            .data
        )

    rows = await asyncio.to_thread(query_page_visits)
    view_counts: dict = {}
    for row in rows or []:
        section_id = row["section_id"]
        view_counts[section_id] = view_counts.get(section_id, 0) + 1

    cache_set(cache_key, view_counts, time_to_live_seconds=CACHE_TIME_TO_LIVE_SECONDS)
    return view_counts


async def _fetch_article(category_code: str, slug: str) -> tuple:
    """Return (article, subsections) for a slug, or (None, []) if not found."""
    cache_key = f"article:{category_code}:{slug}"
    cached_article = cache_get(cache_key)
    if cached_article is not None:
        return cached_article[0], cached_article[1]

    category = CATEGORIES[category_code]

    def query_article():
        return (
            supabase_client.client
            .table(category["table"])
            .select("*")
            .eq("slug", slug)
            .eq("is_published", True)
            .execute()
            .data
        )

    article_rows = await asyncio.to_thread(query_article)
    if not article_rows:
        return None, []

    article = article_rows[0]

    def query_subsections():
        return (
            supabase_client.client
            .table(category["table"])
            .select("*")
            .eq("parent_id", article["id"])
            .eq("is_published", True)
            .order("order_index")
            .execute()
            .data
        )

    subsection_rows = await asyncio.to_thread(query_subsections)
    subsections: list = subsection_rows or []
    cache_set(cache_key, [article, subsections], time_to_live_seconds=CACHE_TIME_TO_LIVE_SECONDS)
    return article, subsections


async def _track_views(section_ids: list, document_name: str, slug: str) -> None:
    """Record one page visit for each section id (the article and its subsections)."""
    for section_id in section_ids:
        visit_row = {"section_id": section_id, "doc": document_name, "slug": slug, "device_type": "Others"}

        def insert_visit(row_to_insert=visit_row):
            return (
                supabase_client.client
                .table("gftvpolicy_pagevisits")
                .insert(row_to_insert)
                .execute()
            )

        try:
            await asyncio.to_thread(insert_visit)
        except Exception as error:
            logger.warning("track_view failed section_id=%s: %s", section_id, error)


def _get_match_score(search_result: dict) -> int:
    """Sort key: search results with a higher score come first."""
    return -search_result["_score"]


async def _search_all(query: str) -> list:
    """Search titles and full body content of every published section.

    Matching is done on Markdown-normalised text (see utils.plain_text), so
    a query like "defined under Section 28" still hits content stored as
    "defined under **Section 28**" or split across lines. Exact-phrase hits
    are listed before all-words hits.

    The keys of each result ("cat_code", "cat_emoji", ...) are saved to the
    database with the user's search, so they are kept unchanged."""
    results: list = []
    for category_code, category in CATEGORIES.items():

        def query_all_sections(table_name=category["table"]):
            return (
                supabase_client.client
                .table(table_name)
                .select("id,slug,title,content,type,parent_id")
                .eq("is_published", True)
                .execute()
                .data
            )

        try:
            rows = await asyncio.to_thread(query_all_sections)
            all_sections = rows or []
            # Lets a subsection result find its parent article's slug
            slug_by_id = {}
            for section in all_sections:
                slug_by_id[section["id"]] = section["slug"]
            for section in all_sections:
                score = match_query(query, section.get("title") or "", section.get("content") or "")
                if score:
                    parent_id = section.get("parent_id")
                    parent_slug = None
                    if parent_id:
                        parent_slug = slug_by_id.get(parent_id)
                    results.append({
                        "cat_code":    category_code,
                        "cat_name":    category["name"],
                        "cat_emoji":   category["emoji"],
                        "id":          section["id"],
                        "slug":        section["slug"],
                        "title":       section["title"],
                        "parent_id":   parent_id,
                        "parent_slug": parent_slug,
                        "_score":      score,
                    })
        except Exception as error:
            logger.error("search error table=%s: %s", category["table"], error)
    # Stable sort: phrase matches first, otherwise keep category/DB order.
    results.sort(key=_get_match_score)
    return results


# ── Message text builders ─────────────────────────────────────────────────────

def _build_home_text() -> str:
    return (
        "<b>📋 GFTV PolicyBot</b>\n\n"
        "Browse GFTV's policies, guidelines, and standards.\n\n"
        "Choose an option below to get started."
    )


def _build_help_text() -> str:
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


def _build_categories_text() -> str:
    return "<b>📚 Policy Categories</b>\n\nSelect a category to browse:"


def _build_articles_text(category_code: str, page: int, total_pages: int, sort: str) -> str:
    category = CATEGORIES[category_code]
    sort_label = "sorted by order"
    if sort == SORT_BY_VIEWS:
        sort_label = "sorted by views"
    return (
        f"{category['emoji']} <b>{html.escape(category['name'])}</b>\n"
        f"<i>Page {page} / {total_pages} · {sort_label}</i>"
    )


def _build_search_prompt_text() -> str:
    return (
        "🔍 <b>Search Policies</b>\n\n"
        "Just send your search query as a message — any text you send me is searched.\n"
        "Or type: <code>/search your query</code>"
    )


def _build_search_results_text(query: str, results: list, page: int, total_pages: int) -> str:
    if not results:
        return f"🔍 <b>Search: {html.escape(query)}</b>\n\n<i>No results found.</i>"
    lines = [
        f"🔍 <b>Search: {html.escape(query)}</b>",
        f"<i>{len(results)} result(s) — Page {page} / {total_pages}</i>",
        "",
    ]
    first_result_index = (page - 1) * PAGE_SIZE
    for result in results[first_result_index : first_result_index + PAGE_SIZE]:
        # Subsections are indented under an arrow
        prefix = ""
        if result.get("parent_id"):
            prefix = "  ↳ "
        lines.append(f"{prefix}{result['cat_emoji']} <b>{html.escape(result['title'])}</b>")
        lines.append(f"   <i>{result['cat_name']}</i>")
    return "\n".join(lines)


# ── Navigation helpers ────────────────────────────────────────────────────────

async def _show_articles(event, category_code: str, page: int, sort: str) -> None:
    """Edit the message to show one page of a category's article list."""
    articles = await _fetch_articles(category_code, sort)
    total_pages = _count_pages(len(articles))
    page = max(1, min(page, total_pages))
    page_items = articles[(page - 1) * PAGE_SIZE : page * PAGE_SIZE]
    await event.edit(
        _build_articles_text(category_code, page, total_pages, sort),
        buttons=build_articles_keyboard(category_code, page_items, page, total_pages, sort),
        parse_mode="html",
    )


async def _show_article(event, category_code: str, slug: str, page: int, language: str = "all") -> None:
    """Edit the message to show one page of an article.

    A Telegram Rich Message is tried first; if that fails, the article is
    sent as plain Telegram HTML instead (with images sent as separate files).
    Opening the first page also records a visit for the view counter."""
    article, subsections = await _fetch_article(category_code, slug)
    if article is None:
        await event.answer("Article not found.", alert=True)
        return

    has_language_choice = has_language_subsections(subsections)
    markdown_pages = format_article_markdown(article, subsections, language)
    total_pages = len(markdown_pages)
    page = max(0, min(page, total_pages - 1))
    buttons = build_article_keyboard(
        category_code, slug, page, total_pages,
        has_language_choice=has_language_choice, language=language,
    )

    # Rich Messages (Bot API 10.1+) render the article's own Markdown
    # directly — tables/headings/images included inline, no HTML conversion
    # or separate image attachments needed. Telethon can't send these
    # itself, so this goes straight to the HTTP Bot API. Telethon has no
    # track record yet with this brand-new endpoint, so fall back to the
    # proven HTML path on any failure rather than leaving the user stuck.
    try:
        await rich_api.edit_rich_article(event.chat_id, event.message_id, markdown_pages[page], buttons)
    except Exception as error:
        logger.warning("Rich message edit failed for %s/%s, falling back to HTML: %s", category_code, slug, error)
        html_pages, image_urls = format_article_pages(article, subsections, language)
        html_page_index = min(page, len(html_pages) - 1)
        await event.edit(html_pages[html_page_index], buttons=buttons, parse_mode="html")
        if page == 0:
            for image_url in image_urls[:3]:
                try:
                    await client.send_file(event.sender_id, image_url)
                except Exception as image_error:
                    logger.warning("Failed to send image %s: %s", image_url, image_error)

    if page == 0:
        all_section_ids = [article["id"]]
        for subsection in subsections:
            all_section_ids.append(subsection["id"])
        asyncio.create_task(_track_views(all_section_ids, CATEGORIES[category_code]["doc"], slug))


async def _show_search_hit(event, hit: dict, query: str) -> None:
    """Open the article for a search hit on the paginated page where the
    query text appears (or, for a subsection hit, at least on the page
    holding that subsection's heading)."""
    category_code = hit["cat_code"]
    is_subsection = bool(hit.get("parent_id") and hit.get("parent_slug"))
    # A subsection lives on its parent article's page
    slug = hit["slug"]
    subsection_id = None
    if is_subsection:
        slug = hit["parent_slug"]
        subsection_id = hit["id"]

    article, subsections = await _fetch_article(category_code, slug)
    if article is None:
        await event.answer("Article not found.", alert=True)
        return
    markdown_pages = format_article_markdown(article, subsections, "all")
    page = find_search_hit_page(
        markdown_pages, subsections, query, subsection_id=subsection_id, language="all",
    )
    await _show_article(event, category_code, slug, page, "all")


async def _run_search(event, query: str, is_new_message: bool) -> None:
    """Search every policy and show the first page of results.
    "is_new_message" decides whether to reply with a new message or edit the current one."""
    if not query:
        if is_new_message:
            await event.respond("Please provide a search term.", parse_mode="html")
        else:
            await event.edit("Please provide a search term.", parse_mode="html")
        return
    results = await _search_all(query)
    save_search(event.sender_id, query, results)
    total_pages = _count_pages(len(results))
    message_text = _build_search_results_text(query, results, 1, total_pages)
    buttons = build_search_results_keyboard(results, 1, total_pages)
    if is_new_message:
        await event.respond(message_text, buttons=buttons, parse_mode="html")
    else:
        await event.edit(message_text, buttons=buttons, parse_mode="html")


# ── Event handlers ────────────────────────────────────────────────────────────

def _is_private_chat(event) -> bool:
    """Only react to messages sent directly to the bot (not in groups)."""
    return event.is_private


@client.on(events.NewMessage(func=_is_private_chat))
async def on_message(event: events.NewMessage.Event) -> None:
    """Handle a text message or a /command sent to the bot."""
    text: str = event.raw_text or ""

    # Any non-command text is treated as a search query — no need to tap
    # 🔍 Search or use /search first. Stickers/media with no caption are ignored.
    if not text.startswith("/"):
        query = text.strip()
        if query:
            await _run_search(event, query, is_new_message=True)
        return

    # "/search@PolicyBot hello" → "search"
    command = text.split()[0].lstrip("/").split("@")[0].lower()

    if command == "start":
        await event.respond(_build_home_text(), buttons=build_home_keyboard(), parse_mode="html")

    elif command == "help":
        await event.respond(
            _build_help_text(),
            buttons=[[Button.inline("🏠 Home", b"HOME")]],
            parse_mode="html",
        )

    elif command == "browse":
        await event.respond(_build_categories_text(), buttons=build_categories_keyboard(), parse_mode="html")

    elif command == "search":
        command_parts = text.split(maxsplit=1)
        if len(command_parts) < 2 or not command_parts[1].strip():
            await event.respond(
                "🔍 <b>Search</b>\n\nUsage: <code>/search your query here</code>",
                buttons=[[Button.inline("🏠 Home", b"HOME")]],
                parse_mode="html",
            )
            return
        await _run_search(event, command_parts[1].strip(), is_new_message=True)


@client.on(events.CallbackQuery())
async def on_callback(event: events.CallbackQuery.Event) -> None:
    """Handle a press on one of the bot's inline buttons.
    See the "Button data format" notes in utils.py for what each prefix means."""
    if not event.is_private:
        await event.answer("This bot only works in DMs.", alert=True)
        return

    button_data = event.data.decode("utf-8", errors="replace")
    user_id = event.sender_id

    try:
        if button_data == "HOME":
            await event.edit(_build_home_text(), buttons=build_home_keyboard(), parse_mode="html")

        elif button_data == "CAT":
            await event.edit(_build_categories_text(), buttons=build_categories_keyboard(), parse_mode="html")

        elif button_data == "HELP":
            await event.edit(
                _build_help_text(),
                buttons=[[Button.inline("🏠 Home", b"HOME")]],
                parse_mode="html",
            )

        elif button_data == "SEARCH":
            await event.edit(_build_search_prompt_text(), buttons=build_cancel_home_keyboard(), parse_mode="html")

        elif button_data == "NOOP":
            await event.answer()

        elif button_data.startswith("C|"):
            # Format: C|category|page|sort
            _prefix, category_code, page_text, sort = button_data.split("|")
            await _show_articles(event, category_code, int(page_text), sort)

        elif button_data.startswith("A|"):
            # Format: A|category|slug|page|language  (language defaults to "all" if absent)
            data_parts = button_data.split("|", 4)
            _prefix, category_code, slug, page_text = data_parts[:4]
            language = "all"
            if len(data_parts) > 4:
                language = data_parts[4]
            await _show_article(event, category_code, slug, int(page_text), language)

        elif button_data.startswith("AS|"):
            # Search hit: open its article on the page where the query text
            # appears. Resolved from the saved search.
            result_index = int(button_data.split("|")[1])
            query, results = get_search(user_id)
            if not query or result_index >= len(results):
                await event.answer("Search expired — please search again.", alert=True)
                return
            await _show_search_hit(event, results[result_index], query)

        elif button_data.startswith("SR|"):
            page = int(button_data.split("|")[1])
            query, results = get_search(user_id)
            if not query:
                await event.answer("Search expired — please search again.", alert=True)
                return
            total_pages = _count_pages(len(results))
            await event.edit(
                _build_search_results_text(query, results, page, total_pages),
                buttons=build_search_results_keyboard(results, page, total_pages),
                parse_mode="html",
            )

        else:
            await event.answer()

    except Exception as error:
        logger.exception("callback error data=%r user_id=%s: %s", button_data, user_id, error)
        try:
            await event.answer("Something went wrong. Please try again.", alert=True)
        except Exception:
            pass


# ── Periodic maintenance ──────────────────────────────────────────────────────

async def _maintenance_loop() -> None:
    """Purge expired cache rows from SQLite once per hour."""
    seconds_per_hour = 3600
    while True:
        await asyncio.sleep(seconds_per_hour)
        try:
            cache_purge_expired()
            logger.debug("Cache purge complete.")
        except Exception as error:
            logger.warning("Cache purge failed: %s", error)


# ── Entry point ───────────────────────────────────────────────────────────────

async def main() -> None:
    init_db()
    await client.start(bot_token=TELEGRAM_BOT_TOKEN)
    bot_account = await client.get_me()
    logger.info("Started as @%s (id=%s)", bot_account.username, bot_account.id)
    asyncio.create_task(_maintenance_loop())
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
