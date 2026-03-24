from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.announcements.schemas import AnnouncementRead
from app.announcements.service import get_announcements
from app.database import get_db
from app.dependencies import get_current_user
from app.employees.schemas import BirthdayEntry
from app.employees.service import get_birthdays
from app.tickets.enums import TicketPriority, TicketStatus
from app.tickets.schemas import TicketRead, TicketStats
from app.tickets.service import get_ticket_stats, get_tickets
from app.users.models import User, UserRole

router = APIRouter()


class DashboardResponse(BaseModel):
    ticket_stats: TicketStats
    recent_tickets: list[TicketRead]
    birthdays_today: list[BirthdayEntry]
    birthdays_week: list[BirthdayEntry]
    recent_announcements: list[AnnouncementRead]
    unassigned_tickets: list[TicketRead] = Field(default_factory=list)
    urgent_tickets: list[TicketRead] = Field(default_factory=list)


def _ticket_to_read(ticket) -> TicketRead:
    return TicketRead(
        id=ticket.id,
        number=ticket.number,
        subject=ticket.subject,
        description=ticket.description,
        category_id=ticket.category_id,
        category_name=ticket.category.name if ticket.category else None,
        priority=ticket.priority,
        status=ticket.status,
        author_id=ticket.author_id,
        author_name=ticket.author.username if ticket.author else None,
        assignee_id=ticket.assignee_id,
        assignee_name=ticket.assignee.username if ticket.assignee else None,
        contact_phone=ticket.contact_phone,
        contact_email=ticket.contact_email,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        escalated_at=ticket.escalated_at,
        completed_at=ticket.completed_at,
    )


def _announcement_to_read(announcement) -> AnnouncementRead:
    return AnnouncementRead(
        id=announcement.id,
        title=announcement.title,
        content=announcement.content,
        author_id=announcement.author_id,
        author_name=announcement.author.username if announcement.author else None,
        published_at=announcement.published_at,
        expires_at=announcement.expires_at,
        is_active=announcement.is_active,
    )


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    is_it = current_user.role in (UserRole.it_specialist, UserRole.admin)

    author_id = None if is_it else current_user.id
    ticket_stats = await get_ticket_stats(db, author_id=author_id)

    recent_ticket_rows, _ = await get_tickets(
        db,
        page=1,
        size=5,
        author_id=author_id,
    )
    recent_tickets = [_ticket_to_read(ticket) for ticket in recent_ticket_rows]

    birthdays_today = await get_birthdays(db, period="today")
    birthdays_week = await get_birthdays(db, period="week")

    announcement_rows, _ = await get_announcements(
        db,
        page=1,
        size=5,
        active_only=True,
    )
    recent_announcements = [
        _announcement_to_read(announcement)
        for announcement in announcement_rows
    ]

    unassigned_tickets: list[TicketRead] = []
    urgent_tickets: list[TicketRead] = []

    if is_it:
        new_ticket_rows, _ = await get_tickets(
            db,
            page=1,
            size=10,
            status=TicketStatus.new,
        )
        unassigned_tickets = [
            _ticket_to_read(ticket)
            for ticket in new_ticket_rows
            if ticket.assignee_id is None
        ]

        urgent_ticket_rows, _ = await get_tickets(
            db,
            page=1,
            size=10,
            priority=TicketPriority.now,
        )
        urgent_tickets = [
            _ticket_to_read(ticket)
            for ticket in urgent_ticket_rows
            if ticket.status not in (TicketStatus.completed, TicketStatus.rejected)
        ]

    return DashboardResponse(
        ticket_stats=ticket_stats,
        recent_tickets=recent_tickets,
        birthdays_today=birthdays_today,
        birthdays_week=birthdays_week,
        recent_announcements=recent_announcements,
        unassigned_tickets=unassigned_tickets,
        urgent_tickets=urgent_tickets,
    ) 