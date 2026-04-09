"""
Ticket background tasks.

These tasks run in Celery workers using synchronous DB access,
because Celery workers are synchronous by default.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.employees.models import Employee
from app.notifications.email import (
    build_new_ticket_email,
    build_ticket_update_email,
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
    """Send notifications for a new ticket."""
    ticket_uuid = UUID(ticket_id)

    with SyncSession() as db:
        ticket = db.execute(
            select(Ticket).where(Ticket.id == ticket_uuid)
        ).scalar_one_or_none()

        if ticket is None:
            return {"error": "ticket_not_found"}

        author = db.execute(
            select(User).where(User.id == ticket.author_id)
        ).scalar_one_or_none()

        author_name = author.username if author else "Unknown"

        it_users = db.execute(
            select(User).where(
                User.role == UserRole.it_specialist,
                User.is_active == True,  # noqa: E712
            )
        ).scalars().all()

        manager_users = db.execute(
            select(User).where(
                User.is_it_manager == True,  # noqa: E712
                User.is_active == True,  # noqa: E712
            )
        ).scalars().all()

        recipients_pool = {user.id: user for user in [*it_users, *manager_users]}.values()

        recipients: list[str] = []
        for user in recipients_pool:
            employee = db.execute(
                select(Employee).where(Employee.user_id == user.id)
            ).scalar_one_or_none()
            if (employee is None or not employee.is_on_vacation) and user.email:
                recipients.append(user.email)

        ticket_number = ticket.number
        ticket_subject = ticket.subject
        ticket_priority = ticket.priority.value
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
    """Notify author and assignee about ticket update."""
    ticket_uuid = UUID(ticket_id)

    with SyncSession() as db:
        ticket = db.execute(
            select(Ticket).where(Ticket.id == ticket_uuid)
        ).scalar_one_or_none()

        if ticket is None:
            return {"error": "ticket_not_found"}

        recipients: set[str] = set()

        author = db.execute(
            select(User).where(User.id == ticket.author_id)
        ).scalar_one_or_none()
        if author and author.email:
            recipients.add(author.email)

        if ticket.assignee_id:
            assignee = db.execute(
                select(User).where(User.id == ticket.assignee_id)
            ).scalar_one_or_none()
            if assignee and assignee.email:
                recipients.add(assignee.email)

        ticket_number = ticket.number
        ticket_id_str = str(ticket.id)

    email_sent = False
    if recipients:
        html = build_ticket_update_email(
            ticket_number=ticket_number,
            field=field,
            old_value=old_value or "",
            new_value=new_value or "",
            changed_by=changed_by_name,
            portal_url=settings.frontend_url,
            ticket_id=ticket_id_str,
        )
        email_sent = asyncio.run(
            send_email(
                list(recipients),
                f"Обновление заявки #{ticket_number}",
                html,
            )
        )

    return {
        "emailed": len(recipients),
        "email_sent": email_sent,
    }