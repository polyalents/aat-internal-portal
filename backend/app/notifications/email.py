import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Sequence

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to: str | Sequence[str],
    subject: str,
    body_html: str,
) -> bool:
    """Send email via SMTP."""
    if not settings.smtp_host:
        logger.warning("SMTP not configured, skipping email to %s", to)
        return False

    recipients = [to] if isinstance(to, str) else list(to)

    msg = MIMEMultipart("alternative")
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject

    msg.attach(MIMEText(body_html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            use_tls=settings.smtp_use_tls,
            timeout=10,
        )
        logger.info("Email sent to %s: %s", recipients, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", recipients)
        return False


def build_new_ticket_email(
    ticket_number: int,
    subject: str,
    priority: str,
    author_name: str,
    portal_url: str,
    ticket_id: str,
) -> str:
    return f"""
    <h3>Новая заявка #{ticket_number}</h3>
    <p><b>Тема:</b> {subject}</p>
    <p><b>Приоритет:</b> {priority}</p>
    <p><b>Автор:</b> {author_name}</p>
    <p><a href="{portal_url}/tickets/{ticket_id}">Открыть заявку</a></p>
    """


def build_ticket_update_email(
    ticket_number: int,
    field: str,
    old_value: str,
    new_value: str,
    changed_by: str,
    portal_url: str,
    ticket_id: str,
) -> str:
    return f"""
    <h3>Обновление заявки #{ticket_number}</h3>
    <p><b>Изменено:</b> {field}</p>
    <p><b>Было:</b> {old_value or '—'}</p>
    <p><b>Стало:</b> {new_value}</p>
    <p><b>Изменил:</b> {changed_by}</p>
    <p><a href="{portal_url}/tickets/{ticket_id}">Открыть заявку</a></p>
    """