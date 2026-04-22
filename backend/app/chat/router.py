from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.models import Chat, ChatAttachment, ChatMessage, ChatReadState, ChatType
from app.chat.schemas import (
    ChatDirectCreate,
    ChatListResponse,
    ChatMessageListResponse,
    ChatMessageRead,
    ChatMessageStatusRead,
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
    get_message_by_id,
    get_messages,
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
from app.employees.models import Employee
from app.users.models import User, UserRole

router = APIRouter()


def _attachment_to_read(attachment: ChatAttachment) -> dict:
    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "file_path": attachment.file_path,
        "file_url": f"/api/chat/attachments/{attachment.id}/file",
        "file_size": attachment.file_size,
        "content_type": attachment.content_type,
        "attachment_type": attachment.attachment_type,
        "uploaded_at": attachment.uploaded_at,
    }


def _participant_name(participant) -> str | None:
    user = participant.user
    if user is None:
        return None

    employee: Employee | None = getattr(user, "employee", None)
    if employee is not None:
        parts = [employee.last_name, employee.first_name, employee.middle_name]
        full_name = " ".join(part for part in parts if part)
        if full_name:
            return full_name

    return user.username


def _message_to_read(message: ChatMessage) -> ChatMessageRead:
    author_name = None
    if message.author is not None:
        employee: Employee | None = getattr(message.author, "employee", None)
        if employee is not None:
            parts = [employee.last_name, employee.first_name, employee.middle_name]
            full_name = " ".join(part for part in parts if part)
            author_name = full_name or message.author.username
        else:
            author_name = message.author.username

    return ChatMessageRead(
        id=message.id,
        chat_id=message.chat_id,
        author_id=message.author_id,
        author_name=author_name,
        text=message.text,
        is_pinned=message.is_pinned,
        is_deleted=message.is_deleted,
        created_at=message.created_at,
        attachments=[_attachment_to_read(item) for item in message.attachments],
        statuses=[
            ChatMessageStatusRead(
                user_id=item.user_id,
                delivered_at=item.delivered_at,
                read_at=item.read_at,
            )
            for item in message.statuses
        ],
    )


async def _get_chat_state(db: AsyncSession, chat_id: UUID, user_id: UUID) -> ChatReadState | None:
    result = await db.execute(
        select(ChatReadState).where(
            ChatReadState.chat_id == chat_id,
            ChatReadState.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _chat_to_read(db: AsyncSession, chat: Chat, current_user_id: UUID) -> ChatRead:
    state = await _get_chat_state(db, chat.id, current_user_id)

    messages = list(chat.messages or [])
    messages.sort(key=lambda item: (item.created_at, item.id))

    unread_count = 0
    for message in messages:
        if message.author_id == current_user_id:
            continue
        for msg_status in message.statuses:
            if msg_status.user_id == current_user_id and msg_status.read_at is None:
                unread_count += 1
                break

    last_message = messages[-1] if messages else None
    if last_message is None:
        last_message_preview = None
        last_message_at = None
    else:
        if last_message.text and last_message.text.strip():
            last_message_preview = last_message.text.strip()
        elif last_message.attachments:
            last_message_preview = "Вложение"
        else:
            last_message_preview = None
        last_message_at = last_message.created_at

    is_fixed = chat.type in {ChatType.global_chat, ChatType.department}

    return ChatRead(
        id=chat.id,
        type=chat.type,
        title=build_chat_title(chat, current_user_id),
        participants=[
            ChatParticipantRead(
                user_id=participant.user_id,
                name=_participant_name(participant),
                email=participant.user.email if participant.user else None,
            )
            for participant in chat.participants
            if participant.user is not None
            and participant.user.is_active
            and getattr(participant.user, "employee", None) is not None
        ],
        unread_count=unread_count,
        last_message_preview=last_message_preview,
        last_message_at=last_message_at,
        is_pinned=bool(state.is_pinned) if state else False,
        is_fixed=is_fixed,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
    )


async def _resolve_chat_or_404(db: AsyncSession, current_user: User, chat_id: UUID) -> Chat:
    chat = await get_chat_for_user(db, chat_id, current_user.id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return chat


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

    file_path = resolve_attachment_disk_path(attachment)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type=attachment.content_type or "application/octet-stream",
        filename=attachment.filename,
    )


@router.get("/chats", response_model=ChatListResponse)
async def list_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatListResponse:
    chats = await list_user_chats(db, current_user.id)
    items = [await _chat_to_read(db, chat, current_user.id) for chat in chats]
    return ChatListResponse(items=items)


@router.post("/chats/direct", response_model=ChatRead)
async def create_or_get_direct_chat(
    payload: ChatDirectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatRead:
    chat = await get_or_create_direct_chat(db, current_user.id, payload.user_id)
    return await _chat_to_read(db, chat, current_user.id)


@router.get("/chats/{chat_id}/messages", response_model=ChatMessageListResponse)
async def list_chat_messages(
    chat_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(200, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageListResponse:
    await _resolve_chat_or_404(db, current_user, chat_id)
    items, total = await get_messages(db, chat_id=chat_id, page=page, size=size)
    return ChatMessageListResponse(
        items=[_message_to_read(item) for item in items],
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
    return _message_to_read(message)


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

    can_delete = message.author_id == current_user.id or current_user.role in {UserRole.admin, UserRole.it_specialist}
    if not can_delete:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    updated = await soft_delete_message(db, message)
    return _message_to_read(updated)


@router.post("/chats/{chat_id}/messages/{message_id}/pin", response_model=ChatMessageRead)
async def pin_message(
    chat_id: UUID,
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    await _resolve_chat_or_404(db, current_user, chat_id)
    message = await get_message_by_id(db, message_id)
    if message is None or message.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    updated = await set_message_pinned(db, message, True)
    return _message_to_read(updated)


@router.post("/chats/{chat_id}/messages/{message_id}/unpin", response_model=ChatMessageRead)
async def unpin_message(
    chat_id: UUID,
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    await _resolve_chat_or_404(db, current_user, chat_id)
    message = await get_message_by_id(db, message_id)
    if message is None or message.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    updated = await set_message_pinned(db, message, False)
    return _message_to_read(updated)


@router.post("/chats/{chat_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    chat = await _resolve_chat_or_404(db, current_user, chat_id)
    await mark_chat_as_read(db, chat, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/chats/{chat_id}/pin", response_model=ChatRead)
async def pin_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatRead:
    chat = await _resolve_chat_or_404(db, current_user, chat_id)

    if chat.type in {ChatType.global_chat, ChatType.department}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This chat is fixed")

    await set_chat_pinned(db, chat.id, current_user.id, True)
    refreshed = await _resolve_chat_or_404(db, current_user, chat_id)
    return await _chat_to_read(db, refreshed, current_user.id)


@router.post("/chats/{chat_id}/unpin", response_model=ChatRead)
async def unpin_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatRead:
    chat = await _resolve_chat_or_404(db, current_user, chat_id)

    if chat.type in {ChatType.global_chat, ChatType.department}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This chat is fixed")

    await set_chat_pinned(db, chat.id, current_user.id, False)
    refreshed = await _resolve_chat_or_404(db, current_user, chat_id)
    return await _chat_to_read(db, refreshed, current_user.id)


@router.get("/", response_model=ChatMessageListResponse)
async def list_global_messages(
    page: int = Query(1, ge=1),
    size: int = Query(200, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageListResponse:
    global_chat = await ensure_global_chat(db)
    await ensure_global_participant(db, global_chat.id, current_user.id)
    items, total = await get_messages(db, chat_id=global_chat.id, page=page, size=size)
    return ChatMessageListResponse(
        items=[_message_to_read(item) for item in items],
        total=total,
        page=page,
        size=size,
    )