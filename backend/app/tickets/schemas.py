from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.tickets.enums import TicketPriority, TicketStatus


class TicketCategoryRead(BaseModel):
    id: UUID
    name: str
    is_active: bool

    model_config = {"from_attributes": True}


class TicketCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class TicketCategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    is_active: bool | None = None


class TicketRead(BaseModel):
    id: UUID
    number: int
    subject: str
    description: str
    category_id: UUID
    category_name: str | None = None
    priority: TicketPriority
    status: TicketStatus
    author_id: UUID
    author_name: str | None = None
    assignee_id: UUID | None
    assignee_name: str | None = None
    contact_phone: str | None
    contact_email: EmailStr | None
    created_at: datetime
    updated_at: datetime
    escalated_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1)
    category_id: UUID
    priority: TicketPriority = TicketPriority.normal
    contact_phone: str | None = Field(None, max_length=50)
    contact_email: EmailStr | None = None


class TicketUpdate(BaseModel):
    status: TicketStatus | None = None
    assignee_id: UUID | None = None
    priority: TicketPriority | None = None


class TicketListResponse(BaseModel):
    items: list[TicketRead]
    total: int
    page: int
    size: int


class CommentRead(BaseModel):
    id: UUID
    ticket_id: UUID
    author_id: UUID
    author_name: str | None = None
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    text: str = Field(..., min_length=1)


class HistoryRead(BaseModel):
    id: UUID
    ticket_id: UUID
    changed_by: UUID
    changed_by_name: str | None = None
    field: str
    old_value: str | None
    new_value: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AttachmentRead(BaseModel):
    id: UUID
    ticket_id: UUID
    filename: str
    file_size: int
    content_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class TicketStats(BaseModel):
    total: int = 0
    new: int = 0
    in_progress: int = 0
    waiting: int = 0
    escalated: int = 0
    completed: int = 0
    rejected: int = 0