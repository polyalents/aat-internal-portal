import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class KnowledgeCategory(Base):
    __tablename__ = "knowledge_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    articles: Mapped[list["KnowledgeArticle"]] = relationship(
        "KnowledgeArticle",
        back_populates="category",
    )

    def __repr__(self) -> str:
        return f"<KnowledgeCategory id={self.id} name={self.name}>"



class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_categories.id"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category: Mapped["KnowledgeCategory"] = relationship("KnowledgeCategory", back_populates="articles")
    author: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<KnowledgeArticle id={self.id} title={self.title[:40]}>"