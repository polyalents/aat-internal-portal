import mimetypes
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.chat.models import Chat, ChatMessage, ChatParticipant, ChatType
from app.chat.schemas import (
    ChatDirectCreate,
    ChatListResponse,
    ChatMessageCreate,
    ChatMessageListResponse,
    ChatMessageRead,
    ChatParticipantRead,
    ChatRead,
)
from app.chat.service import (
    build_chat_title,
    create_message,
    ensure_global_chat,
    ensure_global_participant,
    get_attachment_by_id,
    get_chat_for_user,
    get_chat_unread_count,
    get_last_message_at,
    get_last_message_preview,
    get_message_by_id,
    get_messages,
    get_my_message_status,
    get_or_create_direct_chat,
    list_user_chats,
    mark_chat_as_read,
    resolve_attachment_disk_path,
    set_chat_pinned,
    set_message_pinned,
    soft_delete_message,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.users.models import User, UserRole

router = APIRouter()


def _to_read(message, current_user_id: UUID) -> ChatMessageRead:
    return ChatMessageRead(
        id=message.id,
        chat_id=message.chat_id,
        author_id=message.author_id,
        author_name=message.author.username if message.author else None,
        text=message.text,
        is_pinned=message.is_pinned,
        is_deleted=message.is_deleted,
        created_at=message.created_at,
        my_status=get_my_message_status(message, current_user_id),
        attachments=[
            {
                "id": attachment.id,
                "filename": attachment.filename,
                "file_path": attachment.file_path,
                "file_url": f"/api/chat/attachments/{attachment.id}/file",
                "file_size": attachment.file_size,
                "content_type": attachment.content_type,
                "attachment_type": attachment.attachment_type,
                "uploaded_at": attachment.uploaded_at,
            }
            for attachment in message.attachments
        ],
    )


def _chat_to_read(chat, current_user_id: UUID) -> ChatRead:
    state = next((item for item in chat.read_states if item.user_id == current_user_id), None)
    return ChatRead(
        id=chat.id,
        type=chat.type,
        title=build_chat_title(chat, current_user_id),
        participants=[
            ChatParticipantRead(
                user_id=participant.user_id,
                name=participant.user.username if participant.user else None,
                email=participant.user.email if participant.user else None,
            )
            for participant in chat.participants
        ],
        unread_count=get_chat_unread_count(chat, current_user_id),
        last_message_preview=get_last_message_preview(chat),
        last_message_at=get_last_message_at(chat),
        is_pinned=bool(state.is_pinned) if state else False,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
    )


async def _resolve_chat_or_404(db: AsyncSession, current_user: User, chat_id: UUID):
    chat = await get_chat_for_user(db, chat_id, current_user.id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return chat


async def _reload_chat_for_list(db: AsyncSession, chat_ids: list[UUID]):
    if not chat_ids:
        return []

    result = await db.execute(
        select(Chat)
        .options(
            selectinload(Chat.participants).selectinload(ChatParticipant.user).selectinload(User.employee),
            selectinload(Chat.read_states),
            selectinload(Chat.messages).selectinload(ChatMessage.attachments),
        )
        .where(Chat.id.in_(chat_ids))
    )
    return list(result.scalars().unique().all())


@router.get("/attachments/{attachment_id}/file")
async def download_attachment(
    attachment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = await get_attachment_by_id(db, attachment_id)
    if attachment is None or attachment.message is None or attachment.message.chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    chat = attachment.message.chat
    if chat.type != ChatType.global_chat and not any(item.user_id == current_user.id for item in chat.participants):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    path = resolve_attachment_disk_path(attachment)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file not found")

    media_type = attachment.content_type or "application/octet-stream"
    if attachment.attachment_type.value == "image" and not media_type.startswith("image/"):
        guessed_type, _ = mimetypes.guess_type(attachment.filename)
        if guessed_type and guessed_type.startswith("image/"):
            media_type = guessed_type

    return FileResponse(
        path=path,
        filename=attachment.filename,
        media_type=media_type,
    )


@router.get("/chats", response_model=ChatListResponse)
async def list_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatListResponse:
    chats = await list_user_chats(db, current_user.id)
    await db.commit()
    return ChatListResponse(items=[_chat_to_read(chat, current_user.id) for chat in chats])


@router.post("/chats/direct", response_model=ChatRead)
async def get_or_create_direct(
    body: ChatDirectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatRead:
    chat = await get_or_create_direct_chat(db, current_user.id, body.user_id)
    reloaded = await _reload_chat_for_list(db, [chat.id])
    await db.commit()
    return _chat_to_read(reloaded[0], current_user.id)


@router.post("/chats/{chat_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _resolve_chat_or_404(db, current_user, chat_id)
    await mark_chat_as_read(db, chat_id, current_user.id)
    return None


@router.post("/chats/{chat_id}/pin", status_code=status.HTTP_204_NO_CONTENT)
async def pin_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _resolve_chat_or_404(db, current_user, chat_id)
    await set_chat_pinned(db, chat_id, current_user.id, True)
    return None


@router.post("/chats/{chat_id}/unpin", status_code=status.HTTP_204_NO_CONTENT)
async def unpin_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = await _resolve_chat_or_404(db, current_user, chat_id)
    if chat.type == ChatType.global_chat:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Global chat cannot be unpinned")
    await set_chat_pinned(db, chat_id, current_user.id, False)
    return None


@router.get("/chats/{chat_id}/messages", response_model=ChatMessageListResponse)
async def list_chat_messages(
    chat_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageListResponse:
    await _resolve_chat_or_404(db, current_user, chat_id)
    messages, total = await get_messages(db, chat_id=chat_id, page=page, size=size)
    return ChatMessageListResponse(
        items=[_to_read(message, current_user.id) for message in messages],
        total=total,
        page=page,
        size=size,
    )


@router.post("/chats/{chat_id}/messages", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
async def create_chat_message(
    chat_id: UUID,
    text: str = Form(default=""),
    files: list[UploadFile] | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    chat = await _resolve_chat_or_404(db, current_user, chat_id)
    message = await create_message(db, chat=chat, author_id=current_user.id, text=text, files=files)
    message = await get_message_by_id(db, message.id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reload message")
    return _to_read(message, current_user.id)


@router.delete("/chats/{chat_id}/messages/{message_id}", response_model=ChatMessageRead)
async def delete_chat_message(
    chat_id: UUID,
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    await _resolve_chat_or_404(db, current_user, chat_id)
    message = await get_message_by_id(db, message_id)
    if message is None or message.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    can_delete = (
        message.author_id == current_user.id
        or current_user.role in (UserRole.it_specialist, UserRole.admin)
    )
    if not can_delete:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    message = await soft_delete_message(db, message)
    return _to_read(message, current_user.id)


@router.post("/chats/{chat_id}/messages/{message_id}/pin", response_model=ChatMessageRead)
async def pin_chat_message(
    chat_id: UUID,
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can pin messages")

    await _resolve_chat_or_404(db, current_user, chat_id)
    message = await get_message_by_id(db, message_id)
    if message is None or message.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    message = await set_message_pinned(db, message, True)
    return _to_read(message, current_user.id)


@router.post("/chats/{chat_id}/messages/{message_id}/unpin", response_model=ChatMessageRead)
async def unpin_chat_message(
    chat_id: UUID,
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can unpin messages")

    await _resolve_chat_or_404(db, current_user, chat_id)
    message = await get_message_by_id(db, message_id)
    if message is None or message.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    message = await set_message_pinned(db, message, False)
    return _to_read(message, current_user.id)