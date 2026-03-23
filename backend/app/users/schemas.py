from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.users.models import UserRole


class UserRead(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    role: UserRole
    is_it_manager: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole = UserRole.employee
    is_it_manager: bool = False


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    role: UserRole | None = None
    is_it_manager: bool | None = None
    is_active: bool | None = None
    password: str | None = Field(None, min_length=6, max_length=128)


class UserListResponse(BaseModel):
    items: list[UserRead]
    total: int
    page: int
    size: int