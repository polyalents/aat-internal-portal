"""add refresh token sessions

Revision ID: 9b1f0f6f7c2a
Revises: 4b59b4b046e8
Create Date: 2026-04-13 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b1f0f6f7c2a"
down_revision: Union[str, Sequence[str], None] = "4b59b4b046e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refresh_token_sessions",
        sa.Column("jti", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("replaced_by_jti", sa.UUID(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index(op.f("ix_refresh_token_sessions_user_id"), "refresh_token_sessions", ["user_id"], unique=False)
    op.create_index(op.f("ix_refresh_token_sessions_expires_at"), "refresh_token_sessions", ["expires_at"], unique=False)
    op.create_index(op.f("ix_refresh_token_sessions_revoked_at"), "refresh_token_sessions", ["revoked_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_refresh_token_sessions_revoked_at"), table_name="refresh_token_sessions")
    op.drop_index(op.f("ix_refresh_token_sessions_expires_at"), table_name="refresh_token_sessions")
    op.drop_index(op.f("ix_refresh_token_sessions_user_id"), table_name="refresh_token_sessions")
    op.drop_table("refresh_token_sessions")