import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    employee = "employee"
    it_specialist = "it_specialist"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.employee,
    )
    is_it_manager: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="user", uselist=False)
    authored_tickets: Mapped[list["Ticket"]] = relationship(
        "Ticket",
        back_populates="author",
        foreign_keys="Ticket.author_id",
    )
    assigned_tickets: Mapped[list["Ticket"]] = relationship(
        "Ticket",
        back_populates="assignee",
        foreign_keys="Ticket.assignee_id",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} role={self.role.value}>"