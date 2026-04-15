"""add description to departments

Revision ID: 3109e0731988
Revises: 5f827c66ff1f
Create Date: 2026-04-15 12:45:10.428883

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3109e0731988'
down_revision: Union[str, Sequence[str], None] = '5f827c66ff1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass