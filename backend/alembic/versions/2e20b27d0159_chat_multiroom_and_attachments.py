"""chat multiroom and attachments

Revision ID: 2e20b27d0159
Revises: 3109e0731988
Create Date: 2026-04-20
"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "2e20b27d0159"
down_revision: Union[str, Sequence[str], None] = "3109e0731988"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


chat_type = postgresql.ENUM(
    "global",
    "direct",
    name="chat_type",
    create_type=False,
)

chat_attachment_type = postgresql.ENUM(
    "image",
    "document",
    name="chat_attachment_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    chat_type.create(bind, checkfirst=True)
    chat_attachment_type.create(bind, checkfirst=True)

    op.create_table(
        "chats",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", chat_type, nullable=False),
        sa.Column("direct_key", sa.String(length=80), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("direct_key", name="uq_chats_direct_key"),
    )
    op.create_index("ix_chats_type", "chats", ["type"], unique=False)
    op.create_index("ix_chats_created_at", "chats", ["created_at"], unique=False)

    op.create_table(
        "chat_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chat_id"], ["chats.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chat_id", "user_id", name="uq_chat_participants_chat_user"),
    )
    op.create_index("ix_chat_participants_chat_id", "chat_participants", ["chat_id"], unique=False)
    op.create_index("ix_chat_participants_user_id", "chat_participants", ["user_id"], unique=False)

    op.add_column("chat_messages", sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_chat_messages_chat_id", "chat_messages", ["chat_id"], unique=False)
    op.create_foreign_key(
        "fk_chat_messages_chat_id",
        "chat_messages",
        "chats",
        ["chat_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_table(
        "chat_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(length=500), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=200), nullable=False),
        sa.Column("attachment_type", chat_attachment_type, nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["message_id"], ["chat_messages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_attachments_message_id", "chat_attachments", ["message_id"], unique=False)
    op.create_index("ix_chat_attachments_uploaded_at", "chat_attachments", ["uploaded_at"], unique=False)
    op.create_index("ix_chat_attachments_attachment_type", "chat_attachments", ["attachment_type"], unique=False)

    global_chat_id = uuid.uuid4()

    op.execute(
        sa.text(
            """
            INSERT INTO chats (id, type, direct_key, created_by)
            VALUES (:chat_id, 'global', NULL, NULL)
            """
        ).bindparams(chat_id=global_chat_id)
    )

    op.execute(
        sa.text(
            """
            UPDATE chat_messages
            SET chat_id = :chat_id
            WHERE chat_id IS NULL
            """
        ).bindparams(chat_id=global_chat_id)
    )

    user_ids = [row[0] for row in bind.execute(sa.text("SELECT id FROM users")).fetchall()]
    if user_ids:
        op.bulk_insert(
            sa.table(
                "chat_participants",
                sa.column("id", postgresql.UUID(as_uuid=True)),
                sa.column("chat_id", postgresql.UUID(as_uuid=True)),
                sa.column("user_id", postgresql.UUID(as_uuid=True)),
            ),
            [
                {
                    "id": uuid.uuid4(),
                    "chat_id": global_chat_id,
                    "user_id": user_id,
                }
                for user_id in user_ids
            ],
        )

    op.alter_column("chat_messages", "chat_id", nullable=False)


def downgrade() -> None:
    op.drop_index("ix_chat_attachments_attachment_type", table_name="chat_attachments")
    op.drop_index("ix_chat_attachments_uploaded_at", table_name="chat_attachments")
    op.drop_index("ix_chat_attachments_message_id", table_name="chat_attachments")
    op.drop_table("chat_attachments")

    op.drop_constraint("fk_chat_messages_chat_id", "chat_messages", type_="foreignkey")
    op.drop_index("ix_chat_messages_chat_id", table_name="chat_messages")
    op.drop_column("chat_messages", "chat_id")

    op.drop_index("ix_chat_participants_user_id", table_name="chat_participants")
    op.drop_index("ix_chat_participants_chat_id", table_name="chat_participants")
    op.drop_table("chat_participants")

    op.drop_index("ix_chats_created_at", table_name="chats")
    op.drop_index("ix_chats_type", table_name="chats")
    op.drop_table("chats")

    bind = op.get_bind()
    chat_attachment_type.drop(bind, checkfirst=True)
    chat_type.drop(bind, checkfirst=True)