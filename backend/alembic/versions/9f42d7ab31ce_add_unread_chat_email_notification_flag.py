"""add unread chat email notification flag

Revision ID: 9f42d7ab31ce
Revises: 8d31a4c2f9b1
Create Date: 2026-04-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f42d7ab31ce"
down_revision: Union[str, Sequence[str], None] = "8d31a4c2f9b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_message_statuses",
        sa.Column("email_notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_message_statuses", "email_notified_at")