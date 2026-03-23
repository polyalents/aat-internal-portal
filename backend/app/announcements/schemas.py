from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AnnouncementRead(BaseModel):
    id: UUID
    title: str
    content: str
    author_id: UUID
    author_name: str | None = None
    published_at: datetime
    expires_at: datetime | None
    is_active: bool

    model_config = {"from_attributes": True}


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    expires_at: datetime | None = None


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    content: str | None = None
    expires_at: datetime | None = None
    is_active: bool | None = None


class AnnouncementListResponse(BaseModel):
    items: list[AnnouncementRead]
    total: int
    page: int
    size: int