from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.chat.models import ChatMessage


async def get_messages(
    db: AsyncSession,
    page: int = 1,
    size: int = 50,
) -> tuple[list[ChatMessage], int]:
    count_stmt = select(func.count()).select_from(ChatMessage)

    stmt = (
        select(ChatMessage)
        .options(selectinload(ChatMessage.author))
        .order_by(ChatMessage.is_pinned.desc(), ChatMessage.created_at.asc())
        .offset((page - 1) * size)
        .limit(size)
    )

    total = (await db.execute(count_stmt)).scalar() or 0
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def get_message_by_id(db: AsyncSession, message_id: UUID) -> ChatMessage | None:
    result = await db.execute(
        select(ChatMessage)
        .options(selectinload(ChatMessage.author))
        .where(ChatMessage.id == message_id)
    )
    return result.scalar_one_or_none()


async def create_message(
    db: AsyncSession,
    author_id: UUID,
    text: str,
) -> ChatMessage:
    message = ChatMessage(
        author_id=author_id,
        text=text.strip(),
    )
    db.add(message)
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