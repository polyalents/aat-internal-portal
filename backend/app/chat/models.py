import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    text: Mapped[str] = mapped_column(Text, nullable=False)

    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    author = relationship("User")

    def __repr__(self) -> str:
        return f"<ChatMessage id={self.id} author_id={self.author_id}>"