from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatMessageRead(BaseModel):
    id: UUID
    author_id: UUID
    author_name: str | None = None
    text: str
    is_pinned: bool
    is_deleted: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class ChatMessageListResponse(BaseModel):
    items: list[ChatMessageRead]
    total: int
    page: int
    size: int