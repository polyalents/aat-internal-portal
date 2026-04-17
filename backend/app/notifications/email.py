import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
from typing import Sequence

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


def _normalize_recipients(to: str | Sequence[str]) -> list[str]:
    if isinstance(to, str):
        raw = [to]
    else:
        raw = list(to)

    recipients: list[str] = []
    seen: set[str] = set()

    for item in raw:
        email = (item or "").strip()
        if not email:
            continue

        key = email.lower()
        if key in seen:
            continue

        seen.add(key)
        recipients.append(email)

    return recipients


def _safe(value: str | None) -> str:
    value = (value or "").strip()
    return escape(value) if value else "—"


def _wrap_email(title: str, body: str) -> str:
    return f"""
    <html>
      <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <div style="max-width:700px;margin:0 auto;padding:24px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#0f172a 0%, #111b44 100%);padding:22px 26px;">
              <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">{escape(title)}</h2>
            </div>

            <div style="padding:26px;font-size:14px;line-height:1.65;">
              {body}
            </div>

            <div style="padding:14px 26px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
              Это автоматическое уведомление внутреннего портала AAT.
            </div>
          </div>
        </div>
      </body>
    </html>
    """


async def send_email(
    to: str | Sequence[str],
    subject: str,
    body_html: str,
) -> bool:
    if not settings.smtp_host:
        logger.warning("SMTP is not configured, skipping email to %s", to)
        return False

    recipients = _normalize_recipients(to)
    if not recipients:
        logger.warning("No valid recipients, skipping email with subject: %s", subject)
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            use_tls=settings.smtp_use_tls,
            timeout=15,
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
    body = f"""
    <p style="margin-top:0;">
      В системе зарегистрирована новая заявка, требующая внимания.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:7px 0;width:190px;"><b>Номер заявки:</b></td>
        <td style="padding:7px 0;">#{ticket_number}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Тема:</b></td>
        <td style="padding:7px 0;">{_safe(subject)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Приоритет:</b></td>
        <td style="padding:7px 0;">{_safe(priority)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Автор:</b></td>
        <td style="padding:7px 0;">{_safe(author_name)}</td>
      </tr>
    </table>

    <p style="margin:22px 0 0;">
      <a href="{escape(portal_url)}/tickets/{escape(str(ticket_id))}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:600;">
         Открыть заявку
      </a>
    </p>
    """
    return _wrap_email(f"Новая заявка #{ticket_number}", body)


def build_ticket_update_email(
    ticket_number: int,
    field: str,
    old_value: str | None,
    new_value: str | None,
    changed_by: str,
    portal_url: str,
    ticket_id: str,
) -> str:
    body = f"""
    <p style="margin-top:0;">
      По заявке внесены изменения.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:7px 0;width:190px;"><b>Номер заявки:</b></td>
        <td style="padding:7px 0;">#{ticket_number}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Изменено:</b></td>
        <td style="padding:7px 0;">{_safe(field)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Было:</b></td>
        <td style="padding:7px 0;">{_safe(old_value)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Стало:</b></td>
        <td style="padding:7px 0;">{_safe(new_value)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Изменил:</b></td>
        <td style="padding:7px 0;">{_safe(changed_by)}</td>
      </tr>
    </table>

    <p style="margin:22px 0 0;">
      <a href="{escape(portal_url)}/tickets/{escape(str(ticket_id))}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:600;">
         Открыть заявку
      </a>
    </p>
    """
    return _wrap_email(f"Обновление заявки #{ticket_number}", body)


def build_ticket_comment_email(
    ticket_number: int,
    comment_text: str,
    comment_author: str,
    portal_url: str,
    ticket_id: str,
) -> str:
    body = f"""
    <p style="margin-top:0;">
      По заявке добавлен новый комментарий.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:7px 0;width:190px;"><b>Номер заявки:</b></td>
        <td style="padding:7px 0;">#{ticket_number}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Автор комментария:</b></td>
        <td style="padding:7px 0;">{_safe(comment_author)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;vertical-align:top;"><b>Комментарий:</b></td>
        <td style="padding:7px 0;">{_safe(comment_text)}</td>
      </tr>
    </table>

    <p style="margin:22px 0 0;">
      <a href="{escape(portal_url)}/tickets/{escape(str(ticket_id))}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:600;">
         Открыть заявку
      </a>
    </p>
    """
    return _wrap_email(f"Комментарий по заявке #{ticket_number}", body)


def build_welcome_email(
    full_name: str,
    login: str,
    password: str,
    portal_url: str,
) -> str:
    body = f"""
    <p style="margin-top:0;">Здравствуйте, {_safe(full_name)}.</p>

    <p>
      Для вас создана учётная запись во внутреннем портале AAT.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:7px 0;width:190px;"><b>Логин:</b></td>
        <td style="padding:7px 0;">{_safe(login)}</td>
      </tr>
      <tr>
        <td style="padding:7px 0;"><b>Пароль:</b></td>
        <td style="padding:7px 0;">{_safe(password)}</td>
      </tr>
    </table>

    <p style="margin:22px 0 0;">
      <a href="{escape(portal_url)}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:600;">
         Перейти в портал
      </a>
    </p>
    """
    return _wrap_email("Доступ к внутреннему порталу", body)