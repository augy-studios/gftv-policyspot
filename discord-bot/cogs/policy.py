from __future__ import annotations

import logging
import re
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

import utils.db as db
from utils.embeds import (
    build_no_results_embed,
    build_search_embed,
    build_section_embed,
    build_toc_embed,
    build_top_embed,
    get_content_chunks_and_image,
    section_label,
)

log = logging.getLogger('policyspot.policy')

DOC_CHOICES = [
    app_commands.Choice(name='Charter',                 value='charter'),
    app_commands.Choice(name='News Standards',          value='news'),
    app_commands.Choice(name='Programme Rating System', value='prs'),
    app_commands.Choice(name='Community Rules',         value='rules'),
    app_commands.Choice(name='Join GFTV',               value='join'),
    app_commands.Choice(name='Legal',                   value='legal'),
]

TOC_PER_PAGE = 10

_EN_TITLE_RE = re.compile(r'^english$', re.IGNORECASE)
_ZH_TITLE_RE = re.compile(r'^中文$|^chinese$', re.IGNORECASE)


def _find_lang_siblings(sections: list[dict], idx: int) -> dict[str, int] | None:
    """Return {'en': idx, 'zh': idx} if the section is a language variant with a sibling."""
    sec = sections[idx]
    title = (sec.get('title') or '').strip()
    parent_id = sec.get('parent_id')
    if parent_id is None:
        return None
    if not (_EN_TITLE_RE.search(title) or _ZH_TITLE_RE.search(title)):
        return None
    siblings: dict[str, int | None] = {'en': None, 'zh': None}
    for i, s in enumerate(sections):
        if s.get('parent_id') != parent_id:
            continue
        t = (s.get('title') or '').strip()
        if _EN_TITLE_RE.search(t):
            siblings['en'] = i
        elif _ZH_TITLE_RE.search(t):
            siblings['zh'] = i
    if siblings['en'] is not None and siblings['zh'] is not None:
        return siblings  # type: ignore[return-value]
    return None


async def _slug_autocomplete(
    interaction: discord.Interaction, current: str
) -> list[app_commands.Choice[str]]:
    doc = getattr(interaction.namespace, 'document', None)
    if not doc or doc not in db.DOC_TABLES:
        return []
    try:
        sections = await db.fetch_sections(doc)
    except Exception:
        return []
    q = current.lower()
    choices = []
    for s in sections:
        if not q or q in s['slug'].lower() or q in s['title'].lower():
            choices.append(app_commands.Choice(name=section_label(s)[:100], value=s['slug']))
    return choices[:25]


# ── Views ────────────────────────────────────────────────────────────────────


class PolicyBrowser(discord.ui.View):
    """Interactive browser: TOC select + per-section reading with pagination."""

    MODE_TOC = 'toc'
    MODE_SECTION = 'section'

    def __init__(self, sections: list[dict], doc: str) -> None:
        super().__init__(timeout=300)
        self.sections = sections
        self.doc = doc
        self.mode = self.MODE_TOC
        self.toc_page = 0
        self.section_idx = 0
        self.content_page = 0
        self._chunks: list[str] = []
        self._image_url: str | None = None
        self._lang_siblings: dict[str, int] | None = None
        self.message: discord.Message | None = None
        self._rebuild()

    # ── embed ────────────────────────────────────────────────────────────────

    def get_embed(self) -> discord.Embed:
        total_toc = max(1, (len(self.sections) + TOC_PER_PAGE - 1) // TOC_PER_PAGE)
        if self.mode == self.MODE_TOC:
            return build_toc_embed(
                self.sections, self.doc, self.toc_page + 1, total_toc, TOC_PER_PAGE
            )
        section = self.sections[self.section_idx]
        return build_section_embed(
            section, self.doc, self.content_page + 1, len(self._chunks), self._chunks,
            image_url=self._image_url,
        )

    # ── item builder ─────────────────────────────────────────────────────────

    def _rebuild(self) -> None:
        self.clear_items()
        if self.mode == self.MODE_TOC:
            self._build_toc_items()
        else:
            self._chunks, self._image_url = get_content_chunks_and_image(
                self.sections[self.section_idx]
            )
            self._lang_siblings = _find_lang_siblings(self.sections, self.section_idx)
            self._build_section_items()

    def _build_toc_items(self) -> None:
        total_toc = max(1, (len(self.sections) + TOC_PER_PAGE - 1) // TOC_PER_PAGE)
        start = self.toc_page * TOC_PER_PAGE
        page_sections = self.sections[start : start + TOC_PER_PAGE]

        if page_sections:
            options = []
            for i, s in enumerate(page_sections):
                sec_type = 'Subsection' if s.get('type') == 'subsection' else 'Section'
                options.append(
                    discord.SelectOption(
                        label=section_label(s)[:100],
                        value=str(start + i),
                        description=f'{sec_type} · {s["slug"]}'[:100],
                    )
                )
            sel = discord.ui.Select(
                placeholder='Select a section to read…', options=options, row=0
            )
            sel.callback = self._on_select
            self.add_item(sel)

        prev_btn = discord.ui.Button(
            label='◀ Prev',
            style=discord.ButtonStyle.secondary,
            disabled=(self.toc_page == 0),
            row=1,
        )
        prev_btn.callback = self._on_toc_prev
        self.add_item(prev_btn)

        next_btn = discord.ui.Button(
            label='Next ▶',
            style=discord.ButtonStyle.secondary,
            disabled=(self.toc_page >= total_toc - 1),
            row=1,
        )
        next_btn.callback = self._on_toc_next
        self.add_item(next_btn)

    def _build_section_items(self) -> None:
        n_chunks = len(self._chunks)

        toc_btn = discord.ui.Button(
            label='📋 Table of Contents', style=discord.ButtonStyle.secondary, row=0
        )
        toc_btn.callback = self._on_back_to_toc
        self.add_item(toc_btn)

        # Language toggle buttons for bilingual sections (English / 中文 subsections)
        if self._lang_siblings:
            en_idx = self._lang_siblings.get('en')
            zh_idx = self._lang_siblings.get('zh')
            is_en = (self.section_idx == en_idx)

            en_btn = discord.ui.Button(
                label='🇬🇧 English',
                style=discord.ButtonStyle.primary if is_en else discord.ButtonStyle.secondary,
                row=0,
            )
            en_btn.callback = self._on_lang_en
            self.add_item(en_btn)

            zh_btn = discord.ui.Button(
                label='🇨🇳 中文',
                style=discord.ButtonStyle.primary if not is_en else discord.ButtonStyle.secondary,
                row=0,
            )
            zh_btn.callback = self._on_lang_zh
            self.add_item(zh_btn)

        if n_chunks > 1:
            cp_prev = discord.ui.Button(
                label='◀ Prev Page',
                style=discord.ButtonStyle.secondary,
                disabled=(self.content_page == 0),
                row=1,
            )
            cp_prev.callback = self._on_content_prev
            self.add_item(cp_prev)

            cp_next = discord.ui.Button(
                label='Next Page ▶',
                style=discord.ButtonStyle.secondary,
                disabled=(self.content_page >= n_chunks - 1),
                row=1,
            )
            cp_next.callback = self._on_content_next
            self.add_item(cp_next)

        sp_prev = discord.ui.Button(
            label='◀ Prev Section',
            style=discord.ButtonStyle.primary,
            disabled=(self.section_idx == 0),
            row=2,
        )
        sp_prev.callback = self._on_section_prev
        self.add_item(sp_prev)

        sp_next = discord.ui.Button(
            label='Next Section ▶',
            style=discord.ButtonStyle.primary,
            disabled=(self.section_idx >= len(self.sections) - 1),
            row=2,
        )
        sp_next.callback = self._on_section_next
        self.add_item(sp_next)

    # ── callbacks ────────────────────────────────────────────────────────────

    async def _on_select(self, interaction: discord.Interaction) -> None:
        idx = int(interaction.data['values'][0])
        self.section_idx = idx
        self.content_page = 0
        self.mode = self.MODE_SECTION
        self._rebuild()
        s = self.sections[idx]
        await db.record_view(s['id'], self.doc, s['slug'])
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_toc_prev(self, interaction: discord.Interaction) -> None:
        self.toc_page -= 1
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_toc_next(self, interaction: discord.Interaction) -> None:
        self.toc_page += 1
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_back_to_toc(self, interaction: discord.Interaction) -> None:
        self.mode = self.MODE_TOC
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_content_prev(self, interaction: discord.Interaction) -> None:
        self.content_page -= 1
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_content_next(self, interaction: discord.Interaction) -> None:
        self.content_page += 1
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_section_prev(self, interaction: discord.Interaction) -> None:
        self.section_idx -= 1
        self.content_page = 0
        self.mode = self.MODE_SECTION
        self._rebuild()
        s = self.sections[self.section_idx]
        await db.record_view(s['id'], self.doc, s['slug'])
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_section_next(self, interaction: discord.Interaction) -> None:
        self.section_idx += 1
        self.content_page = 0
        self.mode = self.MODE_SECTION
        self._rebuild()
        s = self.sections[self.section_idx]
        await db.record_view(s['id'], self.doc, s['slug'])
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_lang_en(self, interaction: discord.Interaction) -> None:
        if self._lang_siblings and self._lang_siblings.get('en') is not None:
            self.section_idx = self._lang_siblings['en']
            self.content_page = 0
            self._rebuild()
            s = self.sections[self.section_idx]
            await db.record_view(s['id'], self.doc, s['slug'])
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_lang_zh(self, interaction: discord.Interaction) -> None:
        if self._lang_siblings and self._lang_siblings.get('zh') is not None:
            self.section_idx = self._lang_siblings['zh']
            self.content_page = 0
            self._rebuild()
            s = self.sections[self.section_idx]
            await db.record_view(s['id'], self.doc, s['slug'])
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def on_timeout(self) -> None:
        for item in self.children:
            item.disabled = True
        if self.message:
            try:
                await self.message.edit(view=self)
            except discord.HTTPException:
                pass


class SectionContentView(discord.ui.View):
    """Content-only pagination for the /section direct-lookup command."""

    def __init__(self, section: dict, doc: str) -> None:
        super().__init__(timeout=300)
        self.section = section
        self.doc = doc
        self.page = 0
        self.chunks, self.image_url = get_content_chunks_and_image(section)
        self.message: discord.Message | None = None
        self._rebuild()

    def get_embed(self) -> discord.Embed:
        return build_section_embed(
            self.section, self.doc, self.page + 1, len(self.chunks), self.chunks,
            image_url=self.image_url,
        )

    def _rebuild(self) -> None:
        self.clear_items()
        n = len(self.chunks)
        if n > 1:
            prev_btn = discord.ui.Button(
                label='◀ Prev Page',
                style=discord.ButtonStyle.secondary,
                disabled=(self.page == 0),
            )
            prev_btn.callback = self._on_prev
            self.add_item(prev_btn)

            next_btn = discord.ui.Button(
                label='Next Page ▶',
                style=discord.ButtonStyle.secondary,
                disabled=(self.page >= n - 1),
            )
            next_btn.callback = self._on_next
            self.add_item(next_btn)

    async def _on_prev(self, interaction: discord.Interaction) -> None:
        self.page -= 1
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def _on_next(self, interaction: discord.Interaction) -> None:
        self.page += 1
        self._rebuild()
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    async def on_timeout(self) -> None:
        for item in self.children:
            item.disabled = True
        if self.message:
            try:
                await self.message.edit(view=self)
            except discord.HTTPException:
                pass


class SearchResultsView(discord.ui.View):
    """Select-menu view presented after a /search command."""

    def __init__(self, results: list[tuple[str, dict]], query: str) -> None:
        super().__init__(timeout=180)
        self.results = results[:25]  # Discord select menu max
        self.query = query
        self.message: discord.Message | None = None

        if self.results:
            options = []
            for i, (doc, s) in enumerate(self.results):
                doc_name = db.DOC_DISPLAY.get(doc, doc)
                options.append(
                    discord.SelectOption(
                        label=section_label(s)[:100],
                        value=str(i),
                        description=f'{doc_name} · {s["slug"]}'[:100],
                    )
                )
            sel = discord.ui.Select(
                placeholder='Select a result to read…', options=options
            )
            sel.callback = self._on_select
            self.add_item(sel)

    async def _on_select(self, interaction: discord.Interaction) -> None:
        idx = int(interaction.data['values'][0])
        doc, section = self.results[idx]
        full = await db.fetch_section_by_slug(doc, section['slug'])
        displayed = full or section
        await db.record_view(displayed['id'], doc, displayed['slug'])

        view = SectionContentView(displayed, doc)
        view.message = interaction.message
        await interaction.response.edit_message(embed=view.get_embed(), view=view)

    async def on_timeout(self) -> None:
        for item in self.children:
            item.disabled = True
        if self.message:
            try:
                await self.message.edit(view=self)
            except discord.HTTPException:
                pass


# ── Cog ──────────────────────────────────────────────────────────────────────


class PolicyCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(
        name='browse',
        description='Browse a GFTV policy document with an interactive table of contents.',
    )
    @app_commands.describe(document='The policy document to browse.')
    @app_commands.choices(document=DOC_CHOICES)
    async def browse(self, interaction: discord.Interaction, document: str) -> None:
        await interaction.response.defer()
        sections = await db.fetch_sections(document)
        if not sections:
            await interaction.followup.send(
                'No published sections found for that document.', ephemeral=True
            )
            return
        view = PolicyBrowser(sections, document)
        msg = await interaction.followup.send(embed=view.get_embed(), view=view)
        view.message = msg

    @app_commands.command(
        name='search',
        description='Search for GFTV policy sections by keyword.',
    )
    @app_commands.describe(
        query='Keywords to search for in section titles and content.',
        document='Restrict the search to one document (optional).',
    )
    @app_commands.choices(document=DOC_CHOICES)
    async def search(
        self,
        interaction: discord.Interaction,
        query: str,
        document: Optional[str] = None,
    ) -> None:
        await interaction.response.defer()
        results = await db.search_sections(query, document)
        if not results:
            await interaction.followup.send(embed=build_no_results_embed(query))
            return
        embed = build_search_embed(results, query)
        view = SearchResultsView(results, query)
        msg = await interaction.followup.send(embed=embed, view=view)
        view.message = msg

    @app_commands.command(
        name='top',
        description='Show the most-viewed GFTV policy sections.',
    )
    @app_commands.describe(document='Filter to a specific document (optional).')
    @app_commands.choices(document=DOC_CHOICES)
    async def top(
        self,
        interaction: discord.Interaction,
        document: Optional[str] = None,
    ) -> None:
        await interaction.response.defer()
        view_counts = await db.fetch_view_counts(document)
        if not view_counts:
            await interaction.followup.send(
                'No section views have been recorded yet.', ephemeral=True
            )
            return

        docs = [document] if document else list(db.DOC_TABLES)
        section_map: dict[str, tuple[dict, str]] = {}
        for d in docs:
            for s in await db.fetch_sections(d):
                section_map[s['id']] = (s, d)

        entries = [
            (section_map[sid][0], section_map[sid][1], cnt)
            for sid, cnt in sorted(view_counts.items(), key=lambda x: x[1], reverse=True)
            if sid in section_map
        ][:10]

        if not entries:
            await interaction.followup.send(
                'No views found for the selected document.', ephemeral=True
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
    @app_commands.choices(document=DOC_CHOICES)
    @app_commands.autocomplete(slug=_slug_autocomplete)
    async def section(
        self,
        interaction: discord.Interaction,
        document: str,
        slug: str,
    ) -> None:
        await interaction.response.defer()
        sec = await db.fetch_section_by_slug(document, slug)
        if not sec:
            await interaction.followup.send(
                f'No published section found with slug `{slug}` in that document.',
                ephemeral=True,
            )
            return
        await db.record_view(sec['id'], document, slug)
        view = SectionContentView(sec, document)
        msg = await interaction.followup.send(embed=view.get_embed(), view=view)
        view.message = msg


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(PolicyCog(bot))
