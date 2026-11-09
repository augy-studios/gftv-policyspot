"""Direct Bot API HTTP calls for Telegram Rich Messages (Bot API 10.1+).

Telethon (this bot's MTProto client) has no support for sendRichMessage /
the rich_message param on editMessageText yet, so these calls go straight
to the HTTP Bot API using the same bot token Telethon logs in with.
"""

import httpx
from telegramify_markdown import richify

from config import TELEGRAM_BOT_TOKEN

_BOT_API_BASE_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
_REQUEST_TIMEOUT_SECONDS = 30


def _build_reply_markup(buttons: list | None) -> dict | None:
    """Convert build_*_keyboard()-style rows of Telethon Button.inline(...)
    objects into the inline_keyboard JSON the raw Bot API expects."""
    if not buttons:
        return None
    keyboard_rows = []
    for button_row in buttons:
        json_row = []
        for button in button_row:
            json_row.append({"text": button.text, "callback_data": button.data.decode()})
        keyboard_rows.append(json_row)
    return {"inline_keyboard": keyboard_rows}


async def send_rich_article(chat_id: int, markdown: str, buttons: list | None = None) -> int:
    """Send markdown as a Telegram Rich Message. Returns the new message_id."""
    payload = {
        "chat_id": chat_id,
        "rich_message": richify(markdown).to_dict(),
    }
    reply_markup = _build_reply_markup(buttons)
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as http_client:
        response = await http_client.post(f"{_BOT_API_BASE_URL}/sendRichMessage", json=payload)
        response.raise_for_status()
        return response.json()["result"]["message_id"]


async def edit_rich_article(chat_id: int, message_id: int, markdown: str, buttons: list | None = None) -> None:
    """Edit an existing message in place with new rich-message content."""
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "rich_message": richify(markdown).to_dict(),
    }
    reply_markup = _build_reply_markup(buttons)
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as http_client:
        response = await http_client.post(f"{_BOT_API_BASE_URL}/editMessageText", json=payload)
        response.raise_for_status()
