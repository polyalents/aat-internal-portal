"""add department chats

Revision ID: 69270e7092bf
Revises: 9f42d7ab31ce
Create Date: 2026-04-21 09:07:11.424003
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "69270e7092bf"
down_revision: Union[str, Sequence[str], None] = "9f42d7ab31ce"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE chat_type ADD VALUE IF NOT EXISTS 'department'")

    op.add_column(
        "chats",
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_foreign_key(
        "fk_chats_department_id_departments",
        "chats",
        "departments",
        ["department_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_index(
        "ix_chats_department_id",
        "chats",
        ["department_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_chats_department_id", table_name="chats")
    op.drop_constraint("fk_chats_department_id_departments", "chats", type_="foreignkey")
    op.drop_column("chats", "department_id")