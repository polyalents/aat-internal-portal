from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.chat.models import ChatMessage


async def get_messages(
    db: AsyncSession,
    before: datetime | None = None,
    limit: int = 50,
) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .options(selectinload(ChatMessage.author))
        .where(ChatMessage.deleted_at.is_(None))
    )

    if before is not None:
        stmt = stmt.where(ChatMessage.created_at < before)

    stmt = stmt.order_by(ChatMessage.created_at.desc()).limit(limit + 1)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_message(db: AsyncSession, author_id: UUID, text: str) -> ChatMessage:
    message = ChatMessage(author_id=author_id, text=text.strip())
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def get_message_by_id(db: AsyncSession, msg_id: UUID) -> ChatMessage | None:
    stmt = (
        select(ChatMessage)
        .options(selectinload(ChatMessage.author))
        .where(ChatMessage.id == msg_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def soft_delete_message(db: AsyncSession, message: ChatMessage) -> ChatMessage:
    message.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(message)
    return message


async def toggle_pin_message(db: AsyncSession, message: ChatMessage) -> ChatMessage:
    message.is_pinned = not message.is_pinned
    await db.flush()
    await db.refresh(message)
    return message