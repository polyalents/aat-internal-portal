from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.tickets.enums import ALLOWED_TRANSITIONS, TicketPriority, TicketStatus
from app.tickets.models import Ticket, TicketCategory, TicketComment, TicketHistory
from app.tickets.schemas import TicketCreate, TicketStats, TicketUpdate
from app.users.models import User, UserRole


async def get_categories(db: AsyncSession, active_only: bool = True) -> list[TicketCategory]:
    stmt = select(TicketCategory)
    if active_only:
        stmt = stmt.where(TicketCategory.is_active.is_(True))
    stmt = stmt.order_by(TicketCategory.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_category_by_id(db: AsyncSession, cat_id: UUID) -> TicketCategory | None:
    result = await db.execute(select(TicketCategory).where(TicketCategory.id == cat_id))
    return result.scalar_one_or_none()


async def create_category(db: AsyncSession, name: str) -> TicketCategory:
    category = TicketCategory(name=name.strip())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession,
    category: TicketCategory,
    name: str | None = None,
    is_active: bool | None = None,
) -> TicketCategory:
    if name is not None:
        category.name = name.strip()
    if is_active is not None:
        category.is_active = is_active

    await db.commit()
    await db.refresh(category)
    return category


async def get_tickets(
    db: AsyncSession,
    page: int = 1,
    size: int = 20,
    status: TicketStatus | None = None,
    priority: TicketPriority | None = None,
    author_id: UUID | None = None,
    assignee_id: UUID | None = None,
    unassigned_only: bool = False,
    search: str | None = None,
    archived: bool = False,
) -> tuple[list[Ticket], int]:
    stmt = select(Ticket).options(
        selectinload(Ticket.category),
        selectinload(Ticket.author),
        selectinload(Ticket.assignee),
        selectinload(Ticket.attachments),
    )
    count_stmt = select(func.count()).select_from(Ticket)

    filters = [Ticket.is_archived.is_(archived)]

    if status is not None:
        filters.append(Ticket.status == status)
    if priority is not None:
        filters.append(Ticket.priority == priority)
    if author_id is not None:
        filters.append(Ticket.author_id == author_id)
    if assignee_id is not None:
        filters.append(Ticket.assignee_id == assignee_id)
    if unassigned_only:
        filters.append(Ticket.assignee_id.is_(None))
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(or_(Ticket.subject.ilike(pattern), Ticket.description.ilike(pattern)))

    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.order_by(Ticket.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)

    return list(result.scalars().all()), total


async def get_ticket_by_id(db: AsyncSession, ticket_id: UUID, include_archived: bool = True) -> Ticket | None:
    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.category),
            selectinload(Ticket.author),
            selectinload(Ticket.assignee),
            selectinload(Ticket.comments).selectinload(TicketComment.author),
            selectinload(Ticket.history).selectinload(TicketHistory.user),
            selectinload(Ticket.attachments),
        )
        .where(Ticket.id == ticket_id)
    )

    if not include_archived:
        stmt = stmt.where(Ticket.is_archived.is_(False))

    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_ticket(db: AsyncSession, data: TicketCreate, author: User) -> Ticket:
    ticket = Ticket(
        subject=data.subject.strip(),
        description=data.description.strip(),
        category_id=data.category_id,
        priority=data.priority,
        author_id=author.id,
        contact_phone=data.contact_phone.strip() if data.contact_phone else None,
        internal_phone=data.internal_phone.strip() if data.internal_phone else None,
        room_number=data.room_number.strip() if data.room_number else None,
        contact_email=str(data.contact_email).lower() if data.contact_email else None,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def get_ticket_assignees(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.employee))
        .where(
            User.is_active.is_(True),
            or_(
                User.role == UserRole.it_specialist,
                User.is_it_manager.is_(True),
            ),
        )
        .order_by(User.is_it_manager.desc(), User.username)
    )
    users = list(result.scalars().all())

    options: list[dict] = []
    for user in users:
        employee = user.employee
        is_on_vacation = bool(employee and employee.is_on_vacation)
        full_name = employee.full_name if employee else None
        options.append(
            {
                "user_id": user.id,
                "username": user.username,
                "full_name": full_name,
                "is_it_manager": user.is_it_manager,
                "is_on_vacation": is_on_vacation,
                "is_available": not is_on_vacation,
            }
        )

    return options


async def update_ticket(
    db: AsyncSession,
    ticket: Ticket,
    data: TicketUpdate,
    changed_by: User,
) -> Ticket:
    changes: list[TicketHistory] = []

    if data.status is not None and data.status != ticket.status:
        allowed = ALLOWED_TRANSITIONS.get(ticket.status, [])
        if data.status not in allowed:
            raise ValueError(f"Cannot transition from {ticket.status.value} to {data.status.value}")

        old_status = ticket.status

        changes.append(
            TicketHistory(
                ticket_id=ticket.id,
                changed_by=changed_by.id,
                field="status",
                old_value=old_status.value,
                new_value=data.status.value,
            )
        )
        ticket.status = data.status

        if data.status == TicketStatus.escalated and old_status != TicketStatus.escalated:
            ticket.escalated_at = datetime.now(timezone.utc)

        if data.status in (TicketStatus.completed, TicketStatus.rejected):
            ticket.completed_at = datetime.now(timezone.utc)
        else:
            ticket.completed_at = None

    assignee_field_set = "assignee_id" in data.model_fields_set
    if assignee_field_set and data.assignee_id != ticket.assignee_id:
        if data.assignee_id is not None:
            assignee = await db.scalar(
                select(User)
                .options(selectinload(User.employee))
                .where(
                    User.id == data.assignee_id,
                    User.is_active.is_(True),
                )
            )
            if assignee is None:
                raise ValueError("Исполнитель не найден или неактивен")

            if assignee.role != UserRole.it_specialist and not assignee.is_it_manager:
                raise ValueError("Исполнителем может быть только IT-специалист")

            if assignee.employee is not None and assignee.employee.is_on_vacation:
                raise ValueError("Нельзя назначить сотрудника, который находится в отпуске")

        changes.append(
            TicketHistory(
                ticket_id=ticket.id,
                changed_by=changed_by.id,
                field="assignee_id",
                old_value=str(ticket.assignee_id) if ticket.assignee_id else None,
                new_value=str(data.assignee_id) if data.assignee_id else None,
            )
        )
        ticket.assignee_id = data.assignee_id

    if data.priority is not None and data.priority != ticket.priority:
        changes.append(
            TicketHistory(
                ticket_id=ticket.id,
                changed_by=changed_by.id,
                field="priority",
                old_value=ticket.priority.value,
                new_value=data.priority.value,
            )
        )
        ticket.priority = data.priority

    for change in changes:
        db.add(change)

    await db.commit()
    await db.refresh(ticket)
    return ticket


async def archive_ticket(db: AsyncSession, ticket: Ticket, changed_by: User) -> Ticket:
    if ticket.is_archived:
        return ticket

    ticket.is_archived = True
    ticket.archived_at = datetime.now(timezone.utc)

    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            changed_by=changed_by.id,
            field="archived",
            old_value="false",
            new_value="true",
        )
    )

    await db.commit()
    await db.refresh(ticket)
    return ticket


async def restore_ticket(db: AsyncSession, ticket: Ticket, changed_by: User) -> Ticket:
    if not ticket.is_archived:
        return ticket

    ticket.is_archived = False
    ticket.archived_at = None

    db.add(
        TicketHistory(
            ticket_id=ticket.id,
            changed_by=changed_by.id,
            field="archived",
            old_value="true",
            new_value="false",
        )
    )

    await db.commit()
    await db.refresh(ticket)
    return ticket


async def delete_ticket_permanently(db: AsyncSession, ticket: Ticket) -> None:
    for attachment in ticket.attachments:
        path = Path(settings.upload_dir) / "tickets" / str(ticket.id) / Path(attachment.file_path).name
        if path.exists():
            path.unlink(missing_ok=True)

    attach_dir = Path(settings.upload_dir) / "tickets" / str(ticket.id)
    if attach_dir.exists() and attach_dir.is_dir():
        try:
            attach_dir.rmdir()
        except OSError:
            pass

    await db.delete(ticket)
    await db.commit()


async def cleanup_old_tickets(db: AsyncSession, completed_days: int = 180, rejected_days: int = 30) -> int:
    now = datetime.now(timezone.utc)
    completed_before = now - timedelta(days=completed_days)
    rejected_before = now - timedelta(days=rejected_days)

    stmt = (
        select(Ticket)
        .options(selectinload(Ticket.attachments))
        .where(
            Ticket.is_archived.is_(True),
            or_(
                (Ticket.status == TicketStatus.completed) & (Ticket.updated_at < completed_before),
                (Ticket.status == TicketStatus.rejected) & (Ticket.updated_at < rejected_before),
            ),
        )
    )

    result = await db.execute(stmt)
    tickets = list(result.scalars().all())

    count = 0
    for ticket in tickets:
        await delete_ticket_permanently(db, ticket)
        count += 1

    return count


async def add_comment(db: AsyncSession, ticket_id: UUID, author_id: UUID, text: str) -> TicketComment:
    comment = TicketComment(ticket_id=ticket_id, author_id=author_id, text=text.strip())
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def get_comments(db: AsyncSession, ticket_id: UUID) -> list[TicketComment]:
    stmt = (
        select(TicketComment)
        .options(selectinload(TicketComment.author))
        .where(TicketComment.ticket_id == ticket_id)
        .order_by(TicketComment.created_at)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_history(db: AsyncSession, ticket_id: UUID) -> list[TicketHistory]:
    stmt = (
        select(TicketHistory)
        .options(selectinload(TicketHistory.user))
        .where(TicketHistory.ticket_id == ticket_id)
        .order_by(TicketHistory.created_at)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_ticket_stats(db: AsyncSession, author_id: UUID | None = None) -> TicketStats:
    stmt = select(Ticket.status, func.count()).where(Ticket.is_archived.is_(False)).group_by(Ticket.status)
    if author_id is not None:
        stmt = stmt.where(Ticket.author_id == author_id)

    result = await db.execute(stmt)
    rows = result.all()

    stats = TicketStats()
    for status_value, count in rows:
        stats.total += count
        setattr(stats, status_value.value, count)

    return stats