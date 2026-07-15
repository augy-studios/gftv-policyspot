"""Direct Bot API HTTP calls for Telegram Rich Messages (Bot API 10.1+).

Telethon (this bot's MTProto client) has no support for sendRichMessage /
the rich_message param on editMessageText yet, so these calls go straight
to the HTTP Bot API using the same bot token Telethon logs in with.
"""

import httpx
from telegramify_markdown import richify

from config import TELEGRAM_BOT_TOKEN

_API = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
_TIMEOUT = 30


def _reply_markup(buttons: list | None) -> dict | None:
    """Convert kb_*()-style rows of Telethon Button.inline(...) objects into
    the inline_keyboard JSON the raw Bot API expects."""
    if not buttons:
        return None
    return {
        "inline_keyboard": [
            [{"text": btn.text, "callback_data": btn.data.decode()} for btn in row]
            for row in buttons
        ]
    }


async def send_rich_article(chat_id: int, markdown: str, buttons: list | None = None) -> int:
    """Send markdown as a Telegram Rich Message. Returns the new message_id."""
    payload = {
        "chat_id": chat_id,
        "rich_message": richify(markdown).to_dict(),
    }
    reply_markup = _reply_markup(buttons)
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(f"{_API}/sendRichMessage", json=payload)
        resp.raise_for_status()
        return resp.json()["result"]["message_id"]


async def edit_rich_article(chat_id: int, message_id: int, markdown: str, buttons: list | None = None) -> None:
    """Edit an existing message in place with new rich-message content."""
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "rich_message": richify(markdown).to_dict(),
    }
    reply_markup = _reply_markup(buttons)
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(f"{_API}/editMessageText", json=payload)
        resp.raise_for_status()
