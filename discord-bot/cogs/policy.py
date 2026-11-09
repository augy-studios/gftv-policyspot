from __future__ import annotations

import logging
import re
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

import utils.db as database
import utils.view_store as view_store
from utils.embeds import (
    build_no_results_embed,
    build_search_embed,
    build_section_embed,
    build_toc_embed,
    build_top_embed,
    get_content_chunks_and_image,
    section_label,
)

logger = logging.getLogger('policyspot.policy')

DOCUMENT_CHOICES = [
    app_commands.Choice(name='Charter',                 value='charter'),
    app_commands.Choice(name='News Standards',          value='news'),
    app_commands.Choice(name='Programme Rating System', value='prs'),
    app_commands.Choice(name='Community Rules',         value='rules'),
    app_commands.Choice(name='Join GFTV',               value='join'),
    app_commands.Choice(name='Legal',                   value='legal'),
]

TABLE_OF_CONTENTS_PER_PAGE = 10
DISCORD_TEXT_LIMIT_FOR_OPTIONS = 100  # select option labels/descriptions are limited to 100 characters
AUTOCOMPLETE_MAXIMUM_CHOICES = 25
TOP_SECTIONS_COUNT = 10

_ENGLISH_TITLE_PATTERN = re.compile(r'^english$', re.IGNORECASE)
_CHINESE_TITLE_PATTERN = re.compile(r'^中文$|^chinese$', re.IGNORECASE)

# Note on saved state: the dictionaries returned by the _state() methods are
# written to the view_store database and read back after a restart, so their
# keys ('doc', 'section_idx', ...) must stay exactly as they are. The same
# applies to every custom_id ('pb:toc_sel', ...): Discord uses them to route
# button presses on old messages back to the right view.


def _count_pages(item_count: int, items_per_page: int) -> int:
    """How many pages are needed to show all items (always at least 1)."""
    page_count = (item_count + items_per_page - 1) // items_per_page
    return max(1, page_count)


def _get_title(section: dict) -> str:
    """Return a section's title with surrounding spaces removed ("" if it has none)."""
    return (section.get('title') or '').strip()


def _find_language_siblings(sections: list[dict], section_index: int) -> dict[str, int] | None:
    """Return {'en': index, 'zh': index} if the section is a language variant with a sibling.

    Bilingual articles have two subsections titled "English" and "中文"
    (or "Chinese"). When the chosen section is one of those, this finds the
    position of both so the reader can switch between them."""
    section = sections[section_index]
    title = _get_title(section)
    parent_id = section.get('parent_id')
    if parent_id is None:
        return None
    is_language_variant = _ENGLISH_TITLE_PATTERN.search(title) or _CHINESE_TITLE_PATTERN.search(title)
    if not is_language_variant:
        return None
    sibling_indexes: dict[str, int | None] = {'en': None, 'zh': None}
    for candidate_index, candidate in enumerate(sections):
        if candidate.get('parent_id') != parent_id:
            continue
        candidate_title = _get_title(candidate)
        if _ENGLISH_TITLE_PATTERN.search(candidate_title):
            sibling_indexes['en'] = candidate_index
        elif _CHINESE_TITLE_PATTERN.search(candidate_title):
            sibling_indexes['zh'] = candidate_index
    if sibling_indexes['en'] is not None and sibling_indexes['zh'] is not None:
        return sibling_indexes  # type: ignore[return-value]
    return None


async def _slug_autocomplete(
    interaction: discord.Interaction, current_text: str
) -> list[app_commands.Choice[str]]:
    """Suggest section slugs for /section while the user types, using the chosen document."""
    document = getattr(interaction.namespace, 'document', None)
    if not document or document not in database.DOCUMENT_TABLES:
        return []
    try:
        sections = await database.fetch_sections(document)
    except Exception:
        return []
    typed_text = current_text.lower()
    choices = []
    for section in sections:
        matches_slug = typed_text in section['slug'].lower()
        matches_title = typed_text in section['title'].lower()
        if not typed_text or matches_slug or matches_title:
            choices.append(app_commands.Choice(
                name=section_label(section)[:DISCORD_TEXT_LIMIT_FOR_OPTIONS],
                value=section['slug'],
            ))
    return choices[:AUTOCOMPLETE_MAXIMUM_CHOICES]


def _choose_button_style(is_highlighted: bool) -> discord.ButtonStyle:
    """Blue ("primary") for the highlighted button, grey ("secondary") otherwise."""
    if is_highlighted:
        return discord.ButtonStyle.primary
    return discord.ButtonStyle.secondary


# ── Views ────────────────────────────────────────────────────────────────────


class PolicyBrowser(discord.ui.View):
    """Interactive browser: TOC select + per-section reading with pagination.

    The view has two modes:
      * table of contents ("toc"): a dropdown of sections plus page buttons;
      * section ("section"): the text of one section, with buttons to page
        through long text, step to the previous/next section, switch
        language, or go back to the table of contents.
    """

    MODE_TOC = 'toc'
    MODE_SECTION = 'section'

    def __init__(self, sections: list[dict], document: str) -> None:
        super().__init__(timeout=None)
        self.sections = sections
        self.document = document
        self.mode = self.MODE_TOC
        self.table_of_contents_page = 0
        self.section_index = 0
        self.content_page = 0
        self._chunks: list[str] = []
        self._image_url: str | None = None
        self._language_siblings: dict[str, int] | None = None
        self.message_id: int | None = None
        self._rebuild()

    # ── embed ────────────────────────────────────────────────────────────────

    def get_embed(self) -> discord.Embed:
        """Build the embed for whatever the view is currently showing."""
        if self.mode == self.MODE_TOC:
            total_table_of_contents_pages = _count_pages(len(self.sections), TABLE_OF_CONTENTS_PER_PAGE)
            return build_toc_embed(
                self.sections, self.document, self.table_of_contents_page + 1,
                total_table_of_contents_pages, TABLE_OF_CONTENTS_PER_PAGE,
            )
        section = self.sections[self.section_index]
        return build_section_embed(
            section, self.document, self.content_page + 1, len(self._chunks), self._chunks,
            image_url=self._image_url,
        )

    # ── item builder ─────────────────────────────────────────────────────────

    def _rebuild(self) -> None:
        """Remove all buttons/menus and add the ones that fit the current mode."""
        self.clear_items()
        if self.mode == self.MODE_TOC:
            self._build_table_of_contents_items()
        else:
            self._chunks, self._image_url = get_content_chunks_and_image(
                self.sections[self.section_index]
            )
            self._language_siblings = _find_language_siblings(self.sections, self.section_index)
            self._build_section_items()

    def _add_button(self, label: str, style: discord.ButtonStyle, row: int, custom_id: str, callback, disabled: bool = False) -> None:
        """Create a button, connect it to its callback and add it to the view."""
        button = discord.ui.Button(
            label=label,
            style=style,
            disabled=disabled,
            row=row,
            custom_id=custom_id,
        )
        button.callback = callback
        self.add_item(button)

    def _build_table_of_contents_items(self) -> None:
        """Dropdown of the sections on this page, plus Previous / Next page buttons."""
        total_table_of_contents_pages = _count_pages(len(self.sections), TABLE_OF_CONTENTS_PER_PAGE)
        first_index = self.table_of_contents_page * TABLE_OF_CONTENTS_PER_PAGE
        sections_on_page = self.sections[first_index : first_index + TABLE_OF_CONTENTS_PER_PAGE]

        if sections_on_page:
            options = []
            for position_on_page, section in enumerate(sections_on_page):
                section_type = 'Section'
                if section.get('type') == 'subsection':
                    section_type = 'Subsection'
                options.append(
                    discord.SelectOption(
                        label=section_label(section)[:DISCORD_TEXT_LIMIT_FOR_OPTIONS],
                        value=str(first_index + position_on_page),
                        description=f'{section_type} · {section["slug"]}'[:DISCORD_TEXT_LIMIT_FOR_OPTIONS],
                    )
                )
            section_select = discord.ui.Select(
                placeholder='Select a section to read…', options=options,
                row=0, custom_id='pb:toc_sel',
            )
            section_select.callback = self._on_select
            self.add_item(section_select)

        self._add_button(
            '◀ Prev', discord.ButtonStyle.secondary, 1, 'pb:toc_prev', self._on_toc_previous,
            disabled=(self.table_of_contents_page == 0),
        )
        self._add_button(
            'Next ▶', discord.ButtonStyle.secondary, 1, 'pb:toc_next', self._on_toc_next,
            disabled=(self.table_of_contents_page >= total_table_of_contents_pages - 1),
        )

    def _build_section_items(self) -> None:
        """Buttons shown while reading a section."""
        chunk_count = len(self._chunks)

        self._add_button('📋 Table of Contents', discord.ButtonStyle.secondary, 0, 'pb:back', self._on_back_to_toc)

        # Language toggle buttons for bilingual sections (English / 中文 subsections)
        if self._language_siblings:
            english_index = self._language_siblings.get('en')
            is_showing_english = (self.section_index == english_index)
            self._add_button('🇬🇧 English', _choose_button_style(is_showing_english), 0, 'pb:lang_en', self._on_language_english)
            self._add_button('🇨🇳 中文', _choose_button_style(not is_showing_english), 0, 'pb:lang_zh', self._on_language_chinese)

        # Page buttons, only when the section's text is too long for one embed
        if chunk_count > 1:
            self._add_button(
                '◀ Prev Page', discord.ButtonStyle.secondary, 1, 'pb:cp_prev', self._on_content_previous,
                disabled=(self.content_page == 0),
            )
            self._add_button(
                'Next Page ▶', discord.ButtonStyle.secondary, 1, 'pb:cp_next', self._on_content_next,
                disabled=(self.content_page >= chunk_count - 1),
            )

        self._add_button(
            '◀ Prev Section', discord.ButtonStyle.primary, 2, 'pb:sec_prev', self._on_section_previous,
            disabled=(self.section_index == 0),
        )
        self._add_button(
            'Next Section ▶', discord.ButtonStyle.primary, 2, 'pb:sec_next', self._on_section_next,
            disabled=(self.section_index >= len(self.sections) - 1),
        )

    # ── callbacks ────────────────────────────────────────────────────────────

    async def _refresh_message(self, interaction: discord.Interaction) -> None:
        """Rebuild the buttons, update the message, and save the new state."""
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)
        await self._save_state()

    async def _open_section(self, interaction: discord.Interaction, section_index: int) -> None:
        """Show the section at "section_index" from its first page and record a view."""
        self.section_index = section_index
        self.content_page = 0
        self.mode = self.MODE_SECTION
        self._rebuild()
        opened_section = self.sections[self.section_index]
        await database.record_view(opened_section['id'], self.document, opened_section['slug'])
        await interaction.response.edit_message(embed=self.get_embed(), view=self)
        await self._save_state()

    async def _on_select(self, interaction: discord.Interaction) -> None:
        selected_index = int(interaction.data['values'][0])
        await self._open_section(interaction, selected_index)

    async def _on_toc_previous(self, interaction: discord.Interaction) -> None:
        self.table_of_contents_page -= 1
        await self._refresh_message(interaction)

    async def _on_toc_next(self, interaction: discord.Interaction) -> None:
        self.table_of_contents_page += 1
        await self._refresh_message(interaction)

    async def _on_back_to_toc(self, interaction: discord.Interaction) -> None:
        self.mode = self.MODE_TOC
        await self._refresh_message(interaction)

    async def _on_content_previous(self, interaction: discord.Interaction) -> None:
        self.content_page -= 1
        await self._refresh_message(interaction)

    async def _on_content_next(self, interaction: discord.Interaction) -> None:
        self.content_page += 1
        await self._refresh_message(interaction)

    async def _on_section_previous(self, interaction: discord.Interaction) -> None:
        await self._open_section(interaction, self.section_index - 1)

    async def _on_section_next(self, interaction: discord.Interaction) -> None:
        await self._open_section(interaction, self.section_index + 1)

    async def _switch_language(self, interaction: discord.Interaction, language_code: str) -> None:
        """Jump to the English ('en') or Chinese ('zh') version of the section."""
        if self._language_siblings and self._language_siblings.get(language_code) is not None:
            self.section_index = self._language_siblings[language_code]
            self.content_page = 0
            self._rebuild()
            opened_section = self.sections[self.section_index]
            await database.record_view(opened_section['id'], self.document, opened_section['slug'])
        await interaction.response.edit_message(embed=self.get_embed(), view=self)
        await self._save_state()

    async def _on_language_english(self, interaction: discord.Interaction) -> None:
        await self._switch_language(interaction, 'en')

    async def _on_language_chinese(self, interaction: discord.Interaction) -> None:
        await self._switch_language(interaction, 'zh')

    # ── persistence ──────────────────────────────────────────────────────────

    def _state(self) -> dict:
        return {
            'doc': self.document,
            'mode': self.mode,
            'toc_page': self.table_of_contents_page,
            'section_idx': self.section_index,
            'content_page': self.content_page,
        }

    async def _save_state(self) -> None:
        if self.message_id is not None:
            await view_store.save(self.message_id, 'PolicyBrowser', self._state())

    @classmethod
    def from_state(cls, state: dict, sections: list[dict]) -> 'PolicyBrowser':
        """Recreate a browser from a state saved before a restart."""
        browser = cls(sections, state['doc'])
        browser.mode = state['mode']
        browser.table_of_contents_page = state['toc_page']
        browser.section_index = state['section_idx']
        browser.content_page = state['content_page']
        browser._rebuild()
        return browser


class SectionContentView(discord.ui.View):
    """Content-only pagination for the /section direct-lookup command."""

    def __init__(self, section: dict, document: str) -> None:
        super().__init__(timeout=None)
        self.section = section
        self.document = document
        self.page = 0
        self.chunks, self.image_url = get_content_chunks_and_image(section)
        self.message_id: int | None = None
        self._rebuild()

    def get_embed(self) -> discord.Embed:
        return build_section_embed(
            self.section, self.document, self.page + 1, len(self.chunks), self.chunks,
            image_url=self.image_url,
        )

    def _rebuild(self) -> None:
        """Add Previous / Next page buttons when the text spans several pages."""
        self.clear_items()
        chunk_count = len(self.chunks)
        if chunk_count > 1:
            previous_button = discord.ui.Button(
                label='◀ Prev Page',
                style=discord.ButtonStyle.secondary,
                disabled=(self.page == 0),
                custom_id='scv:prev',
            )
            previous_button.callback = self._on_previous
            self.add_item(previous_button)

            next_button = discord.ui.Button(
                label='Next Page ▶',
                style=discord.ButtonStyle.secondary,
                disabled=(self.page >= chunk_count - 1),
                custom_id='scv:next',
            )
            next_button.callback = self._on_next
            self.add_item(next_button)

    async def _on_previous(self, interaction: discord.Interaction) -> None:
        self.page -= 1
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)
        await self._save_state()

    async def _on_next(self, interaction: discord.Interaction) -> None:
        self.page += 1
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)
        await self._save_state()

    # ── persistence ──────────────────────────────────────────────────────────

    def _state(self) -> dict:
        return {
            'doc': self.document,
            'slug': self.section['slug'],
            'page': self.page,
        }

    async def _save_state(self) -> None:
        if self.message_id is not None:
            await view_store.save(self.message_id, 'SectionContentView', self._state())

    @classmethod
    def from_state(cls, state: dict, section: dict) -> 'SectionContentView':
        """Recreate the view from a state saved before a restart."""
        content_view = cls(section, state['doc'])
        content_view.page = state['page']
        content_view._rebuild()
        return content_view


class SearchResultsView(discord.ui.View):
    """Select-menu view presented after a /search command."""

    def __init__(self, results: list[tuple[str, dict]], query: str) -> None:
        super().__init__(timeout=None)
        self.results = results[:25]  # Discord select menu max
        self.query = query
        self.message_id: int | None = None

        if self.results:
            options = []
            for result_index, (document_name, section) in enumerate(self.results):
                document_display_name = database.DOCUMENT_DISPLAY_NAMES.get(document_name, document_name)
                options.append(
                    discord.SelectOption(
                        label=section_label(section)[:DISCORD_TEXT_LIMIT_FOR_OPTIONS],
                        value=str(result_index),
                        description=f'{document_display_name} · {section["slug"]}'[:DISCORD_TEXT_LIMIT_FOR_OPTIONS],
                    )
                )
            result_select = discord.ui.Select(
                placeholder='Select a result to read…', options=options,
                custom_id='srv:sel',
            )
            result_select.callback = self._on_select
            self.add_item(result_select)

    async def _on_select(self, interaction: discord.Interaction) -> None:
        """Replace the results list with the chosen section's text."""
        selected_index = int(interaction.data['values'][0])
        document_name, section = self.results[selected_index]
        full_section = await database.fetch_section_by_slug(document_name, section['slug'])
        displayed_section = full_section or section
        await database.record_view(displayed_section['id'], document_name, displayed_section['slug'])

        content_view = SectionContentView(displayed_section, document_name)
        # Inherit this message's ID so the new view state overwrites ours in the DB
        content_view.message_id = interaction.message.id
        await interaction.response.edit_message(embed=content_view.get_embed(), view=content_view)
        await content_view._save_state()

    # ── persistence ──────────────────────────────────────────────────────────

    def _state(self) -> dict:
        saved_results = []
        for document_name, section in self.results:
            saved_results.append((document_name, section['slug']))
        return {
            'query': self.query,
            'results': saved_results,
        }

    async def _save_state(self) -> None:
        if self.message_id is not None:
            await view_store.save(self.message_id, 'SearchResultsView', self._state())

    @classmethod
    def from_state(cls, state: dict, results: list[tuple[str, dict]]) -> 'SearchResultsView':
        return cls(results, state['query'])


# ── Cog ──────────────────────────────────────────────────────────────────────


def _get_count_from_pair(section_id_and_count: tuple[str, int]) -> int:
    """Sort key for (section_id, view_count) pairs: the view count."""
    return section_id_and_count[1]


class PolicyCog(commands.Cog):
    """The /browse, /search, /top and /section slash commands."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(
        name='browse',
        description='Browse a GFTV policy document with an interactive table of contents.',
    )
    @app_commands.describe(document='The policy document to browse.')
    @app_commands.choices(document=DOCUMENT_CHOICES)
    async def browse(self, interaction: discord.Interaction, document: str) -> None:
        await interaction.response.defer()
        sections = await database.fetch_sections(document)
        if not sections:
            await interaction.followup.send(
                'No published sections found for that document.'
            )
            return
        browser_view = PolicyBrowser(sections, document)
        sent_message = await interaction.followup.send(embed=browser_view.get_embed(), view=browser_view)
        browser_view.message_id = sent_message.id
        await browser_view._save_state()

    @app_commands.command(
        name='search',
        description='Search for GFTV policy sections by keyword.',
    )
    @app_commands.describe(
        query='Keywords to search for in section titles and content.',
        document='Restrict the search to one document (optional).',
    )
    @app_commands.choices(document=DOCUMENT_CHOICES)
    async def search(
        self,
        interaction: discord.Interaction,
        query: str,
        document: Optional[str] = None,
    ) -> None:
        await interaction.response.defer()
        results = await database.search_sections(query, document)
        if not results:
            await interaction.followup.send(embed=build_no_results_embed(query))
            return
        embed = build_search_embed(results, query)
        results_view = SearchResultsView(results, query)
        sent_message = await interaction.followup.send(embed=embed, view=results_view)
        results_view.message_id = sent_message.id
        await results_view._save_state()

    @app_commands.command(
        name='top',
        description='Show the most-viewed GFTV policy sections.',
    )
    @app_commands.describe(document='Filter to a specific document (optional).')
    @app_commands.choices(document=DOCUMENT_CHOICES)
    async def top(
        self,
        interaction: discord.Interaction,
        document: Optional[str] = None,
    ) -> None:
        """Show the ten most-viewed sections, for one document or for all of them."""
        await interaction.response.defer()
        view_counts = await database.fetch_view_counts(document)
        if not view_counts:
            await interaction.followup.send(
                'No section views have been recorded yet.'
            )
            return

        if document:
            documents_to_include = [document]
        else:
            documents_to_include = list(database.DOCUMENT_TABLES)
        # section id → (section, document name), so view counts can be matched to sections
        section_lookup: dict[str, tuple[dict, str]] = {}
        for document_name in documents_to_include:
            for section in await database.fetch_sections(document_name):
                section_lookup[section['id']] = (section, document_name)

        entries = []
        sorted_view_counts = sorted(view_counts.items(), key=_get_count_from_pair, reverse=True)
        for section_id, view_count in sorted_view_counts:
            if section_id in section_lookup:
                section, document_name = section_lookup[section_id]
                entries.append((section, document_name, view_count))
        entries = entries[:TOP_SECTIONS_COUNT]

        if not entries:
            await interaction.followup.send(
                'No views found for the selected document.'
            )
            return

        await interaction.followup.send(embed=build_top_embed(entries, document))

    @app_commands.command(
        name='section',
        description='View a specific policy section directly by slug.',
    )
    @app_commands.describe(
        document='The policy document the section belongs to.',
        slug='The section slug (start typing to see autocomplete suggestions).',
    )
    @app_commands.choices(document=DOCUMENT_CHOICES)
    @app_commands.autocomplete(slug=_slug_autocomplete)
    async def section(
        self,
        interaction: discord.Interaction,
        document: str,
        slug: str,
    ) -> None:
        await interaction.response.defer()
        found_section = await database.fetch_section_by_slug(document, slug)
        if not found_section:
            await interaction.followup.send(
                f'No published section found with slug `{slug}` in that document.',
            )
            return
        await database.record_view(found_section['id'], document, slug)
        content_view = SectionContentView(found_section, document)
        sent_message = await interaction.followup.send(embed=content_view.get_embed(), view=content_view)
        content_view.message_id = sent_message.id
        await content_view._save_state()


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(PolicyCog(bot))
