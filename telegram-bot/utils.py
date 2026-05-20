import html
import re

from telethon.tl.custom import Button

# ── Category registry ─────────────────────────────────────────────────────────

CATEGORIES: dict[str, dict] = {
    "ch": {"name": "The Charter",             "doc": "charter", "table": "gftvpolicy_charter", "emoji": "📜"},
    "nw": {"name": "News Standards",          "doc": "news",    "table": "gftvpolicy_news",    "emoji": "📰"},
    "pr": {"name": "Programme Rating System", "doc": "prs",     "table": "gftvpolicy_prs",     "emoji": "🎬"},
    "ru": {"name": "Community Rules",         "doc": "rules",   "table": "gftvpolicy_rules",   "emoji": "📋"},
    "jo": {"name": "Join GFTV",               "doc": "join",    "table": "gftvpolicy_join",    "emoji": "🤝"},
    "le": {"name": "Legal",                   "doc": "legal",   "table": "gftvpolicy_legal",   "emoji": "⚖️"},
}

PAGE_SIZE = 8          # articles per list page
CONTENT_MAX = 3800     # chars per content page (Telegram limit is 4096)


# ── Markdown → Telegram HTML ──────────────────────────────────────────────────

def md_to_html(text: str) -> str:
    """Convert a subset of Markdown to Telegram-safe HTML."""
    if not text:
        return ""

    # 1. Save {{embed: url}} blocks and markdown links before HTML-escaping
    #    so their URLs survive intact.
    embeds: list[str] = []
    links: list[tuple[str, str]] = []

    def _save_embed(m: re.Match) -> str:
        embeds.append(m.group(1).strip())
        return f"\x00E{len(embeds) - 1}\x00"

    def _save_link(m: re.Match) -> str:
        links.append((m.group(1), m.group(2)))
        return f"\x00L{len(links) - 1}\x00"

    text = re.sub(r"\{\{embed:\s*([^}]+)\}\}", _save_embed, text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", _save_link, text)

    # 2. Escape HTML in the remaining text
    text = html.escape(text)

    # 3. Block-level elements (process before inline)
    # Headings → bold
    text = re.sub(r"^#{1,6}\s+(.+)$", r"<b>\1</b>", text, flags=re.MULTILINE)
    # Blockquote
    text = re.sub(r"^&gt;\s*(.+)$", r"<i>\1</i>", text, flags=re.MULTILINE)
    # Horizontal rule
    text = re.sub(r"^[-_*]{3,}$", "─────────────────", text, flags=re.MULTILINE)
    # Unordered list items
    text = re.sub(r"^[-*+]\s+(.+)$", r"• \1", text, flags=re.MULTILINE)
    # Ordered list items
    text = re.sub(r"^\d+\.\s+(.+)$", r"• \1", text, flags=re.MULTILINE)

    # 4. Inline elements
    # Bold: **text** or __text__
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text, flags=re.DOTALL)
    text = re.sub(r"__(.+?)__", r"<b>\1</b>", text, flags=re.DOTALL)
    # Italic: *text* or _text_ (not inside words for _)
    text = re.sub(r"\*([^*\n]+?)\*", r"<i>\1</i>", text)
    text = re.sub(r"(?<!\w)_([^_\n]+?)_(?!\w)", r"<i>\1</i>", text)
    # Strikethrough: ~~text~~
    text = re.sub(r"~~(.+?)~~", r"<s>\1</s>", text, flags=re.DOTALL)
    # Inline code: `code`
    text = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", text)

    # 5. Restore saved links and embeds
    for i, (label, url) in enumerate(links):
        replacement = f'<a href="{html.escape(url)}">{html.escape(label)}</a>'
        text = text.replace(f"\x00L{i}\x00", replacement)

    for i, url in enumerate(embeds):
        replacement = f'<a href="{html.escape(url)}">📎 View Embedded Content</a>'
        text = text.replace(f"\x00E{i}\x00", replacement)

    # 6. Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ── Content pagination ────────────────────────────────────────────────────────

def _split_pages(text: str, max_len: int = CONTENT_MAX) -> list[str]:
    if len(text) <= max_len:
        return [text]
    pages: list[str] = []
    while text:
        if len(text) <= max_len:
            pages.append(text)
            break
        cut = text.rfind("\n\n", 0, max_len)
        if cut == -1:
            cut = text.rfind("\n", 0, max_len)
        if cut == -1:
            cut = max_len
        pages.append(text[:cut].rstrip())
        text = text[cut:].lstrip()
    return pages


def format_article_pages(article: dict, subsections: list[dict]) -> list[str]:
    """Render an article + its subsections into paginated HTML strings."""
    parts: list[str] = []

    number = f"{html.escape(article['number'])} — " if article.get("number") else ""
    parts.append(f"<b>{number}{html.escape(article['title'])}</b>")

    if article.get("content"):
        parts.append("")
        parts.append(md_to_html(article["content"]))

    for sub in subsections:
        parts.append("")
        parts.append(f"<b>{html.escape(sub['title'])}</b>")
        if sub.get("content"):
            parts.append(md_to_html(sub["content"]))

    return _split_pages("\n".join(parts).strip())


# ── Keyboard builders ─────────────────────────────────────────────────────────

def kb_home() -> list:
    return [
        [Button.inline("📚 Browse Policies", b"CAT")],
        [Button.inline("🔍 Search",           b"SEARCH")],
        [Button.inline("❓ Help",              b"HELP")],
    ]


def kb_categories() -> list:
    rows = []
    for code, cat in CATEGORIES.items():
        rows.append([Button.inline(f"{cat['emoji']} {cat['name']}", f"C|{code}|1|o".encode())])
    rows.append([Button.inline("🔍 Search", b"SEARCH"), Button.inline("🏠 Home", b"HOME")])
    return rows


def kb_articles(cat_code: str, page_items: list, page: int, total_pages: int, sort: str) -> list:
    rows = []
    for art in page_items:
        label = art["title"][:40] + ("…" if len(art["title"]) > 40 else "")
        if sort == "v":
            label += f" ({art.get('_views', 0)}👁)"
        rows.append([Button.inline(label, f"A|{cat_code}|{art['slug']}|0".encode())])

    nav = []
    if page > 1:
        nav.append(Button.inline("◀ Prev", f"C|{cat_code}|{page - 1}|{sort}".encode()))
    other_sort = "v" if sort == "o" else "o"
    sort_label  = "↕ Sort: Views" if sort == "o" else "↕ Sort: Order"
    nav.append(Button.inline(sort_label, f"C|{cat_code}|{page}|{other_sort}".encode()))
    if page < total_pages:
        nav.append(Button.inline("Next ▶", f"C|{cat_code}|{page + 1}|{sort}".encode()))
    rows.append(nav)

    rows.append([Button.inline("📚 Categories", b"CAT"), Button.inline("🏠 Home", b"HOME")])
    return rows


def kb_article(cat_code: str, slug: str, page: int, total_pages: int) -> list:
    rows = []
    if total_pages > 1:
        nav = []
        if page > 0:
            nav.append(Button.inline("◀ Prev", f"A|{cat_code}|{slug}|{page - 1}".encode()))
        nav.append(Button.inline(f"{page + 1} / {total_pages}", b"NOOP"))
        if page < total_pages - 1:
            nav.append(Button.inline("Next ▶", f"A|{cat_code}|{slug}|{page + 1}".encode()))
        rows.append(nav)
    rows.append([
        Button.inline("◀◀ Back to List", f"C|{cat_code}|1|o".encode()),
        Button.inline("🏠 Home", b"HOME"),
    ])
    return rows


def kb_search_results(results: list, page: int, total_pages: int) -> list:
    rows = []
    start = (page - 1) * PAGE_SIZE
    for r in results[start : start + PAGE_SIZE]:
        label = r["title"][:40] + ("…" if len(r["title"]) > 40 else "")
        target = r["parent_slug"] if r.get("parent_id") and r.get("parent_slug") else r["slug"]
        rows.append([Button.inline(f"{r['cat_emoji']} {label}", f"A|{r['cat_code']}|{target}|0".encode())])

    nav = []
    if page > 1:
        nav.append(Button.inline("◀ Prev", f"SR|{page - 1}".encode()))
    if page < total_pages:
        nav.append(Button.inline("Next ▶", f"SR|{page + 1}".encode()))
    if nav:
        rows.append(nav)

    rows.append([Button.inline("📚 Categories", b"CAT"), Button.inline("🏠 Home", b"HOME")])
    return rows


def kb_cancel_home() -> list:
    return [[Button.inline("❌ Cancel", b"HOME")]]
