import html
import re

from telethon.tl.custom import Button

# ── Category registry ─────────────────────────────────────────────────────────
#
# The two-letter keys ("ch", "nw", ...) are category codes. They are kept short
# on purpose because they are packed into Telegram button data, which is
# limited to 64 bytes.

CATEGORIES: dict[str, dict] = {
    "ch": {"name": "The Charter",             "doc": "charter", "table": "gftvpolicy_charter", "emoji": "📜"},
    "nw": {"name": "News Standards",          "doc": "news",    "table": "gftvpolicy_news",    "emoji": "📰"},
    "pr": {"name": "Programme Rating System", "doc": "prs",     "table": "gftvpolicy_prs",     "emoji": "🎬"},
    "ru": {"name": "Community Rules",         "doc": "rules",   "table": "gftvpolicy_rules",   "emoji": "📋"},
    "jo": {"name": "Join GFTV",               "doc": "join",    "table": "gftvpolicy_join",    "emoji": "🤝"},
    "le": {"name": "Legal",                   "doc": "legal",   "table": "gftvpolicy_legal",   "emoji": "⚖️"},
}

PAGE_SIZE = 8                # articles per list page
CONTENT_MAXIMUM_LENGTH = 3800  # characters per content page (Telegram limit is 4096)
BUTTON_LABEL_MAXIMUM_LENGTH = 40

# ── Button data format ────────────────────────────────────────────────────────
#
# Every inline button carries a short text "callback data" string that tells
# the bot what to do when it is pressed. The parts are separated by "|":
#
#   HOME / CAT / HELP / SEARCH / NOOP     simple actions
#   C|<category>|<page>|<sort>            article list ("o" = order, "v" = views)
#   A|<category>|<slug>|<page>|<language> one article ("all", "en" or "zh")
#   AS|<result index>                     open a saved search result
#   SR|<page>                             page of saved search results
#
# The prefixes stay short because Telegram limits button data to 64 bytes.

SORT_BY_ORDER = "o"
SORT_BY_VIEWS = "v"

_ENGLISH_TITLE_PATTERN = re.compile(r'^english$', re.IGNORECASE)
_CHINESE_TITLE_PATTERN = re.compile(r'^中文$|^chinese$', re.IGNORECASE)
_IMAGE_PATTERN = re.compile(r'!\[([^\]]*)\](?:\{[^}]+\})?\((https?://[^)]+)\)')
_TABLE_PATTERN = re.compile(
    r'^\|(.+)\|[ \t]*\n\|[-| :]+\|[ \t]*\n((?:\|.+\|[ \t]*\n?)+)',
    re.MULTILINE,
)


# ── Markdown → Telegram HTML ──────────────────────────────────────────────────

def _split_table_row(row_text: str) -> list[str]:
    """Split one "| a | b |" Markdown table row into its non-empty, trimmed cells."""
    cells = []
    for cell in row_text.split('|'):
        if cell.strip():
            cells.append(cell.strip())
    return cells


def _convert_table(match: re.Match) -> str:
    """Turn a Markdown table into plain text that reads well in Telegram,
    which has no table support in its HTML mode."""
    headers = _split_table_row(match.group(1))
    rows = []
    for line in match.group(2).strip().splitlines():
        if line.strip():
            rows.append(_split_table_row(line))
    if not headers:
        return match.group(0)

    # Two-column tables (e.g. bilingual lyrics/oath lines) read better as
    # stacked couplets than as one long pipe-joined line per row.
    if len(headers) == 2:
        output_lines = [f'<i>{" / ".join(headers)}</i>', ""]
        for row in rows:
            if len(row) < 2:
                continue
            output_lines.append(row[0])
            output_lines.append(f'<i>{row[1]}</i>')
            output_lines.append("")
        return '\n'.join(output_lines).rstrip()

    # Content here is already HTML-escaped upstream (markdown_to_html step 2) —
    # re-escaping would double-encode entities like &amp;.
    separator_line = '─' * min(48, len(' | '.join(headers)))
    output_lines = [f'<b>{" | ".join(headers)}</b>', separator_line]
    for row in rows:
        if row:
            output_lines.append(' | '.join(row))
    return '\n'.join(output_lines)


def markdown_to_html(text: str) -> str:
    """Convert a subset of Markdown to Telegram-safe HTML.

    Steps:
      1. Swap embeds, images and links for placeholders so their URLs are
         not changed by the HTML escaping in step 2.
      2. Escape &, < and > in the rest of the text.
      3. Convert block elements (tables, headings, quotes, rules, lists).
      4. Convert inline elements (bold, italic, strikethrough, code).
      5. Put the links and embeds back (images are dropped; they are sent
         separately as attachments).
      6. Collapse runs of blank lines.
    """
    if not text:
        return ""

    # 1. Save {{embed: url}} blocks and markdown links before HTML-escaping
    #    so their URLs survive intact.
    embeds: list[str] = []
    links: list[tuple[str, str]] = []
    images: list[tuple[str, str]] = []

    def _save_embed(match: re.Match) -> str:
        embeds.append(match.group(1).strip())
        return f"\x00E{len(embeds) - 1}\x00"

    def _save_link(match: re.Match) -> str:
        links.append((match.group(1), match.group(2)))
        return f"\x00L{len(links) - 1}\x00"

    def _save_image(match: re.Match) -> str:
        images.append((match.group(1), match.group(2)))
        return f"\x00I{len(images) - 1}\x00"

    text = re.sub(r"\{\{embed:\s*([^}]+)\}\}", _save_embed, text)
    # Save images before links so the pattern doesn't conflict
    text = _IMAGE_PATTERN.sub(_save_image, text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", _save_link, text)

    # 2. Escape HTML in the remaining text. quote=False: Telegram's HTML
    #    parser only requires &, <, > to be escaped — it doesn't decode
    #    &quot;/&#x27; back to " / ', so escaping them just shows the raw
    #    entity text to the user.
    text = html.escape(text, quote=False)

    # 3. Block-level elements (process before inline)
    # Tables (must come before heading/list processing)
    text = _TABLE_PATTERN.sub(_convert_table, text)
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

    # 5. Restore saved links, embeds, and images
    for link_index, (label, url) in enumerate(links):
        replacement = f'<a href="{html.escape(url)}">{html.escape(label, quote=False)}</a>'
        text = text.replace(f"\x00L{link_index}\x00", replacement)

    for embed_index, url in enumerate(embeds):
        replacement = f'<a href="{html.escape(url)}">📎 View Embedded Content</a>'
        text = text.replace(f"\x00E{embed_index}\x00", replacement)

    # Images are stripped from text (sent as attachments separately)
    for image_index in range(len(images)):
        text = text.replace(f"\x00I{image_index}\x00", "")

    # 6. Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_images(content: str) -> tuple[list[str], str]:
    """Extract all image URLs from content. Returns (urls, content_without_images)."""
    urls: list[str] = []

    def _collect(match: re.Match) -> str:
        urls.append(match.group(2))
        return ""

    content_without_images = _IMAGE_PATTERN.sub(_collect, content).strip()
    return urls, content_without_images


# ── Language helpers ──────────────────────────────────────────────────────────

def _get_title(section: dict) -> str:
    """Return a section's title with surrounding spaces removed ("" if it has none)."""
    title = section.get("title")
    if not title:
        return ""
    return title.strip()


def _is_english_section(section: dict) -> bool:
    return bool(_ENGLISH_TITLE_PATTERN.search(_get_title(section)))


def _is_chinese_section(section: dict) -> bool:
    return bool(_CHINESE_TITLE_PATTERN.search(_get_title(section)))


def has_language_subsections(subsections: list[dict]) -> bool:
    """True if subsections contain both an English and a Chinese variant."""
    has_english = False
    has_chinese = False
    for subsection in subsections:
        if _is_english_section(subsection):
            has_english = True
        if _is_chinese_section(subsection):
            has_chinese = True
    return has_english and has_chinese


def _filter_subsections_by_language(subsections: list[dict], language: str) -> list[dict]:
    """Keep only the English ("en") or Chinese ("zh") subsections.
    "all", or a language with no matching subsections, keeps every subsection."""
    if language == "all":
        return subsections
    filtered_subsections = []
    for subsection in subsections:
        if language == "en" and _is_english_section(subsection):
            filtered_subsections.append(subsection)
        elif language != "en" and _is_chinese_section(subsection):
            filtered_subsections.append(subsection)
    if filtered_subsections:
        return filtered_subsections
    return subsections


# ── Content pagination ────────────────────────────────────────────────────────

def _split_pages(text: str, maximum_length: int = CONTENT_MAXIMUM_LENGTH) -> list[str]:
    """Split long text into pages no longer than "maximum_length" characters.
    Pages are cut at a blank line if possible, otherwise at a line break,
    and only in the middle of a line as a last resort."""
    if len(text) <= maximum_length:
        return [text]
    pages: list[str] = []
    while text:
        if len(text) <= maximum_length:
            pages.append(text)
            break
        cut_position = text.rfind("\n\n", 0, maximum_length)
        if cut_position == -1:
            cut_position = text.rfind("\n", 0, maximum_length)
        if cut_position == -1:
            cut_position = maximum_length
        pages.append(text[:cut_position].rstrip())
        text = text[cut_position:].lstrip()
    return pages


def _embed_to_markdown_link(match: re.Match) -> str:
    """Replace an {{embed: url}} block with a normal Markdown link."""
    embed_url = match.group(1).strip()
    return f"[\U0001F4CE View Embedded Content]({embed_url})"


def _normalize_markdown(text: str) -> str:
    """Rewrite this CMS's custom markdown ({{embed:}}, ![alt]{img}(url)) into
    standard Markdown that telegramify-markdown's richify() understands."""
    text = re.sub(r"\{\{embed:\s*([^}]+)\}\}", _embed_to_markdown_link, text)
    text = _IMAGE_PATTERN.sub(r"![\1](\2)", text)
    return text


def _build_number_prefix(article: dict) -> str:
    """Return "<number> — " when the article has a number, otherwise ""."""
    if article.get("number"):
        return f"{article['number']} — "
    return ""


def format_article_markdown(
    article: dict,
    subsections: list[dict],
    language: str = "all",
) -> list[str]:
    """Render article + subsections into raw Markdown pages for Telegram
    Rich Messages (sendRichMessage). Images stay inline as Markdown image
    syntax — rich messages embed media directly, unlike the HTML path where
    they had to be stripped and sent as separate attachments."""
    output_lines: list[str] = []

    output_lines.append(f"# {_build_number_prefix(article)}{article['title']}")

    if article.get("content"):
        output_lines.append("")
        output_lines.append(_normalize_markdown(article["content"]))

    for subsection in _filter_subsections_by_language(subsections, language):
        output_lines.append("")
        output_lines.append(f"## {subsection['title']}")
        if subsection.get("content"):
            output_lines.append(_normalize_markdown(subsection["content"]))

    return _split_pages("\n".join(output_lines).strip())


def find_subsection_page(
    markdown_pages: list[str],
    subsections: list[dict],
    subsection_id,
    language: str = "all",
) -> int:
    """Return the index of the page (from format_article_markdown) whose
    text contains the heading of subsection `subsection_id`. Falls back to 0
    when the subsection isn't rendered (filtered out by language, or unknown id).

    Headings are matched by title, so if several subsections share a title
    the Nth such subsection is mapped to the Nth heading occurrence."""
    visible_subsections = _filter_subsections_by_language(subsections, language)

    target_subsection = None
    for subsection in visible_subsections:
        if subsection.get("id") == subsection_id:
            target_subsection = subsection
            break
    if target_subsection is None:
        return 0

    title = target_subsection.get("title") or ""
    # How many earlier subsections have exactly the same title
    same_title_count_before = 0
    for subsection in visible_subsections[: visible_subsections.index(target_subsection)]:
        if (subsection.get("title") or "") == title:
            same_title_count_before += 1
    heading_pattern = re.compile(rf"^## {re.escape(title)}[ \t]*$", re.MULTILINE)

    headings_seen = 0
    for page_index, page in enumerate(markdown_pages):
        headings_on_page = len(heading_pattern.findall(page))
        if headings_seen + headings_on_page > same_title_count_before:
            return page_index
        headings_seen += headings_on_page
    return 0


# ── Search matching ───────────────────────────────────────────────────────────

_MARKDOWN_PUNCTUATION_PATTERN = re.compile(r"[*_`#>~\[\]()!|]")
_MARKDOWN_LINK_URL_PATTERN = re.compile(r"\]\([^)]*\)")
_EMBED_PATTERN = re.compile(r"\{\{embed:[^}]*\}\}")


def plain_text(text: str) -> str:
    """Reduce Markdown to searchable plain text: drop link URLs, embeds and
    Markdown punctuation, collapse whitespace, lower-case. Used for both the
    search itself and for locating the hit inside a paginated article, so a
    query typed as plain words matches text that is bold/linked/wrapped."""
    if not text:
        return ""
    text = _EMBED_PATTERN.sub(" ", text)
    text = _MARKDOWN_LINK_URL_PATTERN.sub("]", text)
    text = _MARKDOWN_PUNCTUATION_PATTERN.sub("", text)
    text = re.sub(r"\s+", " ", text)
    return text.lower().strip()


def _contains_every_word(text: str, words: list[str]) -> bool:
    """True when each of the given words appears somewhere in the text."""
    for word in words:
        if word not in text:
            return False
    return True


def match_query(query: str, *fields: str) -> int:
    """Score how `query` matches the given text fields (title, content, …).

    2 — the whole phrase appears (after Markdown/whitespace normalisation)
    1 — every word of the query appears somewhere, but not as one phrase
    0 — no match"""
    normalised_query = plain_text(query)
    if not normalised_query:
        return 0
    plain_fields = []
    for field in fields:
        if field:
            plain_fields.append(plain_text(field))
    searchable_text = " \n ".join(plain_fields)
    if normalised_query in searchable_text:
        return 2
    query_words = normalised_query.split()
    if len(query_words) > 1 and _contains_every_word(searchable_text, query_words):
        return 1
    return 0


def find_search_hit_page(
    markdown_pages: list[str],
    subsections: list[dict],
    query: str,
    subsection_id=None,
    language: str = "all",
) -> int:
    """Return the index of the page where search `query` actually appears.

    For a subsection hit (`subsection_id` set) the scan starts on the page
    holding that subsection's heading so a match in an earlier subsection
    isn't picked by mistake. Prefers the page containing the whole phrase,
    then the first page containing every query word; falls back to the
    heading page (or 0) when the text can't be located, e.g. the match was
    in the title."""
    start_page = 0
    if subsection_id:
        start_page = find_subsection_page(markdown_pages, subsections, subsection_id, language)
    normalised_query = plain_text(query)
    if not normalised_query:
        return start_page
    plain_pages = []
    for page in markdown_pages[start_page:]:
        plain_pages.append(plain_text(page))
    for page_offset, page in enumerate(plain_pages):
        if normalised_query in page:
            return start_page + page_offset
    query_words = normalised_query.split()
    if len(query_words) > 1:
        for page_offset, page in enumerate(plain_pages):
            if _contains_every_word(page, query_words):
                return start_page + page_offset
    return start_page


def format_article_pages(
    article: dict,
    subsections: list[dict],
    language: str = "all",
) -> tuple[list[str], list[str]]:
    """Render article + subsections into (pages, image_urls).

    Images are stripped from text content and returned separately.
    Subsections are filtered to the requested language when language != 'all'.
    """
    image_urls: list[str] = []
    output_lines: list[str] = []

    number_prefix = ""
    if article.get("number"):
        number_prefix = f"{html.escape(article['number'])} — "
    output_lines.append(f"<b>{number_prefix}{html.escape(article['title'])}</b>")

    if article.get("content"):
        found_image_urls, content_without_images = extract_images(article["content"])
        image_urls.extend(found_image_urls)
        output_lines.append("")
        output_lines.append(markdown_to_html(content_without_images))

    for subsection in _filter_subsections_by_language(subsections, language):
        output_lines.append("")
        output_lines.append(f"<b>{html.escape(subsection['title'])}</b>")
        if subsection.get("content"):
            found_image_urls, content_without_images = extract_images(subsection["content"])
            image_urls.extend(found_image_urls)
            output_lines.append(markdown_to_html(content_without_images))

    return _split_pages("\n".join(output_lines).strip()), image_urls


# ── Keyboard builders ─────────────────────────────────────────────────────────

def _shorten_label(title: str) -> str:
    """Cut a title down to fit on a button, adding "…" when it was cut."""
    if len(title) > BUTTON_LABEL_MAXIMUM_LENGTH:
        return title[:BUTTON_LABEL_MAXIMUM_LENGTH] + "…"
    return title


def build_home_keyboard() -> list:
    return [
        [Button.inline("📚 Browse Policies", b"CAT")],
        [Button.inline("🔍 Search",           b"SEARCH")],
        [Button.inline("❓ Help",              b"HELP")],
    ]


def build_categories_keyboard() -> list:
    rows = []
    for category_code, category in CATEGORIES.items():
        button_label = f"{category['emoji']} {category['name']}"
        rows.append([Button.inline(button_label, f"C|{category_code}|1|{SORT_BY_ORDER}".encode())])
    rows.append([Button.inline("🔍 Search", b"SEARCH"), Button.inline("🏠 Home", b"HOME")])
    return rows


def build_articles_keyboard(category_code: str, page_items: list, page: int, total_pages: int, sort: str) -> list:
    """One button per article on this page, then Previous / Sort / Next."""
    rows = []
    for article in page_items:
        button_label = _shorten_label(article["title"])
        if sort == SORT_BY_VIEWS:
            button_label += f" ({article.get('_views', 0)}👁)"
        rows.append([Button.inline(button_label, f"A|{category_code}|{article['slug']}|0|all".encode())])

    navigation_row = []
    if page > 1:
        navigation_row.append(Button.inline("◀ Prev", f"C|{category_code}|{page - 1}|{sort}".encode()))
    # The sort button switches to the other sort order
    if sort == SORT_BY_ORDER:
        other_sort = SORT_BY_VIEWS
        sort_label = "↕ Sort: Views"
    else:
        other_sort = SORT_BY_ORDER
        sort_label = "↕ Sort: Order"
    navigation_row.append(Button.inline(sort_label, f"C|{category_code}|{page}|{other_sort}".encode()))
    if page < total_pages:
        navigation_row.append(Button.inline("Next ▶", f"C|{category_code}|{page + 1}|{sort}".encode()))
    rows.append(navigation_row)

    rows.append([Button.inline("📚 Categories", b"CAT"), Button.inline("🏠 Home", b"HOME")])
    return rows


def build_article_keyboard(
    category_code: str,
    slug: str,
    page: int,
    total_pages: int,
    has_language_choice: bool = False,
    language: str = "all",
) -> list:
    """Buttons under an article: language switch, page navigation, back/home."""
    rows = []

    # Language toggle row (only for bilingual sections). A tick marks the chosen language.
    if has_language_choice:
        english_label = "🇬🇧 English"
        if language == "en":
            english_label = "🇬🇧 ✓ English"
        chinese_label = "🇨🇳 中文"
        if language == "zh":
            chinese_label = "🇨🇳 ✓ 中文"
        rows.append([
            Button.inline(english_label, f"A|{category_code}|{slug}|0|en".encode()),
            Button.inline(chinese_label, f"A|{category_code}|{slug}|0|zh".encode()),
        ])

    if total_pages > 1:
        navigation_row = []
        if page > 0:
            navigation_row.append(Button.inline("◀ Prev", f"A|{category_code}|{slug}|{page - 1}|{language}".encode()))
        navigation_row.append(Button.inline(f"{page + 1} / {total_pages}", b"NOOP"))
        if page < total_pages - 1:
            navigation_row.append(Button.inline("Next ▶", f"A|{category_code}|{slug}|{page + 1}|{language}".encode()))
        rows.append(navigation_row)

    rows.append([
        Button.inline("◀◀ Back to List", f"C|{category_code}|1|{SORT_BY_ORDER}".encode()),
        Button.inline("🏠 Home", b"HOME"),
    ])
    return rows


def build_search_results_keyboard(results: list, page: int, total_pages: int) -> list:
    """One button per search result on this page, then Previous / Next."""
    rows = []
    first_result_index = (page - 1) * PAGE_SIZE
    last_result_index = min(first_result_index + PAGE_SIZE, len(results))
    for result_index in range(first_result_index, last_result_index):
        result = results[result_index]
        button_label = _shorten_label(result["title"])
        # AS|index resolves the hit from the saved search, so the bot can
        # open the article on the page where the query text appears.
        rows.append([Button.inline(f"{result['cat_emoji']} {button_label}", f"AS|{result_index}".encode())])

    navigation_row = []
    if page > 1:
        navigation_row.append(Button.inline("◀ Prev", f"SR|{page - 1}".encode()))
    if page < total_pages:
        navigation_row.append(Button.inline("Next ▶", f"SR|{page + 1}".encode()))
    if navigation_row:
        rows.append(navigation_row)

    rows.append([Button.inline("📚 Categories", b"CAT"), Button.inline("🏠 Home", b"HOME")])
    return rows


def build_cancel_home_keyboard() -> list:
    return [[Button.inline("❌ Cancel", b"HOME")]]
