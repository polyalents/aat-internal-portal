"""knowledge rich content and attachments

Revision ID: 22b22f5e801b
Revises: df812f1ae709
Create Date: 2026-04-22 08:35:20.400669

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "22b22f5e801b"
down_revision: Union[str, Sequence[str], None] = "df812f1ae709"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        "knowledge_articles",
        sa.Column("content_html", sa.Text(), nullable=False, server_default=""),
    )

    op.add_column(
        "knowledge_articles",
        sa.Column("content_text", sa.Text(), nullable=False, server_default=""),
    )

    op.execute(
        """
        UPDATE knowledge_articles
        SET
            content_html = COALESCE(content, ''),
            content_text = regexp_replace(COALESCE(content, ''), '<[^>]+>', ' ', 'g')
        """
    )

    op.alter_column("knowledge_articles", "content_html", server_default=None)
    op.alter_column("knowledge_articles", "content_text", server_default=None)

    op.create_table(
        "knowledge_article_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("article_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(length=500), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=200), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["article_id"], ["knowledge_articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_knowledge_article_attachments_article_id",
        "knowledge_article_attachments",
        ["article_id"],
        unique=False,
    )

    op.create_index(
        "ix_knowledge_article_attachments_uploaded_at",
        "knowledge_article_attachments",
        ["uploaded_at"],
        unique=False,
    )

    op.drop_column("knowledge_articles", "content")

def downgrade() -> None:
    op.add_column(
        "knowledge_articles",
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
    )

    op.execute(
        """
        UPDATE knowledge_articles
        SET content = COALESCE(content_html, '')
        """
    )

    op.alter_column("knowledge_articles", "content", server_default=None)

    op.drop_index("ix_knowledge_article_attachments_uploaded_at", table_name="knowledge_article_attachments")
    op.drop_index("ix_knowledge_article_attachments_article_id", table_name="knowledge_article_attachments")
    op.drop_table("knowledge_article_attachments")

    op.drop_column("knowledge_articles", "content_text")
    op.drop_column("knowledge_articles", "content_html")