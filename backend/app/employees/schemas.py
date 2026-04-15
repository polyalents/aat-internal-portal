from datetime import date, datetime
from uuid import UUID
import re

from pydantic import BaseModel, Field, field_validator


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


class EmployeeRead(BaseModel):
    id: UUID
    user_id: UUID | None
    first_name: str
    last_name: str
    middle_name: str | None
    full_name: str
    position: str
    department_id: UUID | None
    department_name: str | None = None
    room_number: str | None
    internal_phone: str | None
    mobile_phone: str | None
    email: str
    birth_date: date | None
    photo_url: str | None
    manager_id: UUID | None
    manager_name: str | None = None
    vacation_start: date | None
    vacation_end: date | None
    is_on_vacation: bool
    is_active: bool
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


class EmployeeCreate(BaseModel):
    user_id: UUID | None = None
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    position: str = Field(..., min_length=1, max_length=200)
    department_id: UUID | None = None
    room_number: str | None = Field(None, max_length=50)
    internal_phone: str | None = Field(None, max_length=50)
    mobile_phone: str | None = Field(None, max_length=50)
    email: str
    birth_date: date | None = None
    manager_id: UUID | None = None
    vacation_start: date | None = None
    vacation_end: date | None = None
    telegram_chat_id: str | None = Field(None, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        validated = _validate_relaxed_email(value)
        if validated is None:
            raise ValueError("Email is required")
        return validated


class EmployeeUpdate(BaseModel):
    user_id: UUID | None = None
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    position: str | None = Field(None, min_length=1, max_length=200)
    department_id: UUID | None = None
    room_number: str | None = Field(None, max_length=50)
    internal_phone: str | None = Field(None, max_length=50)
    mobile_phone: str | None = Field(None, max_length=50)
    email: str | None = None
    birth_date: date | None = None
    manager_id: UUID | None = None
    vacation_start: date | None = None
    vacation_end: date | None = None
    is_active: bool | None = None
    telegram_chat_id: str | None = Field(None, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return _validate_relaxed_email(value)


class EmployeeListResponse(BaseModel):
    items: list[EmployeeRead]
    total: int
    page: int
    size: int


class OrgTreeEmployeeNode(BaseModel):
    id: UUID
    full_name: str
    position: str
    photo_url: str | None = None
    is_on_vacation: bool = False
    children: list["OrgTreeEmployeeNode"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class OrgTreeDepartmentNode(BaseModel):
    id: UUID
    name: str
    head_id: UUID | None = None
    head_name: str | None = None
    employee_count: int = 0
    children_count: int = 0
    employees: list[OrgTreeEmployeeNode] = Field(default_factory=list)
    children: list["OrgTreeDepartmentNode"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class BirthdayEntry(BaseModel):
    id: UUID
    full_name: str
    position: str
    department_name: str | None = None
    birth_date: date
    photo_url: str | None = None

    model_config = {"from_attributes": True}