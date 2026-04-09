import logging
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_it
from app.tickets.enums import TicketPriority, TicketStatus
from app.tickets.models import TicketAttachment
from app.tickets.schemas import (
    AttachmentRead,
    CommentCreate,
    CommentRead,
    HistoryRead,
    TicketCategoryCreate,
    TicketCategoryRead,
    TicketCategoryUpdate,
    TicketAssigneeOption,
    TicketCreate,
    TicketListResponse,
    TicketRead,
    TicketStats,
    TicketUpdate,
)
from app.tickets.service import (
    add_comment,
    archive_ticket,
    cleanup_old_tickets,
    create_category,
    create_ticket,
    delete_ticket_permanently,
    get_categories,
    get_category_by_id,
    get_comments,
    get_history,
    get_ticket_by_id,
    get_ticket_assignees,
    get_ticket_stats,
    get_tickets,
    restore_ticket,
    update_category,
    update_ticket,
)
from app.tasks.celery_app import celery_app
from app.users.models import User, UserRole

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_TOTAL_ATTACHMENT_SIZE = settings.max_upload_size_mb * 1024 * 1024


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
        internal_phone=ticket.internal_phone,
        room_number=ticket.room_number,
        contact_email=ticket.contact_email,
        attachments=[
            AttachmentRead(
                id=attachment.id,
                ticket_id=attachment.ticket_id,
                filename=attachment.filename,
                file_path=attachment.file_path,
                file_size=attachment.file_size,
                content_type=attachment.content_type,
                uploaded_at=attachment.uploaded_at,
            )
            for attachment in (ticket.attachments or [])
        ],
        is_archived=ticket.is_archived,
        archived_at=ticket.archived_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        escalated_at=ticket.escalated_at,
        completed_at=ticket.completed_at,
    )


@router.get("/categories", response_model=list[TicketCategoryRead])
async def list_categories(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TicketCategoryRead]:
    return await get_categories(db, active_only=active_only)


@router.post("/categories", response_model=TicketCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_new_category(
    body: TicketCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> TicketCategoryRead:
    return await create_category(db, body.name)


@router.patch("/categories/{cat_id}", response_model=TicketCategoryRead)
async def update_existing_category(
    cat_id: UUID,
    body: TicketCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> TicketCategoryRead:
    category = await get_category_by_id(db, cat_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return await update_category(db, category, name=body.name, is_active=body.is_active)


@router.get("", response_model=TicketListResponse)
async def list_tickets(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    ticket_status: TicketStatus | None = Query(None, alias="status"),
    priority: TicketPriority | None = Query(None),
    search: str | None = Query(None, max_length=300),
    unassigned_only: bool = Query(False),
    archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TicketListResponse:
    author_id = current_user.id if current_user.role == UserRole.employee else None

    tickets, total = await get_tickets(
        db,
        page=page,
        size=size,
        status=ticket_status,
        priority=priority,
        author_id=author_id,
        search=search,
        unassigned_only=unassigned_only,
        archived=archived,
    )
    items = [_ticket_to_read(ticket) for ticket in tickets]
    return TicketListResponse(items=items, total=total, page=page, size=size)


@router.get("/stats", response_model=TicketStats)
async def ticket_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TicketStats:
    author_id = current_user.id if current_user.role == UserRole.employee else None
    return await get_ticket_stats(db, author_id=author_id)


@router.get("/assignees", response_model=list[TicketAssigneeOption])
async def list_ticket_assignees(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_it),
) -> list[TicketAssigneeOption]:
    return [TicketAssigneeOption.model_validate(item) for item in await get_ticket_assignees(db)]


@router.get("/{ticket_id}", response_model=TicketRead)
async def read_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TicketRead:
    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if current_user.role == UserRole.employee and ticket.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return _ticket_to_read(ticket)


@router.post("", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
async def create_new_ticket(
    body: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TicketRead:
    ticket = await create_ticket(db, body, current_user)
    try:
        celery_app.send_task("app.tasks.ticket_tasks.notify_new_ticket", args=[str(ticket.id)])
    except Exception:
        logger.exception("Failed to enqueue new ticket notification task")
    ticket = await get_ticket_by_id(db, ticket.id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload ticket",
        )
    return _ticket_to_read(ticket)


@router.patch("/{ticket_id}", response_model=TicketRead)
async def update_existing_ticket(
    ticket_id: UUID,
    body: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_it),
) -> TicketRead:
    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    old_status = ticket.status
    old_assignee = ticket.assignee_id
    old_priority = ticket.priority

    try:
        ticket = await update_ticket(db, ticket, body, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from None

    try:
        if "status" in body.model_fields_set and ticket.status != old_status:
            celery_app.send_task(
                "app.tasks.ticket_tasks.notify_ticket_update",
                args=[str(ticket.id), "status", old_status.value, ticket.status.value, current_user.username],
            )
        if "assignee_id" in body.model_fields_set and ticket.assignee_id != old_assignee:
            celery_app.send_task(
                "app.tasks.ticket_tasks.notify_ticket_update",
                args=[
                    str(ticket.id),
                    "assignee_id",
                    str(old_assignee) if old_assignee else None,
                    str(ticket.assignee_id) if ticket.assignee_id else None,
                    current_user.username,
                ],
            )
        if "priority" in body.model_fields_set and ticket.priority != old_priority:
            celery_app.send_task(
                "app.tasks.ticket_tasks.notify_ticket_update",
                args=[str(ticket.id), "priority", old_priority.value, ticket.priority.value, current_user.username],
            )
    except Exception:
        logger.exception("Failed to enqueue ticket update notification task")

    ticket = await get_ticket_by_id(db, ticket.id)
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reload ticket",
        )

    return _ticket_to_read(ticket)


@router.post("/{ticket_id}/archive", response_model=TicketRead)
async def archive_existing_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_it),
) -> TicketRead:
    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.status not in (TicketStatus.completed, TicketStatus.rejected):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only completed or rejected tickets can be archived")

    ticket = await archive_ticket(db, ticket, current_user)
    return _ticket_to_read(ticket)


@router.post("/{ticket_id}/restore", response_model=TicketRead)
async def restore_existing_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_it),
) -> TicketRead:
    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    ticket = await restore_ticket(db, ticket, current_user)
    return _ticket_to_read(ticket)


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_ticket_permanently(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can delete tickets permanently")

    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if not ticket.is_archived:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticket must be archived before permanent deletion")

    await delete_ticket_permanently(db, ticket)


@router.post("/cleanup-old", status_code=status.HTTP_200_OK)
async def cleanup_old_archived_tickets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can run cleanup")

    deleted = await cleanup_old_tickets(db)
    return {"deleted": deleted}


@router.get("/{ticket_id}/comments", response_model=list[CommentRead])
async def list_comments(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CommentRead]:
    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    can_access_comments = ticket.author_id == current_user.id or ticket.assignee_id == current_user.id
    if not can_access_comments:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    comments = await get_comments(db, ticket_id)
    return [
        CommentRead(
            id=comment.id,
            ticket_id=comment.ticket_id,
            author_id=comment.author_id,
            author_name=comment.author.username if comment.author else None,
            text=comment.text,
            created_at=comment.created_at,
        )
        for comment in comments
    ]


@router.post("/{ticket_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
async def create_comment(
    ticket_id: UUID,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentRead:
    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    can_access_comments = ticket.author_id == current_user.id or ticket.assignee_id == current_user.id
    if not can_access_comments:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    comment = await add_comment(db, ticket_id, current_user.id, body.text)
    try:
        celery_app.send_task(
            "app.tasks.ticket_tasks.notify_ticket_update",
            args=[str(ticket_id), "comment", None, body.text.strip(), current_user.username],
        )
    except Exception:
        logger.exception("Failed to enqueue ticket comment notification task")
    return CommentRead(
        id=comment.id,
        ticket_id=comment.ticket_id,
        author_id=comment.author_id,
        author_name=current_user.username,
        text=comment.text,
        created_at=comment.created_at,
    )


@router.get("/{ticket_id}/history", response_model=list[HistoryRead])
async def list_history(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[HistoryRead]:
    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if current_user.role == UserRole.employee and ticket.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    history = await get_history(db, ticket_id)
    return [
        HistoryRead(
            id=item.id,
            ticket_id=item.ticket_id,
            changed_by=item.changed_by,
            changed_by_name=item.user.username if item.user else None,
            field=item.field,
            old_value=item.old_value,
            new_value=item.new_value,
            created_at=item.created_at,
        )
        for item in history
    ]


@router.post("/{ticket_id}/attachments", response_model=AttachmentRead, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    ticket_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttachmentRead:
    ticket = await get_ticket_by_id(db, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if current_user.role == UserRole.employee and ticket.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    content = await file.read()
    if len(content) > MAX_TOTAL_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large (max {settings.max_upload_size_mb} MB)",
        )

    existing_size = sum(attachment.file_size for attachment in ticket.attachments)
    if existing_size + len(content) > MAX_TOTAL_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total attachments size limit exceeded",
        )

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    stored_name = f"{uuid4().hex}.{ext}"

    attach_dir = Path(settings.upload_dir) / "tickets" / str(ticket_id)
    attach_dir.mkdir(parents=True, exist_ok=True)
    file_path = attach_dir / stored_name

    with open(file_path, "wb") as output_file:
        output_file.write(content)

    await file.close()

    attachment = TicketAttachment(
        ticket_id=ticket_id,
        filename=file.filename or stored_name,
        file_path=f"/uploads/tickets/{ticket_id}/{stored_name}",
        file_size=len(content),
        content_type=file.content_type or "application/octet-stream",
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return attachment