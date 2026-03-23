from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.tickets.enums import ALLOWED_TRANSITIONS, TicketPriority, TicketStatus
from app.tickets.models import Ticket, TicketCategory, TicketComment, TicketHistory
from app.tickets.schemas import TicketCreate, TicketStats, TicketUpdate
from app.users.models import User


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
    await db.flush()
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
    await db.flush()
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
    search: str | None = None,
) -> tuple[list[Ticket], int]:
    stmt = select(Ticket).options(
        selectinload(Ticket.category),
        selectinload(Ticket.author),
        selectinload(Ticket.assignee),
    )
    count_stmt = select(func.count()).select_from(Ticket)

    filters = []

    if status is not None:
        filters.append(Ticket.status == status)
    if priority is not None:
        filters.append(Ticket.priority == priority)
    if author_id is not None:
        filters.append(Ticket.author_id == author_id)
    if assignee_id is not None:
        filters.append(Ticket.assignee_id == assignee_id)
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


async def get_ticket_by_id(db: AsyncSession, ticket_id: UUID) -> Ticket | None:
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
        contact_email=str(data.contact_email).lower() if data.contact_email else None,
    )
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket)
    return ticket


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

        changes.append(
            TicketHistory(
                ticket_id=ticket.id,
                changed_by=changed_by.id,
                field="status",
                old_value=ticket.status.value,
                new_value=data.status.value,
            )
        )
        ticket.status = data.status

        if data.status == TicketStatus.escalated:
            ticket.escalated_at = datetime.now(timezone.utc)
        elif data.status in (TicketStatus.completed, TicketStatus.rejected):
            ticket.completed_at = datetime.now(timezone.utc)

    if data.assignee_id is not None and data.assignee_id != ticket.assignee_id:
        changes.append(
            TicketHistory(
                ticket_id=ticket.id,
                changed_by=changed_by.id,
                field="assignee_id",
                old_value=str(ticket.assignee_id) if ticket.assignee_id else None,
                new_value=str(data.assignee_id),
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

    await db.flush()
    await db.refresh(ticket)
    return ticket


async def add_comment(db: AsyncSession, ticket_id: UUID, author_id: UUID, text: str) -> TicketComment:
    comment = TicketComment(ticket_id=ticket_id, author_id=author_id, text=text.strip())
    db.add(comment)
    await db.flush()
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
    stmt = select(Ticket.status, func.count()).group_by(Ticket.status)
    if author_id is not None:
        stmt = stmt.where(Ticket.author_id == author_id)

    result = await db.execute(stmt)
    rows = result.all()

    stats = TicketStats()
    for status_value, count in rows:
        stats.total += count
        setattr(stats, status_value.value, count)

    return stats