import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)

    # ❗ ВЕРНУЛИ FK — ЭТО КЛЮЧЕВОЕ
    head_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # =========================
    # RELATIONSHIPS
    # =========================

    head: Mapped["Employee | None"] = relationship(
        "Employee",
        foreign_keys=[head_id],
    )

    employees: Mapped[list["Employee"]] = relationship(
        "Employee",
        foreign_keys="Employee.department_id",
        back_populates="department",
    )

    def __repr__(self) -> str:
        return f"<Department id={self.id} name={self.name}>"