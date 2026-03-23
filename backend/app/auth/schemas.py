from uuid import UUID
import enum

from pydantic import BaseModel, Field


class TokenType(str, enum.Enum):
    access = "access"
    refresh = "refresh"


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=3, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    sub: UUID
    type: TokenType
    role: str | None = None