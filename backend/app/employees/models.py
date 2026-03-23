import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=True
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    position: Mapped[str] = mapped_column(String(200), nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
    )

    room_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    internal_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mobile_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True
    )

    vacation_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    vacation_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    telegram_chat_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # =========================
    # RELATIONSHIPS
    # =========================

    user: Mapped["User | None"] = relationship("User", back_populates="employee")

    department: Mapped["Department | None"] = relationship(
        "Department",
        foreign_keys=[department_id],
        back_populates="employees",
    )

    # ❗ ВАЖНО: убрали back_populates и указали primaryjoin
    headed_department: Mapped["Department | None"] = relationship(
        "Department",
        primaryjoin="Department.head_id == Employee.id",
        viewonly=True,
        uselist=False,
    )

    manager: Mapped["Employee | None"] = relationship(
        "Employee",
        remote_side="Employee.id",
        back_populates="subordinates",
    )

    subordinates: Mapped[list["Employee"]] = relationship(
        "Employee",
        back_populates="manager",
    )

    # =========================
    # HELPERS
    # =========================

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        return " ".join(parts)

    @property
    def is_on_vacation(self) -> bool:
        if not self.vacation_start or not self.vacation_end:
            return False
        today = date.today()
        return self.vacation_start <= today <= self.vacation_end

    def __repr__(self) -> str:
        return f"<Employee id={self.id} name={self.last_name} {self.first_name}>"