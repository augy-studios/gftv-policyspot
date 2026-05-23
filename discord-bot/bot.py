import logging

import discord
from discord.ext import commands

import config
import utils.db as db
import utils.view_store as view_store

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('policyspot')


class PolicySpotBot(commands.Bot):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        super().__init__(command_prefix=commands.when_mentioned, intents=intents)

    async def setup_hook(self) -> None:
        await view_store.init_db()
        await self.load_extension('cogs.policy')
        await self.load_extension('cogs.help_cog')
        await self._restore_views()
        if config.GUILD_ID:
            guild = discord.Object(id=config.GUILD_ID)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            log.info('Slash commands synced to guild %s', config.GUILD_ID)
        await self.tree.sync()
        log.info('Slash commands synced globally (may take up to 1 hour)')

    async def _restore_views(self) -> None:
        from cogs.policy import PolicyBrowser, SearchResultsView, SectionContentView

        entries = await view_store.load_all()
        restored = 0
        stale: list[int] = []

        for message_id, view_type, state in entries:
            try:
                view: discord.ui.View | None = None

                if view_type == 'PolicyBrowser':
                    sections = await db.fetch_sections(state['doc'])
                    if sections:
                        view = PolicyBrowser.from_state(state, sections)

                elif view_type == 'SectionContentView':
                    section = await db.fetch_section_by_slug(state['doc'], state['slug'])
                    if section:
                        view = SectionContentView.from_state(state, section)

                elif view_type == 'SearchResultsView':
                    results: list[tuple[str, dict]] = []
                    for doc, slug in state['results']:
                        sec = await db.fetch_section_by_slug(doc, slug)
                        if sec:
                            results.append((doc, sec))
                    if results:
                        view = SearchResultsView.from_state(state, results)

                if view is not None:
                    self.add_view(view, message_id=message_id)
                    restored += 1
                else:
                    stale.append(message_id)
            except Exception:
                log.exception('Failed to restore view for message %s', message_id)
                stale.append(message_id)

        for message_id in stale:
            await view_store.delete(message_id)

        log.info('Restored %d persistent view(s); pruned %d stale.', restored, len(stale))

    async def on_ready(self) -> None:
        assert self.user is not None
        log.info('Logged in as %s (ID: %s)', self.user, self.user.id)
        await self.change_presence(
            status=discord.Status.online,
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name='GFTV communities',
            )
        )


bot = PolicySpotBot()

if __name__ == '__main__':
    bot.run(config.DISCORD_TOKEN, log_handler=None)
