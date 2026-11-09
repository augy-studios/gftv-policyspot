"""Builds the Discord embeds (the boxed messages) the bot sends."""

import re

import discord

import config
from utils.db import DOCUMENT_DISPLAY_NAMES

CHUNK_SIZE = 3800  # safely below Discord's 4096-char embed description limit
SELECT_MENU_MAXIMUM_OPTIONS = 25  # Discord allows at most 25 options in a select menu

_HEADING_PATTERN = re.compile(r'^#{1,6}\s+(.+)$', re.MULTILINE)
_HTML_TAG_PATTERN = re.compile(r'<[^>]+>')
_TABLE_PATTERN = re.compile(
    r'^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)+)',
    re.MULTILINE,
)
_IMAGE_PATTERN = re.compile(r'!\[([^\]]*)\](?:\{[^}]+\})?\((https?://[^)]+)\)')


def _split_table_row(row_text: str) -> list[str]:
    """Split one "| a | b |" Markdown table row into its non-empty, trimmed cells."""
    cells = []
    for cell in row_text.split('|'):
        if cell.strip():
            cells.append(cell.strip())
    return cells


def _table_to_text(match: re.Match) -> str:
    """Turn a Markdown table into bold headers plus one line per row,
    because Discord embeds cannot display tables."""
    headers = _split_table_row(match.group(1))
    rows = []
    for line in match.group(2).strip().splitlines():
        if line.strip():
            rows.append(_split_table_row(line))
    if not headers:
        return match.group(0)
    separator_line = '─' * min(48, len(' | '.join(headers)))
    output_lines = [f'**{" | ".join(headers)}**', separator_line]
    for row in rows:
        if row:
            output_lines.append(' | '.join(row))
    return '\n'.join(output_lines)


def to_discord_markdown(text: str) -> str:
    """Convert markdown headings to bold; strip HTML tags; convert tables."""
    if not text:
        return ''
    text = _HEADING_PATTERN.sub(r'**\1**', text)
    text = _HTML_TAG_PATTERN.sub('', text)
    text = _TABLE_PATTERN.sub(_table_to_text, text)
    return text.strip()


def extract_section_image(content: str) -> tuple[str | None, str]:
    """Return (first_image_url, content_with_all_images_removed)."""
    first_image_match = _IMAGE_PATTERN.search(content)
    if not first_image_match:
        return None, content
    first_image_url = first_image_match.group(2)
    content_without_images = _IMAGE_PATTERN.sub('', content).strip()  # remove all images from description
    return first_image_url, content_without_images


def split_content(text: str, chunk_size: int = CHUNK_SIZE) -> list[str]:
    """Split text into chunks at paragraph boundaries.
    A chunk is cut at a blank line if possible, otherwise at a line break,
    and only in the middle of a line as a last resort."""
    if not text:
        return ['*No content available.*']
    if len(text) <= chunk_size:
        return [text]
    chunks: list[str] = []
    while text:
        if len(text) <= chunk_size:
            chunks.append(text)
            break
        cut_position = text.rfind('\n\n', 0, chunk_size)
        if cut_position == -1:
            cut_position = text.rfind('\n', 0, chunk_size)
        if cut_position == -1:
            cut_position = chunk_size
        chunks.append(text[:cut_position].rstrip())
        text = text[cut_position:].lstrip()
    return chunks


def section_label(section: dict) -> str:
    """Return "<number> — <title>" (or just the title), at most 256 characters."""
    section_number = section.get('number') or ''
    title = section.get('title', 'Untitled')
    if section_number:
        label = f'{section_number} — {title}'
    else:
        label = title
    return label[:256]


def get_content_chunks_and_image(section: dict) -> tuple[list[str], str | None]:
    """Return (chunks, first_image_url) with images stripped from content."""
    raw_content = section.get('content') or ''
    image_url, content_without_images = extract_section_image(raw_content)
    return split_content(to_discord_markdown(content_without_images)), image_url


def get_content_chunks(section: dict) -> list[str]:
    chunks, image_url = get_content_chunks_and_image(section)
    return chunks


def _get_document_display_name(document: str) -> str:
    """Return the friendly document name, e.g. "news" → "News Standards"."""
    return DOCUMENT_DISPLAY_NAMES.get(document, document.title())


def _pluralise(count: int, word: str) -> str:
    """Return "1 view" or "3 views" style text."""
    if count == 1:
        return f'{count} {word}'
    return f'{count} {word}s'


def build_section_embed(
    section: dict,
    document: str,
    page: int = 1,
    total_pages: int = 1,
    chunks: list[str] | None = None,
    image_url: str | None = None,
) -> discord.Embed:
    """Build the embed for one page of a section's text.
    When "chunks" is not given, the section's content is split into pages here."""
    if chunks is None:
        chunks, image_url = get_content_chunks_and_image(section)
        total_pages = len(chunks)

    if 1 <= page <= len(chunks):
        page_text = chunks[page - 1]
    else:
        page_text = chunks[0]
    section_type = (section.get('type') or 'section').capitalize()
    document_name = _get_document_display_name(document)

    embed = discord.Embed(
        title=section_label(section),
        description=page_text,
        color=config.EMBED_COLOR,
    )
    if image_url:
        embed.set_image(url=image_url)
    footer_text = f'GFTV PolicySpot · {document_name} · {section_type}'
    if total_pages > 1:
        footer_text += f' · Page {page}/{total_pages}'
    embed.set_footer(text=footer_text)
    return embed


def build_toc_embed(
    sections: list[dict],
    document: str,
    page: int,
    total_pages: int,
    sections_per_page: int,
) -> discord.Embed:
    """Build one page of a document's table of contents."""
    document_name = _get_document_display_name(document)
    embed = discord.Embed(
        title=f'{document_name} — Table of Contents',
        color=config.EMBED_COLOR,
    )
    first_index = (page - 1) * sections_per_page
    sections_on_page = sections[first_index : first_index + sections_per_page]
    lines = []
    for section in sections_on_page:
        indent = ''
        if section.get('type') == 'subsection':
            indent = '↳ '
        lines.append(f'{indent}**{section_label(section)}**\n`{section["slug"]}`')
    embed.description = '\n\n'.join(lines) or '*No sections available.*'
    embed.set_footer(
        text=f'GFTV PolicySpot · {document_name} · Page {page}/{total_pages} · {len(sections)} total'
    )
    return embed


def build_search_embed(results: list[tuple[str, dict]], query: str) -> discord.Embed:
    """Build the embed shown above the search results dropdown."""
    result_count = len(results)
    if result_count == 1:
        description = f'Found **{result_count}** result.'
    else:
        description = f'Found **{result_count}** results.'
    if result_count > SELECT_MENU_MAXIMUM_OPTIONS:
        description += ' Showing the top 25.'
    description += ' Select one below to read it.'
    embed = discord.Embed(
        title=f'Search: "{query}"',
        description=description,
        color=config.EMBED_COLOR,
    )
    embed.set_footer(text='GFTV PolicySpot · Search')
    return embed


def build_top_embed(entries: list[tuple[dict, str, int]], document: str | None) -> discord.Embed:
    """Build the "Most Viewed" ranking. Each entry is (section, document_name, view_count)."""
    heading_label = 'All Documents'
    if document:
        heading_label = DOCUMENT_DISPLAY_NAMES.get(document, 'All Documents')
    embed = discord.Embed(title=f'Most Viewed — {heading_label}', color=config.EMBED_COLOR)
    medals = ['🥇', '🥈', '🥉']
    lines = []
    for position, (section, document_key, view_count) in enumerate(entries):
        # The top three get a medal, the rest get "#4", "#5", ...
        if position < 3:
            rank_label = medals[position]
        else:
            rank_label = f'`#{position + 1}`'
        document_name = DOCUMENT_DISPLAY_NAMES.get(document_key, document_key)
        views_text = _pluralise(view_count, 'view')
        lines.append(f'{rank_label} **{section_label(section)}**\n`{document_name}` · {views_text}')
    embed.description = '\n\n'.join(lines) or '*No views recorded yet.*'
    embed.set_footer(text='GFTV PolicySpot')
    return embed


def build_no_results_embed(query: str) -> discord.Embed:
    return discord.Embed(
        title='No Results',
        description=f'No published sections matched **"{query}"**. Try different keywords.',
        color=discord.Color.red(),
    )
