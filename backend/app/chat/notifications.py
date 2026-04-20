from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.chat.models import Chat, ChatMessage, ChatMessageStatus, ChatParticipant, ChatType
from app.notifications.email import build_unread_chat_email, send_email
from app.users.models import User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _direct_chat_title(chat: Chat, recipient_id) -> str:
    for participant in chat.participants:
        if participant.user_id == recipient_id:
            continue

        user = participant.user
        if user is not None:
            return user.username or user.email or "Личный чат"

    return "Личный чат"


async def send_unread_chat_email_notifications(
    db: AsyncSession,
    portal_url: str,
) -> int:
    threshold = _now() - timedelta(minutes=10)

    result = await db.execute(
        select(ChatMessageStatus)
        .options(
            selectinload(ChatMessageStatus.user),
            selectinload(ChatMessageStatus.message).selectinload(ChatMessage.author),
            selectinload(ChatMessageStatus.message).selectinload(ChatMessage.attachments),
            selectinload(ChatMessageStatus.message)
            .selectinload(ChatMessage.chat)
            .selectinload(Chat.participants)
            .selectinload(ChatParticipant.user),
        )
        .join(ChatMessage, ChatMessage.id == ChatMessageStatus.message_id)
        .join(Chat, Chat.id == ChatMessage.chat_id)
        .where(
            Chat.type == ChatType.direct,
            ChatMessageStatus.read_at.is_(None),
            ChatMessageStatus.email_notified_at.is_(None),
            ChatMessageStatus.delivered_at.is_not(None),
            ChatMessageStatus.delivered_at <= threshold,
            ChatMessage.is_deleted.is_(False),
        )
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
    )
    statuses = list(result.scalars().unique().all())

    latest_per_chat_user: dict[tuple[str, str], ChatMessageStatus] = {}

    for status in statuses:
        recipient = status.user
        message = status.message

        if recipient is None or message is None or message.chat is None:
            continue
        if not recipient.email:
            continue
        if message.author is None:
            continue
        if message.author_id == recipient.id:
            continue
        if message.is_deleted:
            continue

        has_text = bool(message.text and message.text.strip())
        has_attachments = bool(message.attachments)

        if not has_text and not has_attachments:
            continue

        key = (str(message.chat_id), str(recipient.id))
        if key not in latest_per_chat_user:
            latest_per_chat_user[key] = status

    sent_count = 0

    for status in latest_per_chat_user.values():
        recipient = status.user
        message = status.message

        if recipient is None or message is None or message.chat is None or message.author is None:
            continue

        chat = message.chat
        sender_name = message.author.username or "Сотрудник"
        recipient_name = recipient.username or recipient.email
        chat_title = _direct_chat_title(chat, recipient.id)

        if message.text and message.text.strip():
            message_text = message.text.strip()
        elif message.attachments:
            message_text = "Вложение"
        else:
            continue

        body = build_unread_chat_email(
            recipient_name=recipient_name,
            sender_name=sender_name,
            chat_title=chat_title,
            message_text=message_text,
            portal_url=portal_url,
            chat_id=str(chat.id),
        )

        ok = await send_email(
            to=recipient.email,
            subject="Непрочитанное сообщение в чате",
            body_html=body,
        )

        if ok:
            status.email_notified_at = _now()
            sent_count += 1

    if sent_count:
        await db.commit()

    return sent_count