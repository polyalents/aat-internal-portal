import json
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import verify_access_token
from app.auth.service import get_user_by_id
from app.chat.manager import manager
from app.chat.schemas import ChatMessageListResponse, ChatMessageRead
from app.chat.service import (
    create_message,
    get_message_by_id,
    get_messages,
    soft_delete_message,
    toggle_pin_message,
)
from app.database import async_session_factory, get_db
from app.dependencies import get_current_user, require_admin
from app.users.models import User, UserRole

router = APIRouter()


def _msg_to_read(message) -> ChatMessageRead:
    return ChatMessageRead(
        id=message.id,
        author_id=message.author_id,
        author_name=message.author.username if message.author else None,
        text=message.text if not message.is_deleted else "[удалено]",
        is_pinned=message.is_pinned,
        created_at=message.created_at,
        is_deleted=message.is_deleted,
    )


@router.get("/messages", response_model=ChatMessageListResponse)
async def list_messages(
    before: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ChatMessageListResponse:
    messages = await get_messages(db, before=before, limit=limit)
    has_more = len(messages) > limit

    if has_more:
        messages = messages[:limit]

    messages.reverse()
    return ChatMessageListResponse(
        items=[_msg_to_read(message) for message in messages],
        has_more=has_more,
    )


@router.delete("/messages/{msg_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    msg_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    message = await get_message_by_id(db, msg_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.author_id != current_user.id and current_user.role not in (UserRole.it_specialist, UserRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await soft_delete_message(db, message)
    await manager.broadcast(
        {
            "type": "message_deleted",
            "message_id": str(msg_id),
        }
    )


@router.patch("/messages/{msg_id}/pin", response_model=ChatMessageRead)
async def pin_message(
    msg_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ChatMessageRead:
    message = await get_message_by_id(db, msg_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    message = await toggle_pin_message(db, message)
    await manager.broadcast(
        {
            "type": "message_pinned",
            "message_id": str(msg_id),
            "is_pinned": message.is_pinned,
        }
    )
    return _msg_to_read(message)


@router.websocket("/ws")
async def websocket_chat(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return

    payload = verify_access_token(token)
    if payload is None or "sub" not in payload:
        await websocket.close(code=1008, reason="Invalid token")
        return

    try:
        user_id = UUID(payload["sub"])
    except ValueError:
        await websocket.close(code=1008, reason="Invalid token subject")
        return

    async with async_session_factory() as db:
        user = await get_user_by_id(db, user_id)
        if user is None:
            await websocket.close(code=1008, reason="User not found")
            return
        username = user.username

    await manager.connect(user_id, websocket)

    try:
        while True:
            raw_data = await websocket.receive_text()

            try:
                message_data = json.loads(raw_data)
            except json.JSONDecodeError:
                continue

            text = str(message_data.get("text", "")).strip()
            if not text or len(text) > 4000:
                continue

            async with async_session_factory() as db:
                message = await create_message(db, user_id, text)
                await db.commit()
                message_id = message.id
                created_at = message.created_at

            await manager.broadcast(
                {
                    "type": "new_message",
                    "id": str(message_id),
                    "author_id": str(user_id),
                    "author_name": username,
                    "text": text,
                    "created_at": str(created_at),
                    "is_pinned": False,
                }
            )

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception:
        manager.disconnect(user_id)
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except Exception:
            pass