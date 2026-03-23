"""initial clean schema

Revision ID: 4b59b4b046e8
Revises:
Create Date: 2026-03-23 11:34:35.520767
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4b59b4b046e8"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1")

    op.create_table(
        "departments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("head_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "knowledge_categories",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(length=200), nullable=False),
        sa.Column("value", sa.Text(), server_default="", nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )

    op.create_table(
        "ticket_categories",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("employee", "it_specialist", "admin", name="user_role"), nullable=False),
        sa.Column("is_it_manager", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "announcements",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_announcements_author_id"), "announcements", ["author_id"], unique=False)
    op.create_index(op.f("ix_announcements_published_at"), "announcements", ["published_at"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_author_id"), "chat_messages", ["author_id"], unique=False)
    op.create_index(op.f("ix_chat_messages_created_at"), "chat_messages", ["created_at"], unique=False)

    op.create_table(
        "employees",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("middle_name", sa.String(length=100), nullable=True),
        sa.Column("position", sa.String(length=200), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=True),
        sa.Column("room_number", sa.String(length=50), nullable=True),
        sa.Column("internal_phone", sa.String(length=50), nullable=True),
        sa.Column("mobile_phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("manager_id", sa.UUID(), nullable=True),
        sa.Column("vacation_start", sa.Date(), nullable=True),
        sa.Column("vacation_end", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("telegram_chat_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
        sa.ForeignKeyConstraint(["manager_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_employees_email"), "employees", ["email"], unique=False)

    op.create_table(
        "knowledge_articles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["knowledge_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_knowledge_articles_author_id"), "knowledge_articles", ["author_id"], unique=False)
    op.create_index(op.f("ix_knowledge_articles_category_id"), "knowledge_articles", ["category_id"], unique=False)
    op.create_index(op.f("ix_knowledge_articles_created_at"), "knowledge_articles", ["created_at"], unique=False)
    op.create_index(op.f("ix_knowledge_articles_title"), "knowledge_articles", ["title"], unique=False)

    op.create_table(
        "tickets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("number", sa.Integer(), server_default=sa.text("nextval('ticket_number_seq')"), nullable=False),
        sa.Column("subject", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("priority", sa.Enum("now", "today", "normal", name="ticket_priority"), nullable=False),
        sa.Column("status", sa.Enum("new", "in_progress", "waiting", "completed", "rejected", "escalated", name="ticket_status"), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("assignee_id", sa.UUID(), nullable=True),
        sa.Column("contact_phone", sa.String(length=50), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["ticket_categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tickets_assignee_id"), "tickets", ["assignee_id"], unique=False)
    op.create_index(op.f("ix_tickets_author_id"), "tickets", ["author_id"], unique=False)
    op.create_index(op.f("ix_tickets_category_id"), "tickets", ["category_id"], unique=False)
    op.create_index(op.f("ix_tickets_created_at"), "tickets", ["created_at"], unique=False)
    op.create_index(op.f("ix_tickets_number"), "tickets", ["number"], unique=True)
    op.create_index(op.f("ix_tickets_status"), "tickets", ["status"], unique=False)

    op.create_table(
        "ticket_attachments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(length=500), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=200), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ticket_attachments_ticket_id"), "ticket_attachments", ["ticket_id"], unique=False)
    op.create_index(op.f("ix_ticket_attachments_uploaded_at"), "ticket_attachments", ["uploaded_at"], unique=False)

    op.create_table(
        "ticket_comments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ticket_comments_author_id"), "ticket_comments", ["author_id"], unique=False)
    op.create_index(op.f("ix_ticket_comments_created_at"), "ticket_comments", ["created_at"], unique=False)
    op.create_index(op.f("ix_ticket_comments_ticket_id"), "ticket_comments", ["ticket_id"], unique=False)

    op.create_table(
        "ticket_history",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("ticket_id", sa.UUID(), nullable=False),
        sa.Column("changed_by", sa.UUID(), nullable=False),
        sa.Column("field", sa.String(length=100), nullable=False),
        sa.Column("old_value", sa.String(length=500), nullable=True),
        sa.Column("new_value", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ticket_history_changed_by"), "ticket_history", ["changed_by"], unique=False)
    op.create_index(op.f("ix_ticket_history_created_at"), "ticket_history", ["created_at"], unique=False)
    op.create_index(op.f("ix_ticket_history_ticket_id"), "ticket_history", ["ticket_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ticket_history_ticket_id"), table_name="ticket_history")
    op.drop_index(op.f("ix_ticket_history_created_at"), table_name="ticket_history")
    op.drop_index(op.f("ix_ticket_history_changed_by"), table_name="ticket_history")
    op.drop_table("ticket_history")

    op.drop_index(op.f("ix_ticket_comments_ticket_id"), table_name="ticket_comments")
    op.drop_index(op.f("ix_ticket_comments_created_at"), table_name="ticket_comments")
    op.drop_index(op.f("ix_ticket_comments_author_id"), table_name="ticket_comments")
    op.drop_table("ticket_comments")

    op.drop_index(op.f("ix_ticket_attachments_uploaded_at"), table_name="ticket_attachments")
    op.drop_index(op.f("ix_ticket_attachments_ticket_id"), table_name="ticket_attachments")
    op.drop_table("ticket_attachments")

    op.drop_index(op.f("ix_tickets_status"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_number"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_created_at"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_category_id"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_author_id"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_assignee_id"), table_name="tickets")
    op.drop_table("tickets")

    op.drop_index(op.f("ix_knowledge_articles_title"), table_name="knowledge_articles")
    op.drop_index(op.f("ix_knowledge_articles_created_at"), table_name="knowledge_articles")
    op.drop_index(op.f("ix_knowledge_articles_category_id"), table_name="knowledge_articles")
    op.drop_index(op.f("ix_knowledge_articles_author_id"), table_name="knowledge_articles")
    op.drop_table("knowledge_articles")

    op.drop_index(op.f("ix_employees_email"), table_name="employees")
    op.drop_table("employees")

    op.drop_index(op.f("ix_chat_messages_created_at"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_author_id"), table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index(op.f("ix_announcements_published_at"), table_name="announcements")
    op.drop_index(op.f("ix_announcements_author_id"), table_name="announcements")
    op.drop_table("announcements")

    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    op.drop_table("ticket_categories")
    op.drop_table("system_settings")
    op.drop_table("knowledge_categories")
    op.drop_table("departments")

    op.execute("DROP SEQUENCE IF EXISTS ticket_number_seq")