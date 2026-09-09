"""add notifications table

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-05-13 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f8a9b0c1d2e3"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False, server_default="system"),
        sa.Column("severity", sa.String(length=32), nullable=False, server_default="info"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("target_path", sa.String(length=500), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(op.f("ix_notifications_kind"), "notifications", ["kind"], unique=False)
    op.create_index(op.f("ix_notifications_severity"), "notifications", ["severity"], unique=False)
    op.create_index(op.f("ix_notifications_read_at"), "notifications", ["read_at"], unique=False)
    op.create_index(op.f("ix_notifications_created_at"), "notifications", ["created_at"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_notifications_created_at"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_read_at"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_severity"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_kind"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")
