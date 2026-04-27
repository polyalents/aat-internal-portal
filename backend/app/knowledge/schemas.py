from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class KnowledgeCategoryRead(BaseModel):
    id: UUID
    name: str
    sort_order: int
    is_user_visible: bool

    model_config = {"from_attributes": True}


class KnowledgeCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sort_order: int = 0
    is_user_visible: bool = False


class KnowledgeCategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    sort_order: int | None = None
    is_user_visible: bool | None = None


class KnowledgeAttachmentRead(BaseModel):
    id: UUID
    article_id: UUID
    filename: str
    file_path: str
    file_url: str
    file_size: int
    content_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class ArticleRead(BaseModel):
    id: UUID
    title: str
    content_html: str
    content_text: str
    category_id: UUID
    category_name: str | None = None
    author_id: UUID
    author_name: str | None = None
    created_at: datetime
    updated_at: datetime
    attachments: list[KnowledgeAttachmentRead] = []

    model_config = {"from_attributes": True}


class ArticleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content_html: str = Field(..., min_length=1)
    content_text: str = Field(..., min_length=1)
    category_id: UUID


class ArticleUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    content_html: str | None = None
    content_text: str | None = None
    category_id: UUID | None = None


class ArticleListResponse(BaseModel):
    items: list[ArticleRead]
    total: int
    page: int
    size: int