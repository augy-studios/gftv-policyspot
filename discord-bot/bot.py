"""GFTV PolicySpot Discord bot: start-up, slash-command syncing and
restoring the interactive messages that were open before a restart."""

import logging

import discord
from discord.ext import commands

import config
import utils.db as database
import utils.view_store as view_store

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger('policyspot')


class PolicySpotBot(commands.Bot):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        super().__init__(command_prefix=commands.when_mentioned, intents=intents)

    async def setup_hook(self) -> None:
        """Runs once before the bot connects: load commands, restore views, sync commands."""
        await view_store.init_db()
        await self.load_extension('cogs.policy')
        await self.load_extension('cogs.help_cog')
        await self._restore_views()
        if config.GUILD_ID:
            guild = discord.Object(id=config.GUILD_ID)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            logger.info('Slash commands synced to guild %s', config.GUILD_ID)
        await self.tree.sync()
        logger.info('Slash commands synced globally (may take up to 1 hour)')

    async def _restore_views(self) -> None:
        """Re-attach the buttons and menus of interactive messages sent before
        the last restart, using the states saved in view_store. Saved states
        whose sections no longer exist are deleted."""
        from cogs.policy import PolicyBrowser, SearchResultsView, SectionContentView

        saved_views = await view_store.load_all()
        restored_count = 0
        stale_message_ids: list[int] = []

        for message_id, view_type, state in saved_views:
            try:
                view: discord.ui.View | None = None

                if view_type == 'PolicyBrowser':
                    sections = await database.fetch_sections(state['doc'])
                    if sections:
                        view = PolicyBrowser.from_state(state, sections)

                elif view_type == 'SectionContentView':
                    section = await database.fetch_section_by_slug(state['doc'], state['slug'])
                    if section:
                        view = SectionContentView.from_state(state, section)

                elif view_type == 'SearchResultsView':
                    results: list[tuple[str, dict]] = []
                    for document_name, slug in state['results']:
                        found_section = await database.fetch_section_by_slug(document_name, slug)
                        if found_section:
                            results.append((document_name, found_section))
                    if results:
                        view = SearchResultsView.from_state(state, results)

                if view is not None:
                    self.add_view(view, message_id=message_id)
                    restored_count += 1
                else:
                    stale_message_ids.append(message_id)
            except Exception:
                logger.exception('Failed to restore view for message %s', message_id)
                stale_message_ids.append(message_id)

        for message_id in stale_message_ids:
            await view_store.delete(message_id)

        logger.info('Restored %d persistent view(s); pruned %d stale.', restored_count, len(stale_message_ids))

    async def on_ready(self) -> None:
        assert self.user is not None
        logger.info('Logged in as %s (ID: %s)', self.user, self.user.id)
        guild_count = len(self.guilds)
        await self.change_presence(
            status=discord.Status.online,
            activity=discord.CustomActivity(
                name=f'Watching {guild_count} GFTV communities',
            )
        )


bot = PolicySpotBot()

if __name__ == '__main__':
    bot.run(config.DISCORD_TOKEN, log_handler=None)
