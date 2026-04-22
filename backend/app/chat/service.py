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
from app.departments.models import Department
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


def _chat_load_options():
    return (
        selectinload(Chat.department),
        selectinload(Chat.read_states),
        selectinload(Chat.participants)
        .selectinload(ChatParticipant.user)
        .selectinload(User.employee),
        selectinload(Chat.messages)
        .selectinload(ChatMessage.author)
        .selectinload(User.employee),
        selectinload(Chat.messages).selectinload(ChatMessage.attachments),
        selectinload(Chat.messages).selectinload(ChatMessage.statuses),
    )


async def _user_has_active_employee(db: AsyncSession, user_id: UUID) -> bool:
    result = await db.execute(
        select(Employee.id)
        .join(User, User.id == Employee.user_id)
        .where(
            Employee.user_id == user_id,
            User.is_active.is_(True),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _eligible_employee_users_result(db: AsyncSession):
    return await db.execute(
        select(Employee)
        .options(selectinload(Employee.user))
        .join(User, User.id == Employee.user_id)
        .where(
            Employee.user_id.is_not(None),
            User.is_active.is_(True),
        )
    )


async def _reload_chat(db: AsyncSession, chat_id: UUID) -> Chat:
    result = await db.execute(
        select(Chat)
        .options(*_chat_load_options())
        .where(Chat.id == chat_id)
        .limit(1)
    )
    chat = result.scalar_one_or_none()
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return chat


async def ensure_global_chat(db: AsyncSession) -> Chat:
    result = await db.execute(
        select(Chat)
        .options(*_chat_load_options())
        .where(Chat.type == ChatType.global_chat)
        .limit(1)
    )
    chat = result.scalar_one_or_none()
    if chat is not None:
        return chat

    chat = Chat(type=ChatType.global_chat, direct_key=None)
    db.add(chat)
    await db.flush()
    return await _reload_chat(db, chat.id)


async def ensure_global_participant(db: AsyncSession, chat_id: UUID, user_id: UUID) -> None:
    if not await _user_has_active_employee(db, user_id):
        return

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


async def sync_global_chat_participants(db: AsyncSession) -> None:
    chat = await ensure_global_chat(db)

    employees_result = await _eligible_employee_users_result(db)
    employees = list(employees_result.scalars().unique().all())
    target_user_ids = {
        employee.user_id
        for employee in employees
        if employee.user_id
    }

    existing_user_ids = {
        participant.user_id
        for participant in chat.participants
        if participant.user is not None
        and participant.user.is_active
        and getattr(participant.user, "employee", None) is not None
    }

    for user_id in target_user_ids - existing_user_ids:
        db.add(ChatParticipant(chat_id=chat.id, user_id=user_id))
        await db.flush()

    removable = [
        participant
        for participant in list(chat.participants)
        if (
            participant.user_id not in target_user_ids
            or participant.user is None
            or not participant.user.is_active
            or getattr(participant.user, "employee", None) is None
        )
    ]
    for participant in removable:
        await db.delete(participant)

    for user_id in target_user_ids:
        await ensure_chat_read_state(db, chat.id, user_id)

    await db.flush()


async def sync_department_chats(db: AsyncSession) -> None:
    departments_result = await db.execute(
        select(Department).options(
            selectinload(Department.employees).selectinload(Employee.user)
        )
    )
    departments = list(departments_result.scalars().unique().all())

    existing_result = await db.execute(
        select(Chat)
        .options(*_chat_load_options())
        .where(Chat.type == ChatType.department)
    )
    existing_by_department = {
        chat.department_id: chat
        for chat in existing_result.scalars().unique().all()
        if chat.department_id is not None
    }

    for department in departments:
        eligible_employees = [
            employee
            for employee in department.employees
            if employee.user_id
            and employee.user is not None
            and employee.user.is_active
        ]

        chat = existing_by_department.get(department.id)

        if not eligible_employees:
            if chat is not None:
                for participant in list(chat.participants):
                    await db.delete(participant)
            continue

        if chat is None:
            chat = Chat(
                type=ChatType.department,
                department_id=department.id,
                direct_key=None,
            )
            db.add(chat)
            await db.flush()
            chat = await _reload_chat(db, chat.id)
            existing_by_department[department.id] = chat

        target_user_ids = {
            employee.user_id
            for employee in eligible_employees
            if employee.user_id
        }
        existing_user_ids = {
            participant.user_id
            for participant in chat.participants
            if participant.user is not None
            and participant.user.is_active
            and getattr(participant.user, "employee", None) is not None
        }

        for user_id in target_user_ids - existing_user_ids:
            db.add(ChatParticipant(chat_id=chat.id, user_id=user_id))
            await db.flush()

        removable = [
            participant
            for participant in list(chat.participants)
            if (
                participant.user_id not in target_user_ids
                or participant.user is None
                or not participant.user.is_active
                or getattr(participant.user, "employee", None) is None
            )
        ]
        for participant in removable:
            await db.delete(participant)

        for user_id in target_user_ids:
            await ensure_chat_read_state(db, chat.id, user_id)

    await db.flush()


async def get_chat_for_user(db: AsyncSession, chat_id: UUID, user_id: UUID) -> Chat | None:
    stmt = (
        select(Chat)
        .options(*_chat_load_options())
        .where(Chat.id == chat_id)
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()

    if chat is None:
        return None

    if chat.type == ChatType.global_chat:
        if await _user_has_active_employee(db, user_id):
            return chat
        return None

    if any(
        item.user_id == user_id
        and item.user is not None
        and item.user.is_active
        and getattr(item.user, "employee", None) is not None
        for item in chat.participants
    ):
        return chat

    return None


async def list_user_chats(db: AsyncSession, user_id: UUID) -> list[Chat]:
    has_employee = await _user_has_active_employee(db, user_id)

    await ensure_global_chat(db)
    await sync_global_chat_participants(db)
    await sync_department_chats(db)

    if has_employee:
        stmt = (
            select(Chat)
            .options(*_chat_load_options())
            .where(
                or_(
                    Chat.type == ChatType.global_chat,
                    and_(
                        Chat.type == ChatType.direct,
                        Chat.participants.any(ChatParticipant.user_id == user_id),
                    ),
                    and_(
                        Chat.type == ChatType.department,
                        Chat.participants.any(ChatParticipant.user_id == user_id),
                    ),
                )
            )
            .order_by(Chat.updated_at.desc())
        )
    else:
        stmt = (
            select(Chat)
            .options(*_chat_load_options())
            .where(
                and_(
                    Chat.type == ChatType.direct,
                    Chat.participants.any(ChatParticipant.user_id == user_id),
                )
            )
            .order_by(Chat.updated_at.desc())
        )

    result = await db.execute(stmt)
    chats = list(result.scalars().unique().all())

    if has_employee:
        global_chat = next((chat for chat in chats if chat.type == ChatType.global_chat), None)
        if global_chat is not None:
            await ensure_global_participant(db, global_chat.id, user_id)

    for chat in chats:
        await ensure_chat_read_state(db, chat.id, user_id)

    await db.flush()
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_or_create_direct_chat(db: AsyncSession, current_user_id: UUID, other_user_id: UUID) -> Chat:
    if current_user_id == other_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create direct chat with yourself")

    other_user_result = await db.execute(
        select(User)
        .options(selectinload(User.employee))
        .where(User.id == other_user_id)
        .limit(1)
    )
    other_user = other_user_result.scalar_one_or_none()

    if other_user is None or not other_user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if getattr(other_user, "employee", None) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no employee card")

    current_user_result = await db.execute(
        select(User)
        .options(selectinload(User.employee))
        .where(User.id == current_user_id)
        .limit(1)
    )
    current_user = current_user_result.scalar_one_or_none()

    if current_user is None or not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current user is inactive")

    if getattr(current_user, "employee", None) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current user has no employee card")

    first, second = sorted([str(current_user_id), str(other_user_id)])
    direct_key = f"{first}:{second}"

    result = await db.execute(
        select(Chat)
        .options(*_chat_load_options())
        .where(Chat.direct_key == direct_key)
        .limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
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

    return await _reload_chat(db, chat.id)


async def get_messages(
    db: AsyncSession,
    chat_id: UUID,
    page: int = 1,
    size: int = 50,
) -> tuple[list[ChatMessage], int]:
    count_stmt = select(func.count()).select_from(ChatMessage).where(ChatMessage.chat_id == chat_id)

    stmt = (
        select(ChatMessage)
        .options(
            selectinload(ChatMessage.author).selectinload(User.employee),
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
            selectinload(ChatMessage.author).selectinload(User.employee),
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
            .selectinload(ChatParticipant.user)
            .selectinload(User.employee)
        )
        .where(ChatAttachment.id == attachment_id)
    )
    return result.scalar_one_or_none()


def resolve_attachment_disk_path(attachment: ChatAttachment) -> Path:
    if attachment.file_path.startswith("/uploads/"):
        relative = attachment.file_path[len("/uploads/") :]
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


async def _create_message_statuses(db: AsyncSession, chat: Chat, message: ChatMessage) -> None:
    delivered_at = _now()

    for participant in chat.participants:
        if participant.user_id == message.author_id:
            continue
        if participant.user is None or not participant.user.is_active:
            continue
        if getattr(participant.user, "employee", None) is None:
            continue

        db.add(
            ChatMessageStatus(
                message_id=message.id,
                user_id=participant.user_id,
                delivered_at=delivered_at,
            )
        )

    await db.flush()


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

    await _create_message_statuses(db, chat, message)
    chat.updated_at = _now()

    await db.commit()
    return await get_message_by_id(db, message.id)  # type: ignore[return-value]


async def soft_delete_message(
    db: AsyncSession,
    message: ChatMessage,
) -> ChatMessage:
    message.is_deleted = True
    message.text = "[сообщение удалено]"
    message.is_pinned = False
    await db.commit()
    return await get_message_by_id(db, message.id)  # type: ignore[return-value]


async def set_message_pinned(
    db: AsyncSession,
    message: ChatMessage,
    value: bool,
) -> ChatMessage:
    message.is_pinned = value
    await db.commit()
    return await get_message_by_id(db, message.id)  # type: ignore[return-value]


async def set_chat_pinned(
    db: AsyncSession,
    chat_id: UUID,
    user_id: UUID,
    value: bool,
) -> ChatReadState:
    state = await ensure_chat_read_state(db, chat_id, user_id)
    state.is_pinned = value
    state.pinned_at = _now() if value else None
    await db.commit()
    await db.refresh(state)
    return state


async def mark_chat_as_read(db: AsyncSession, chat: Chat, user_id: UUID) -> None:
    state = await ensure_chat_read_state(db, chat.id, user_id)

    latest_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(1)
    )
    latest_message = latest_result.scalar_one_or_none()

    state.last_read_at = _now()
    state.last_read_message_id = latest_message.id if latest_message else None

    unread_result = await db.execute(
        select(ChatMessageStatus)
        .join(ChatMessage, ChatMessage.id == ChatMessageStatus.message_id)
        .where(
            ChatMessage.chat_id == chat.id,
            ChatMessageStatus.user_id == user_id,
            ChatMessage.author_id != user_id,
            ChatMessageStatus.read_at.is_(None),
        )
    )
    unread_statuses = list(unread_result.scalars().all())

    now = _now()
    for item in unread_statuses:
        item.read_at = now

    await db.commit()


def build_chat_title(chat: Chat, current_user_id: UUID) -> str:
    if chat.type == ChatType.global_chat:
        return "Общий чат"

    if chat.type == ChatType.department:
        if chat.department is not None:
            return chat.department.name
        return "Чат отдела"

    for participant in chat.participants:
        if participant.user_id == current_user_id:
            continue
        if participant.user is None or not participant.user.is_active:
            continue

        employee: Employee | None = getattr(participant.user, "employee", None)
        if employee:
            parts = [employee.last_name, employee.first_name, employee.middle_name]
            full_name = " ".join(part for part in parts if part)
            if full_name:
                return full_name

        return participant.user.username if participant.user else "Личный чат"

    return "Личный чат"