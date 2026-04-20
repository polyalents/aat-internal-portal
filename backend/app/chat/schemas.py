from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.chat.models import ChatAttachmentType, ChatType


class ChatParticipantRead(BaseModel):
    user_id: UUID
    name: str | None = None
    email: str | None = None


class ChatRead(BaseModel):
    id: UUID
    type: ChatType
    title: str
    participants: list[ChatParticipantRead]
    unread_count: int = 0
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatListResponse(BaseModel):
    items: list[ChatRead]


class ChatDirectCreate(BaseModel):
    user_id: UUID


class ChatAttachmentRead(BaseModel):
    id: UUID
    filename: str
    file_path: str
    file_url: str
    file_size: int
    content_type: str
    attachment_type: ChatAttachmentType
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageStatusRead(BaseModel):
    delivered_at: datetime | None = None
    read_at: datetime | None = None

    model_config = {"from_attributes": True}


class ChatMessageRead(BaseModel):
    id: UUID
    chat_id: UUID
    author_id: UUID
    author_name: str | None = None
    text: str
    is_pinned: bool
    is_deleted: bool
    created_at: datetime
    attachments: list[ChatAttachmentRead] = []
    my_status: ChatMessageStatusRead | None = None

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    text: str = Field(default="", max_length=4000)


class ChatMessageListResponse(BaseModel):
    items: list[ChatMessageRead]
    total: int
    page: int
    size: int