"""add department parent id

Revision ID: 5f827c66ff1f
Revises: 9b1f0f6f7c2a
Create Date: 2026-04-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5f827c66ff1f"
down_revision: Union[str, Sequence[str], None] = "9b1f0f6f7c2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("parent_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_departments_parent_id_departments",
        "departments",
        "departments",
        ["parent_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_departments_parent_id_departments", "departments", type_="foreignkey")
    op.drop_column("departments", "parent_id")