from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DepartmentRead(BaseModel):
    id: UUID
    name: str
    head_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    head_id: UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    head_id: UUID | None = None