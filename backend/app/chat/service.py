import mimetypes
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.chat.models import (
    Chat,
    ChatAttachment,
    ChatAttachmentType,
    ChatMessage,
    ChatMessageStatus,
    ChatParticipant,
    ChatReadState,
    ChatType,
)
from app.config import settings
from app.employees.models import Employee
from app.users.models import User

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
    "text/csv": "csv",
}
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
MAX_ATTACHMENTS_PER_MESSAGE = 5


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _upload_root() -> Path:
    return Path(settings.upload_dir).expanduser().resolve()


async def ensure_global_chat(db: AsyncSession) -> Chat:
    result = await db.execute(select(Chat).where(Chat.type == ChatType.global_chat).limit(1))
    chat = result.scalar_one_or_none()
    if chat is not None:
        return chat

    chat = Chat(type=ChatType.global_chat, direct_key=None)
    db.add(chat)
    await db.flush()
    return chat


async def ensure_global_participant(db: AsyncSession, chat_id: UUID, user_id: UUID) -> None:
    existing = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == user_id,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(ChatParticipant(chat_id=chat_id, user_id=user_id))
        await db.flush()


async def ensure_chat_read_state(db: AsyncSession, chat_id: UUID, user_id: UUID) -> ChatReadState:
    result = await db.execute(
        select(ChatReadState).where(
            ChatReadState.chat_id == chat_id,
            ChatReadState.user_id == user_id,
        )
    )
    state = result.scalar_one_or_none()
    if state is not None:
        return state

    state = ChatReadState(chat_id=chat_id, user_id=user_id)
    db.add(state)
    await db.flush()
    return state


async def ensure_message_statuses_for_chat(
    db: AsyncSession,
    chat: Chat,
) -> None:
    participants = [item.user_id for item in chat.participants]
    if not participants:
        return

    result = await db.execute(
        select(ChatMessage)
        .options(selectinload(ChatMessage.statuses))
        .where(ChatMessage.chat_id == chat.id)
    )
    messages = list(result.scalars().unique().all())

    now = _now()
    created_any = False

    for message in messages:
        existing_user_ids = {status.user_id for status in message.statuses}
        for user_id in participants:
            if user_id == message.author_id:
                continue
            if user_id in existing_user_ids:
                continue

            db.add(
                ChatMessageStatus(
                    message_id=message.id,
                    user_id=user_id,
                    delivered_at=now,
                )
            )
            created_any = True

    if created_any:
        await db.flush()


async def mark_chat_as_read(db: AsyncSession, chat_id: UUID, user_id: UUID) -> None:
    state = await ensure_chat_read_state(db, chat_id, user_id)

    chat_result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants))
        .where(Chat.id == chat_id)
    )
    chat = chat_result.scalar_one_or_none()
    if chat is None:
        return

    await ensure_message_statuses_for_chat(db, chat)

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()

    now = _now()

    if latest is not None:
        state.last_read_message_id = latest.id
        state.last_read_at = now

    statuses = await db.execute(
        select(ChatMessageStatus)
        .join(ChatMessage, ChatMessage.id == ChatMessageStatus.message_id)
        .where(
            ChatMessage.chat_id == chat_id,
            ChatMessageStatus.user_id == user_id,
            ChatMessage.author_id != user_id,
            ChatMessageStatus.read_at.is_(None),
        )
    )
    for item in statuses.scalars().all():
        item.read_at = now
        if item.delivered_at is None:
            item.delivered_at = now

    await db.commit()


async def set_chat_pinned(db: AsyncSession, chat_id: UUID, user_id: UUID, value: bool) -> ChatReadState:
    state = await ensure_chat_read_state(db, chat_id, user_id)
    state.is_pinned = value
    state.pinned_at = _now() if value else None
    await db.commit()
    await db.refresh(state)
    return state


async def get_chat_for_user(db: AsyncSession, chat_id: UUID, user_id: UUID) -> Chat | None:
    stmt = (
        select(Chat)
        .options(
            selectinload(Chat.participants).selectinload(ChatParticipant.user).selectinload(User.employee),
            selectinload(Chat.read_states),
        )
        .where(Chat.id == chat_id)
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    if chat is None:
        return None

    if chat.type == ChatType.global_chat:
        return chat

    if any(item.user_id == user_id for item in chat.participants):
        return chat

    return None


async def list_user_chats(db: AsyncSession, user_id: UUID) -> list[Chat]:
    global_chat = await ensure_global_chat(db)
    await ensure_global_participant(db, global_chat.id, user_id)
    global_state = await ensure_chat_read_state(db, global_chat.id, user_id)

    if not global_state.is_pinned:
        global_state.is_pinned = True
        global_state.pinned_at = global_state.pinned_at or _now()
        await db.flush()

    stmt = (
        select(Chat)
        .options(
            selectinload(Chat.participants).selectinload(ChatParticipant.user).selectinload(User.employee),
            selectinload(Chat.read_states),
            selectinload(Chat.messages).selectinload(ChatMessage.attachments),
        )
        .where(
            or_(
                Chat.type == ChatType.global_chat,
                and_(
                    Chat.type == ChatType.direct,
                    Chat.participants.any(ChatParticipant.user_id == user_id),
                ),
            )
        )
    )
    result = await db.execute(stmt)
    chats = list(result.scalars().unique().all())

    if not any(chat.id == global_chat.id for chat in chats):
        chats.append(global_chat)

    def sort_key(chat: Chat):
        state = next((item for item in chat.read_states if item.user_id == user_id), None)
        is_global = chat.type == ChatType.global_chat
        is_pinned = bool(state.is_pinned) if state else False
        pinned_at = state.pinned_at if state and state.pinned_at else datetime.min.replace(tzinfo=timezone.utc)
        last_message_at = get_last_message_at(chat) or datetime.min.replace(tzinfo=timezone.utc)
        return (
            0 if is_global else 1,
            0 if is_pinned else 1,
            -pinned_at.timestamp() if is_pinned else 0,
            -last_message_at.timestamp(),
        )

    chats.sort(key=sort_key)
    return chats


async def get_or_create_direct_chat(db: AsyncSession, current_user_id: UUID, other_user_id: UUID) -> Chat:
    if current_user_id == other_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create direct chat with yourself")

    user_exists = await db.execute(select(User.id).where(User.id == other_user_id))
    if user_exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    first, second = sorted([str(current_user_id), str(other_user_id)])
    direct_key = f"{first}:{second}"

    result = await db.execute(
        select(Chat)
        .options(
            selectinload(Chat.participants).selectinload(ChatParticipant.user).selectinload(User.employee),
            selectinload(Chat.read_states),
        )
        .where(Chat.direct_key == direct_key)
        .limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        await ensure_chat_read_state(db, existing.id, current_user_id)
        await ensure_chat_read_state(db, existing.id, other_user_id)
        return existing

    chat = Chat(type=ChatType.direct, direct_key=direct_key, created_by=current_user_id)
    db.add(chat)
    await db.flush()

    db.add(ChatParticipant(chat_id=chat.id, user_id=current_user_id))
    db.add(ChatParticipant(chat_id=chat.id, user_id=other_user_id))
    await db.flush()

    await ensure_chat_read_state(db, chat.id, current_user_id)
    await ensure_chat_read_state(db, chat.id, other_user_id)
    await db.flush()

    result = await db.execute(
        select(Chat)
        .options(
            selectinload(Chat.participants).selectinload(ChatParticipant.user).selectinload(User.employee),
            selectinload(Chat.read_states),
        )
        .where(Chat.id == chat.id)
    )
    return result.scalar_one()


async def get_messages(
    db: AsyncSession,
    chat_id: UUID,
    page: int = 1,
    size: int = 50,
) -> tuple[list[ChatMessage], int]:
    chat_result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants))
        .where(Chat.id == chat_id)
    )
    chat = chat_result.scalar_one_or_none()
    if chat is not None:
        await ensure_message_statuses_for_chat(db, chat)

    count_stmt = select(func.count()).select_from(ChatMessage).where(ChatMessage.chat_id == chat_id)

    stmt = (
        select(ChatMessage)
        .options(
            selectinload(ChatMessage.author),
            selectinload(ChatMessage.attachments),
            selectinload(ChatMessage.statuses),
        )
        .where(ChatMessage.chat_id == chat_id)
        .order_by(ChatMessage.is_pinned.desc(), ChatMessage.created_at.asc())
        .offset((page - 1) * size)
        .limit(size)
    )

    total = (await db.execute(count_stmt)).scalar() or 0
    result = await db.execute(stmt)
    return list(result.scalars().unique().all()), total


async def get_message_by_id(db: AsyncSession, message_id: UUID) -> ChatMessage | None:
    result = await db.execute(
        select(ChatMessage)
        .options(
            selectinload(ChatMessage.author),
            selectinload(ChatMessage.attachments),
            selectinload(ChatMessage.statuses),
        )
        .where(ChatMessage.id == message_id)
    )
    return result.scalar_one_or_none()


async def get_attachment_by_id(db: AsyncSession, attachment_id: UUID) -> ChatAttachment | None:
    result = await db.execute(
        select(ChatAttachment)
        .options(
            selectinload(ChatAttachment.message)
            .selectinload(ChatMessage.chat)
            .selectinload(Chat.participants)
        )
        .where(ChatAttachment.id == attachment_id)
    )
    return result.scalar_one_or_none()


def resolve_attachment_disk_path(attachment: ChatAttachment) -> Path:
    if attachment.file_path.startswith("/uploads/"):
        relative = attachment.file_path[len("/uploads/"):]
        return (_upload_root() / relative).resolve()
    return (_upload_root() / Path(attachment.file_path).name).resolve()


def _resolve_attachment_type(content_type: str | None) -> tuple[ChatAttachmentType, str] | None:
    if content_type is None:
        return None
    if content_type in ALLOWED_IMAGE_TYPES:
        return ChatAttachmentType.image, ALLOWED_IMAGE_TYPES[content_type]
    if content_type in ALLOWED_DOCUMENT_TYPES:
        return ChatAttachmentType.document, ALLOWED_DOCUMENT_TYPES[content_type]
    return None


def _safe_filename(filename: str | None, fallback_ext: str) -> str:
    if not filename:
        return f"file.{fallback_ext}"
    basename = Path(filename).name
    stem, _, ext = basename.rpartition(".")
    if not stem:
        stem = "file"
    stem = "".join(char for char in stem if char.isalnum() or char in {"-", "_", " "}).strip() or "file"
    ext = ext.lower() if ext else fallback_ext
    return f"{stem}.{ext}"


async def _store_attachments(
    db: AsyncSession,
    message: ChatMessage,
    files: Iterable[UploadFile],
) -> None:
    files = [item for item in files if item.filename]
    if not files:
        return

    if len(files) > MAX_ATTACHMENTS_PER_MESSAGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_ATTACHMENTS_PER_MESSAGE} attachments per message",
        )

    attachments_dir = _upload_root() / "chat_attachments"
    attachments_dir.mkdir(parents=True, exist_ok=True)

    for file in files:
        resolved = _resolve_attachment_type(file.content_type)
        if resolved is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file.content_type or 'unknown'}",
            )

        attachment_type, fallback_ext = resolved
        content = await file.read()
        await file.close()

        if len(content) > MAX_ATTACHMENT_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} exceeds 10 MB",
            )

        generated_name = f"{uuid.uuid4().hex}_{_safe_filename(file.filename, fallback_ext)}"
        disk_path = attachments_dir / generated_name
        disk_path.write_bytes(content)

        db.add(
            ChatAttachment(
                message_id=message.id,
                filename=file.filename or generated_name,
                file_path=f"/uploads/chat_attachments/{generated_name}",
                file_size=len(content),
                content_type=file.content_type or "application/octet-stream",
                attachment_type=attachment_type,
            )
        )


async def create_message(
    db: AsyncSession,
    chat: Chat,
    author_id: UUID,
    text: str,
    files: Iterable[UploadFile] | None = None,
) -> ChatMessage:
    normalized_text = text.strip()
    has_attachments = bool(files and any(item.filename for item in files))

    if not normalized_text and not has_attachments:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message must have text or attachments")

    message = ChatMessage(
        chat_id=chat.id,
        author_id=author_id,
        text=normalized_text,
    )
    db.add(message)
    await db.flush()

    if files:
        await _store_attachments(db, message, files)
        await db.flush()

    now = _now()

    for participant in chat.participants:
        if participant.user_id == author_id:
            continue
        db.add(
            ChatMessageStatus(
                message_id=message.id,
                user_id=participant.user_id,
                delivered_at=now,
            )
        )

    author_read_state = await ensure_chat_read_state(db, chat.id, author_id)
    author_read_state.last_read_message_id = message.id
    author_read_state.last_read_at = now

    chat.updated_at = now

    await db.commit()
    await db.refresh(message)
    return message


async def soft_delete_message(
    db: AsyncSession,
    message: ChatMessage,
) -> ChatMessage:
    message.is_deleted = True
    message.text = "[сообщение удалено]"
    message.is_pinned = False
    await db.commit()
    await db.refresh(message)
    return message


async def set_message_pinned(
    db: AsyncSession,
    message: ChatMessage,
    value: bool,
) -> ChatMessage:
    message.is_pinned = value
    await db.commit()
    await db.refresh(message)
    return message


def build_chat_title(chat: Chat, current_user_id: UUID) -> str:
    if chat.type == ChatType.global_chat:
        return "Общий чат"

    for participant in chat.participants:
        if participant.user_id == current_user_id:
            continue

        employee: Employee | None = getattr(participant.user, "employee", None)
        if employee:
            parts = [employee.last_name, employee.first_name, employee.middle_name]
            return " ".join(part for part in parts if part)

        return participant.user.username if participant.user else "Личный чат"

    return "Личный чат"


def get_chat_unread_count(chat: Chat, current_user_id: UUID) -> int:
    state = next((item for item in chat.read_states if item.user_id == current_user_id), None)
    last_read_at = state.last_read_at if state else None

    unread = 0
    for message in getattr(chat, "messages", []) or []:
        if message.author_id == current_user_id:
            continue
        if last_read_at is None or message.created_at > last_read_at:
            unread += 1
    return unread


def get_last_message_preview(chat: Chat) -> str | None:
    messages = getattr(chat, "messages", []) or []
    if not messages:
        return None

    latest = max(messages, key=lambda item: item.created_at)
    if latest.is_deleted:
        return "Сообщение удалено"
    if latest.text:
        return latest.text
    if latest.attachments:
        return "Вложение"
    return None


def get_last_message_at(chat: Chat) -> datetime | None:
    messages = getattr(chat, "messages", []) or []
    if not messages:
        return None
    latest = max(messages, key=lambda item: item.created_at)
    return latest.created_at


def get_my_message_status(message: ChatMessage, current_user_id: UUID):
    if message.author_id != current_user_id:
        return None

    statuses = getattr(message, "statuses", []) or []
    if not statuses:
        return {"delivered_at": None, "read_at": None}

    delivered_candidates = [item.delivered_at for item in statuses if item.delivered_at]
    read_candidates = [item.read_at for item in statuses if item.read_at]

    return {
        "delivered_at": max(delivered_candidates) if delivered_candidates else None,
        "read_at": max(read_candidates) if read_candidates else None,
    }