"""Settings for the Discord bot, read from environment variables (or a .env file)."""

import os

from dotenv import load_dotenv

load_dotenv()


def _require(variable_name: str) -> str:
    """Return the value of a required environment variable, or stop with a clear error."""
    value = os.getenv(variable_name)
    if not value:
        raise RuntimeError(f'Missing required environment variable: {variable_name}')
    return value


DISCORD_TOKEN: str = _require('DISCORD_TOKEN')
SUPABASE_URL: str = _require('SUPABASE_URL')
SUPABASE_SERVICE_KEY: str = _require('SUPABASE_SERVICE_KEY')

# Optional: a server (guild) id to sync slash commands to instantly while testing
_guild_id_text = os.getenv('GUILD_ID')
GUILD_ID: int | None = None
if _guild_id_text:
    GUILD_ID = int(_guild_id_text)

EMBED_COLOR: int = 0xFEDC00
