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
    head_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    head: Mapped["Employee | None"] = relationship(
        "Employee",
        foreign_keys=[head_id],
        back_populates="headed_department",
    )
    employees: Mapped[list["Employee"]] = relationship(
        "Employee",
        back_populates="department",
        foreign_keys="Employee.department_id",
    )

    def __repr__(self) -> str:
        return f"<Department id={self.id} name={self.name}>"