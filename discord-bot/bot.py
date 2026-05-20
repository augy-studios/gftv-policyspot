import logging

import discord
from discord.ext import commands

import config

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
        await self.load_extension('cogs.policy')
        await self.load_extension('cogs.help_cog')
        if config.GUILD_ID:
            guild = discord.Object(id=config.GUILD_ID)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            log.info('Slash commands synced to guild %s', config.GUILD_ID)
        else:
            await self.tree.sync()
            log.info('Slash commands synced globally (may take up to 1 hour)')

    async def on_ready(self) -> None:
        assert self.user is not None
        log.info('Logged in as %s (ID: %s)', self.user, self.user.id)
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name='GFTV policies',
            )
        )


bot = PolicySpotBot()

if __name__ == '__main__':
    bot.run(config.DISCORD_TOKEN, log_handler=None)
