"""add chat read states

Revision ID: 7c8d9e0f1a2b
Revises: 2e20b27d0159
Create Date: 2026-04-20 11:18:49.427486
"""
from typing import Sequence, Union

from alembic import op

import sqlalchemy as sa

from sqlalchemy.dialects import postgresql

revision: str = "7c8d9e0f1a2b"

down_revision: Union[str, Sequence[str], None] = "2e20b27d0159"

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:

    op.create_table(

        "chat_read_states",

        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),

        sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=False),

        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),

        sa.Column("last_read_message_id", postgresql.UUID(as_uuid=True), nullable=True),

        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),

        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),

        sa.ForeignKeyConstraint(["chat_id"], ["chats.id"], ondelete="CASCADE"),

        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),

        sa.ForeignKeyConstraint(["last_read_message_id"], ["chat_messages.id"], ondelete="SET NULL"),

        sa.PrimaryKeyConstraint("id"),

        sa.UniqueConstraint("chat_id", "user_id", name="uq_chat_read_states_chat_user"),

    )

    op.create_index("ix_chat_read_states_chat_id", "chat_read_states", ["chat_id"], unique=False)

    op.create_index("ix_chat_read_states_user_id", "chat_read_states", ["user_id"], unique=False)

def downgrade() -> None:

    op.drop_index("ix_chat_read_states_user_id", table_name="chat_read_states")

    op.drop_index("ix_chat_read_states_chat_id", table_name="chat_read_states")

    op.drop_table("chat_read_states")