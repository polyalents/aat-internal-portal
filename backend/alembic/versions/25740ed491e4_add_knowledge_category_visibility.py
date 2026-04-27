"""add knowledge category visibility

Revision ID: 25740ed491e4
Revises: 22b22f5e801b
Create Date: 2026-04-27 00:00:00.000000
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "25740ed491e4"
down_revision: Union[str, Sequence[str], None] = "22b22f5e801b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "knowledge_categories",
        sa.Column(
            "is_user_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    conn = op.get_bind()

    exists = conn.execute(
        sa.text(
            """
            SELECT id
            FROM knowledge_categories
            WHERE lower(name) = 'пользователю'
            LIMIT 1
            """
        )
    ).scalar()

    if not exists:
        conn.execute(
            sa.text(
                """
                INSERT INTO knowledge_categories (id, name, sort_order, is_user_visible)
                VALUES (:id, :name, :sort_order, :is_user_visible)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "name": "Пользователю",
                "sort_order": 0,
                "is_user_visible": True,
            },
        )
    else:
        conn.execute(
            sa.text(
                """
                UPDATE knowledge_categories
                SET is_user_visible = true
                WHERE id = :id
                """
            ),
            {"id": str(exists)},
        )

    op.alter_column("knowledge_categories", "is_user_visible", server_default=None)


def downgrade() -> None:
    op.drop_column("knowledge_categories", "is_user_visible")