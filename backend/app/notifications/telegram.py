import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


async def send_telegram_message(
    text: str,
    chat_id: str | None = None,
) -> bool:
    """Send message to Telegram."""
    token = settings.telegram_bot_token
    target_chat = chat_id or settings.telegram_chat_id

    if not token or not target_chat:
        logger.warning("Telegram not configured, skipping message")
        return False

    url = TELEGRAM_API.format(token=token)

    payload = {
        "chat_id": target_chat,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, json=payload)

        if response.status_code != 200:
            logger.error(
                "Telegram API error: %s %s",
                response.status_code,
                response.text,
            )
            return False

        data = response.json()
        if not data.get("ok"):
            logger.error("Telegram API returned not ok: %s", data)
            return False

        logger.info("Telegram message sent to %s", target_chat)
        return True

    except Exception:
        logger.exception("Failed to send Telegram message")
        return False


def build_new_ticket_text(
    ticket_number: int,
    subject: str,
    priority: str,
    author_name: str,
    portal_url: str,
    ticket_id: str,
) -> str:
    priority_emoji = {
        "now": "🔴",
        "today": "🟡",
        "normal": "🟢",
    }.get(priority, "⚪")

    return (
        f"{priority_emoji} <b>Новая заявка #{ticket_number}</b>\n\n"
        f"<b>Тема:</b> {subject}\n"
        f"<b>Приоритет:</b> {priority}\n"
        f"<b>Автор:</b> {author_name}\n\n"
        f'<a href="{portal_url}/tickets/{ticket_id}">Открыть в портале</a>'
    )