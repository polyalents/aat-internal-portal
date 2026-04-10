from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.schemas import ChatMessageCreate, ChatMessageListResponse, ChatMessageRead
from app.chat.service import (
    create_message,
    get_message_by_id,
    get_messages,
    set_message_pinned,
    soft_delete_message,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.users.models import User, UserRole

router = APIRouter()


def _to_read(message) -> ChatMessageRead:
    return ChatMessageRead(
        id=message.id,
        author_id=message.author_id,
        author_name=message.author.username if message.author else None,
        text=message.text,
        is_pinned=message.is_pinned,
        is_deleted=message.is_deleted,
        created_at=message.created_at,
    )


@router.get("/", response_model=ChatMessageListResponse)
async def list_messages(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ChatMessageListResponse:
    messages, total = await get_messages(db, page=page, size=size)
    return ChatMessageListResponse(
        items=[_to_read(message) for message in messages],
        total=total,
        page=page,
        size=size,
    )


@router.post("/", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
async def create_new_message(
    body: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    message = await create_message(db, current_user.id, body.text)
    message = await get_message_by_id(db, message.id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload message")
    return _to_read(message)


@router.delete("/{message_id}", response_model=ChatMessageRead)
async def delete_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    message = await get_message_by_id(db, message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    can_delete = (
        message.author_id == current_user.id
        or current_user.role in (UserRole.it_specialist, UserRole.admin)
    )
    if not can_delete:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    message = await soft_delete_message(db, message)
    return _to_read(message)


@router.post("/{message_id}/pin", response_model=ChatMessageRead)
async def pin_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can pin messages")

    message = await get_message_by_id(db, message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    message = await set_message_pinned(db, message, True)
    return _to_read(message)


@router.post("/{message_id}/unpin", response_model=ChatMessageRead)
async def unpin_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can unpin messages")

    message = await get_message_by_id(db, message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    message = await set_message_pinned(db, message, False)
    return _to_read(message)