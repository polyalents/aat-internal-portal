"""
Ticket background tasks.

These tasks run in Celery workers using synchronous DB access,
because Celery workers are synchronous by default.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import create_engine, select
from sqlalchemy.orm import joinedload, sessionmaker

from app.config import settings
from app.notifications.email import (
    build_new_ticket_email,
    build_ticket_comment_email,
    build_ticket_update_email,
    build_welcome_email,
    send_email,
)
from app.notifications.telegram import build_new_ticket_text, send_telegram_message
from app.tasks import model_registry  # noqa: F401
from app.tasks.celery_app import celery_app
from app.tickets.enums import TicketStatus
from app.tickets.models import Ticket, TicketHistory
from app.users.models import User, UserRole

logger = logging.getLogger(__name__)

SYNC_DB_URL = settings.database_url.replace("+asyncpg", "+psycopg2")
sync_engine = create_engine(
    SYNC_DB_URL,
    pool_size=5,
    max_overflow=2,
    pool_pre_ping=True,
)
SyncSession = sessionmaker(bind=sync_engine)


def _dedupe_emails(emails: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()

    for email in emails:
        value = (email or "").strip()
        if not value:
            continue

        key = value.lower()
        if key in seen:
            continue

        seen.add(key)
        result.append(value)

    return result


def _user_display_name(user: User | None) -> str:
    if user is None:
        return "Неизвестно"

    if getattr(user, "employee", None) is not None and user.employee.full_name:
        return user.employee.full_name

    return user.username


def _resolve_user_name_by_id(db, user_id: str | None) -> str:
    if not user_id:
        return "—"

    try:
        user_uuid = UUID(user_id)
    except Exception:
        return user_id

    user = db.execute(
        select(User)
        .options(joinedload(User.employee))
        .where(User.id == user_uuid)
    ).scalar_one_or_none()

    if user is None:
        return "—"

    return _user_display_name(user)


def _field_label(field: str) -> str:
    mapping = {
        "status": "Статус",
        "assignee_id": "Исполнитель",
        "priority": "Приоритет",
        "comment": "Комментарий",
        "archived": "Архивация",
    }
    return mapping.get(field, field)


def _status_label(value: str | None) -> str:
    mapping = {
        "new": "Новая",
        "in_progress": "В работе",
        "waiting": "Ожидание",
        "escalated": "Эскалация",
        "completed": "Завершена",
        "rejected": "Отклонена",
    }
    if not value:
        return "—"
    return mapping.get(value, value)


def _priority_label(value: str | None) -> str:
    mapping = {
        "now": "Сейчас",
        "today": "Сегодня",
        "normal": "В рабочем порядке",
    }
    if not value:
        return "—"
    return mapping.get(value, value)


def _humanize_ticket_change(
    field: str,
    old_value: str | None,
    new_value: str | None,
) -> tuple[str, str, str]:
    label = _field_label(field)

    if field == "status":
        return label, _status_label(old_value), _status_label(new_value)

    if field == "priority":
        return label, _priority_label(old_value), _priority_label(new_value)

    return label, old_value or "—", new_value or "—"


def _is_employee_on_vacation(user: User | None, today: date) -> bool:
    if user is None or getattr(user, "employee", None) is None:
        return False

    employee = user.employee
    if employee.vacation_start and employee.vacation_end:
        return employee.vacation_start <= today <= employee.vacation_end

    return False


def _get_admin_recipients(db) -> list[str]:
    admins = db.execute(
        select(User)
        .options(joinedload(User.employee))
        .where(
            User.is_active == True,  # noqa: E712
            User.role == UserRole.admin,
        )
    ).scalars().all()

    today = date.today()
    recipients: list[str] = []

    for user in admins:
        if _is_employee_on_vacation(user, today):
            continue

        if user.email:
            recipients.append(user.email)

    return _dedupe_emails(recipients)


def _get_author_assignee_recipients(ticket: Ticket) -> list[str]:
    recipients: list[str] = []

    if ticket.author and ticket.author.email:
        recipients.append(ticket.author.email)

    if ticket.assignee and ticket.assignee.email:
        recipients.append(ticket.assignee.email)

    return _dedupe_emails(recipients)


def _build_update_subject(ticket_number: int, field: str) -> str:
    if field == "status":
        return f"Заявка #{ticket_number}: изменён статус"
    if field == "priority":
        return f"Заявка #{ticket_number}: изменён приоритет"
    if field == "assignee_id":
        return f"Заявка #{ticket_number}: назначен исполнитель"
    if field == "archived":
        return f"Заявка #{ticket_number}: изменён архивный статус"
    if field == "comment":
        return f"Заявка #{ticket_number}: новый комментарий"

    return f"Обновление заявки #{ticket_number}"


@celery_app.task(name="app.tasks.ticket_tasks.check_escalation")
def check_escalation() -> dict:
    """
    Find tickets with status 'new' that have been unassigned longer than
    ESCALATION_TIMEOUT_MINUTES and escalate them.
    """
    timeout = settings.escalation_timeout_minutes
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeout)
    escalated_count = 0

    with SyncSession() as db:
        it_manager = db.execute(
            select(User).where(
                User.is_it_manager == True,  # noqa: E712
                User.is_active == True,  # noqa: E712
            )
        ).scalar_one_or_none()

        if it_manager is None:
            logger.warning("No active IT Manager found. Escalation skipped.")
            return {"escalated": 0, "reason": "no_it_manager"}

        assignee = it_manager

        stale_tickets = db.execute(
            select(Ticket)
            .where(
                Ticket.status == TicketStatus.new,
                Ticket.assignee_id.is_(None),
                Ticket.created_at <= cutoff,
            )
            .with_for_update(skip_locked=True)
        ).scalars().all()

        now = datetime.now(timezone.utc)

        for ticket in stale_tickets:
            old_status = ticket.status.value
            ticket.status = TicketStatus.escalated
            ticket.escalated_at = now
            ticket.assignee_id = assignee.id

            db.add(
                TicketHistory(
                    ticket_id=ticket.id,
                    changed_by=assignee.id,
                    field="status",
                    old_value=old_status,
                    new_value=TicketStatus.escalated.value,
                )
            )

            db.add(
                TicketHistory(
                    ticket_id=ticket.id,
                    changed_by=assignee.id,
                    field="assignee_id",
                    old_value=None,
                    new_value=str(assignee.id),
                )
            )

            escalated_count += 1
            logger.info(
                "Escalated ticket #%s to %s",
                ticket.number,
                assignee.username,
            )

        db.commit()

    return {"escalated": escalated_count}


@celery_app.task(name="app.tasks.ticket_tasks.notify_new_ticket")
def notify_new_ticket(ticket_id: str) -> dict:
    """Send notifications for a new ticket to admins only."""
    ticket_uuid = UUID(ticket_id)

    with SyncSession() as db:
        ticket = db.execute(
            select(Ticket)
            .options(
                joinedload(Ticket.author).joinedload(User.employee),
            )
            .where(Ticket.id == ticket_uuid)
        ).scalar_one_or_none()

        if ticket is None:
            return {"error": "ticket_not_found"}

        author_name = _user_display_name(ticket.author)
        recipients = _get_admin_recipients(db)

        ticket_number = ticket.number
        ticket_subject = ticket.subject
        ticket_priority = _priority_label(ticket.priority.value)
        ticket_id_str = str(ticket.id)

    portal_url = settings.frontend_url

    email_sent = False
    if recipients:
        html = build_new_ticket_email(
            ticket_number=ticket_number,
            subject=ticket_subject,
            priority=ticket_priority,
            author_name=author_name,
            portal_url=portal_url,
            ticket_id=ticket_id_str,
        )
        email_sent = asyncio.run(
            send_email(
                recipients,
                f"Новая заявка #{ticket_number}: {ticket_subject}",
                html,
            )
        )

    tg_text = build_new_ticket_text(
        ticket_number=ticket_number,
        subject=ticket_subject,
        priority=ticket_priority,
        author_name=author_name,
        portal_url=portal_url,
        ticket_id=ticket_id_str,
    )
    telegram_sent = asyncio.run(send_telegram_message(tg_text))

    return {
        "emailed": len(recipients),
        "email_sent": email_sent,
        "telegram_sent": telegram_sent,
    }


@celery_app.task(name="app.tasks.ticket_tasks.notify_ticket_update")
def notify_ticket_update(
    ticket_id: str,
    field: str,
    old_value: str | None,
    new_value: str | None,
    changed_by_name: str,
) -> dict:
    """
    Notify about ticket update.

    Logic:
    - before assignee is set -> notify admins
    - after assignee is set -> notify author and assignee only
    """
    ticket_uuid = UUID(ticket_id)

    with SyncSession() as db:
        ticket = db.execute(
            select(Ticket)
            .options(
                joinedload(Ticket.author).joinedload(User.employee),
                joinedload(Ticket.assignee).joinedload(User.employee),
            )
            .where(Ticket.id == ticket_uuid)
        ).scalar_one_or_none()

        if ticket is None:
            return {"error": "ticket_not_found"}

        if ticket.assignee_id is None:
            recipients = _get_admin_recipients(db)
        else:
            recipients = _get_author_assignee_recipients(ticket)

        ticket_number = ticket.number
        ticket_id_str = str(ticket.id)

        label, resolved_old, resolved_new = _humanize_ticket_change(field, old_value, new_value)

        if field == "assignee_id":
            resolved_old = _resolve_user_name_by_id(db, old_value)
            resolved_new = _resolve_user_name_by_id(db, new_value)

        subject = _build_update_subject(ticket_number, field)

    email_sent = False
    if recipients:
        if field == "comment":
            html = build_ticket_comment_email(
                ticket_number=ticket_number,
                comment_text=new_value or "",
                comment_author=changed_by_name,
                portal_url=settings.frontend_url,
                ticket_id=ticket_id_str,
            )
        else:
            html = build_ticket_update_email(
                ticket_number=ticket_number,
                field=label,
                old_value=resolved_old or "",
                new_value=resolved_new or "",
                changed_by=changed_by_name,
                portal_url=settings.frontend_url,
                ticket_id=ticket_id_str,
            )

        email_sent = asyncio.run(
            send_email(
                recipients,
                subject,
                html,
            )
        )

    return {
        "emailed": len(recipients),
        "email_sent": email_sent,
    }


@celery_app.task(name="app.tasks.ticket_tasks.notify_user_credentials")
def notify_user_credentials(
    email: str,
    full_name: str,
    username: str,
    password: str,
) -> dict:
    html = build_welcome_email(
        full_name=full_name,
        login=username,
        password=password,
        portal_url=settings.frontend_url,
    )

    email_sent = asyncio.run(
        send_email(
            email,
            "Доступ к внутреннему порталу",
            html,
        )
    )

    return {
        "email": email,
        "email_sent": email_sent,
    }