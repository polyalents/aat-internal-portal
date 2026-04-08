from datetime import datetime
from uuid import UUID
import re

from pydantic import BaseModel, Field, field_validator

from app.users.models import UserRole


RELAXED_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_relaxed_email(value: str | None) -> str | None:
    if value is None:
        return None

    value = value.strip().lower()
    if not value:
        raise ValueError("Email must not be empty")

    if not RELAXED_EMAIL_RE.match(value):
        raise ValueError("Invalid email format")

    return value


class UserRead(BaseModel):
    id: UUID
    username: str
    email: str
    role: UserRole
    is_it_manager: bool
    is_active: bool
    employee_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        validated = _validate_relaxed_email(value)
        if validated is None:
            raise ValueError("Email is required")
        return validated


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole = UserRole.employee
    is_it_manager: bool = False

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        validated = _validate_relaxed_email(value)
        if validated is None:
            raise ValueError("Email is required")
        return validated


class UserUpdate(BaseModel):
    email: str | None = None
    role: UserRole | None = None
    is_it_manager: bool | None = None
    is_active: bool | None = None
    password: str | None = Field(None, min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return _validate_relaxed_email(value)


class UserPasswordChange(BaseModel):
    password: str = Field(..., min_length=6, max_length=128)


class UserListResponse(BaseModel):
    items: list[UserRead]
    total: int
    page: int
    size: int