import discord
from discord import app_commands
from discord.ext import commands

import config

COMMANDS_INFO: list[tuple[str, str]] = [
    (
        '/browse <document>',
        'Open an interactive table of contents for any of the six GFTV policy documents. '
        'Navigate pages with **◀ Prev / Next ▶** buttons, pick a section from the dropdown '
        'to read it in full, and use **◀ Prev Section / Next Section ▶** to step through the document.',
    ),
    (
        '/search <query> [document]',
        'Search section titles and body text across all policy documents, or restrict to one. '
        'Results appear in a dropdown — select any entry to read the full section.',
    ),
    (
        '/top [document]',
        'Show the ten most-viewed policy sections, ranked by total bot views. '
        'Optionally filter to a single document.',
    ),
    (
        '/section <document> <slug>',
        'Jump directly to a section by its slug. '
        'Autocomplete suggestions appear as you type, filtered by the chosen document.',
    ),
    (
        '/help',
        'Display this help message listing all available commands.',
    ),
]


class HelpCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(
        name='help',
        description='List all available GFTV PolicySpot commands.',
    )
    async def help_cmd(self, interaction: discord.Interaction) -> None:
        embed = discord.Embed(
            title='GFTV PolicySpot — Commands',
            description=(
                'All commands are Discord slash commands. '
                'Use the dropdowns and buttons that appear after each command to navigate.\n​'
            ),
            color=config.EMBED_COLOR,
        )
        for name, desc in COMMANDS_INFO:
            embed.add_field(name=name, value=desc, inline=False)
        embed.set_footer(text='GFTV PolicySpot · Only published sections are visible')
        await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(HelpCog(bot))
