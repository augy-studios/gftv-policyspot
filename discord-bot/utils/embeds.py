import re

import discord

import config
from utils.db import DOC_DISPLAY

CHUNK_SIZE = 3800  # safely below Discord's 4096-char embed description limit

_HEADING_RE = re.compile(r'^#{1,6}\s+(.+)$', re.MULTILINE)
_HTML_RE = re.compile(r'<[^>]+>')
_TABLE_RE = re.compile(
    r'^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)+)',
    re.MULTILINE,
)
_IMAGE_RE = re.compile(r'!\[([^\]]*)\](?:\{[^}]+\})?\((https?://[^)]+)\)')


def _table_to_text(match: re.Match) -> str:
    headers = [c.strip() for c in match.group(1).split('|') if c.strip()]
    rows = [
        [c.strip() for c in line.split('|') if c.strip()]
        for line in match.group(2).strip().splitlines()
        if line.strip()
    ]
    if not headers:
        return match.group(0)
    sep = '─' * min(48, len(' | '.join(headers)))
    lines = [f'**{" | ".join(headers)}**', sep]
    lines += [' | '.join(row) for row in rows if row]
    return '\n'.join(lines)


def to_discord_md(text: str) -> str:
    """Convert markdown headings to bold; strip HTML tags; convert tables."""
    if not text:
        return ''
    text = _HEADING_RE.sub(r'**\1**', text)
    text = _HTML_RE.sub('', text)
    text = _TABLE_RE.sub(_table_to_text, text)
    return text.strip()


def extract_section_image(content: str) -> tuple[str | None, str]:
    """Return (first_image_url, content_with_all_images_removed)."""
    m = _IMAGE_RE.search(content)
    if not m:
        return None, content
    first_url = m.group(2)
    stripped = _IMAGE_RE.sub('', content).strip()  # remove all images from description
    return first_url, stripped


def split_content(text: str, size: int = CHUNK_SIZE) -> list[str]:
    """Split text into chunks at paragraph boundaries."""
    if not text:
        return ['*No content available.*']
    if len(text) <= size:
        return [text]
    chunks: list[str] = []
    while text:
        if len(text) <= size:
            chunks.append(text)
            break
        cut = text.rfind('\n\n', 0, size)
        if cut == -1:
            cut = text.rfind('\n', 0, size)
        if cut == -1:
            cut = size
        chunks.append(text[:cut].rstrip())
        text = text[cut:].lstrip()
    return chunks


def section_label(section: dict) -> str:
    num = section.get('number') or ''
    title = section.get('title', 'Untitled')
    return (f'{num} — {title}' if num else title)[:256]


def get_content_chunks_and_image(section: dict) -> tuple[list[str], str | None]:
    """Return (chunks, first_image_url) with images stripped from content."""
    raw = section.get('content') or ''
    image_url, stripped = extract_section_image(raw)
    return split_content(to_discord_md(stripped)), image_url


def get_content_chunks(section: dict) -> list[str]:
    return get_content_chunks_and_image(section)[0]


def build_section_embed(
    section: dict,
    doc: str,
    page: int = 1,
    total_pages: int = 1,
    chunks: list[str] | None = None,
    image_url: str | None = None,
) -> discord.Embed:
    if chunks is None:
        chunks, image_url = get_content_chunks_and_image(section)
        total_pages = len(chunks)

    body = chunks[page - 1] if 1 <= page <= len(chunks) else chunks[0]
    sec_type = (section.get('type') or 'section').capitalize()
    doc_name = DOC_DISPLAY.get(doc, doc.title())

    embed = discord.Embed(
        title=section_label(section),
        description=body,
        color=config.EMBED_COLOR,
    )
    if image_url:
        embed.set_image(url=image_url)
    footer = f'GFTV PolicySpot · {doc_name} · {sec_type}'
    if total_pages > 1:
        footer += f' · Page {page}/{total_pages}'
    embed.set_footer(text=footer)
    return embed


def build_toc_embed(
    sections: list[dict],
    doc: str,
    page: int,
    total_pages: int,
    per_page: int,
) -> discord.Embed:
    doc_name = DOC_DISPLAY.get(doc, doc.title())
    embed = discord.Embed(
        title=f'{doc_name} — Table of Contents',
        color=config.EMBED_COLOR,
    )
    start = (page - 1) * per_page
    items = sections[start : start + per_page]
    lines = []
    for s in items:
        indent = '↳ ' if s.get('type') == 'subsection' else ''
        lines.append(f'{indent}**{section_label(s)}**\n`{s["slug"]}`')
    embed.description = '\n\n'.join(lines) or '*No sections available.*'
    embed.set_footer(
        text=f'GFTV PolicySpot · {doc_name} · Page {page}/{total_pages} · {len(sections)} total'
    )
    return embed


def build_search_embed(results: list[tuple[str, dict]], query: str) -> discord.Embed:
    n = len(results)
    shown = min(n, 25)
    desc = f'Found **{n}** result{"s" if n != 1 else ""}.'
    if n > 25:
        desc += ' Showing the top 25.'
    desc += ' Select one below to read it.'
    embed = discord.Embed(
        title=f'Search: "{query}"',
        description=desc,
        color=config.EMBED_COLOR,
    )
    embed.set_footer(text='GFTV PolicySpot · Search')
    return embed


def build_top_embed(entries: list[tuple[dict, str, int]], doc: str | None) -> discord.Embed:
    label = DOC_DISPLAY.get(doc, 'All Documents') if doc else 'All Documents'
    embed = discord.Embed(title=f'Most Viewed — {label}', color=config.EMBED_COLOR)
    medals = ['🥇', '🥈', '🥉']
    lines = []
    for i, (section, doc_key, count) in enumerate(entries):
        rank = medals[i] if i < 3 else f'`#{i + 1}`'
        doc_name = DOC_DISPLAY.get(doc_key, doc_key)
        views = f'{count} view{"s" if count != 1 else ""}'
        lines.append(f'{rank} **{section_label(section)}**\n`{doc_name}` · {views}')
    embed.description = '\n\n'.join(lines) or '*No views recorded yet.*'
    embed.set_footer(text='GFTV PolicySpot')
    return embed


def build_no_results_embed(query: str) -> discord.Embed:
    return discord.Embed(
        title='No Results',
        description=f'No published sections matched **"{query}"**. Try different keywords.',
        color=discord.Color.red(),
    )
