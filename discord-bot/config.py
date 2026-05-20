import os

from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f'Missing required environment variable: {key}')
    return val


DISCORD_TOKEN: str = _require('DISCORD_TOKEN')
SUPABASE_URL: str = _require('SUPABASE_URL')
SUPABASE_SERVICE_KEY: str = _require('SUPABASE_SERVICE_KEY')

_guild_id = os.getenv('GUILD_ID')
GUILD_ID: int | None = int(_guild_id) if _guild_id else None

EMBED_COLOR: int = 0xFEDC00
