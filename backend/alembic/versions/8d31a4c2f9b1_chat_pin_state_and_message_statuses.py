"""chat pin state and message statuses

Revision ID: 8d31a4c2f9b1
Revises: 7c8d9e0f1a2b
Create Date: 2026-04-20 11:31:03.349820

"""
from typing import Sequence, Union

from alembic import op

import sqlalchemy as sa

from sqlalchemy.dialects import postgresql

revision: str = "8d31a4c2f9b1"

down_revision: Union[str, Sequence[str], None] = "7c8d9e0f1a2b"

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:

    op.add_column("chat_read_states", sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.add_column("chat_read_states", sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_chat_read_states_is_pinned", "chat_read_states", ["is_pinned"], unique=False)

    op.create_table(

        "chat_message_statuses",

        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),

        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),

        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),

        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),

        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),

        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),

        sa.ForeignKeyConstraint(["message_id"], ["chat_messages.id"], ondelete="CASCADE"),

        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),

        sa.PrimaryKeyConstraint("id"),

        sa.UniqueConstraint("message_id", "user_id", name="uq_chat_message_statuses_message_user"),

    )

    op.create_index("ix_chat_message_statuses_message_id", "chat_message_statuses", ["message_id"], unique=False)

    op.create_index("ix_chat_message_statuses_user_id", "chat_message_statuses", ["user_id"], unique=False)

def downgrade() -> None:

    op.drop_index("ix_chat_message_statuses_user_id", table_name="chat_message_statuses")

    op.drop_index("ix_chat_message_statuses_message_id", table_name="chat_message_statuses")

    op.drop_table("chat_message_statuses")

    op.drop_index("ix_chat_read_states_is_pinned", table_name="chat_read_states")

    op.drop_column("chat_read_states", "pinned_at")

    op.drop_column("chat_read_states", "is_pinned")