"""add auth provider and google sub to users

Revision ID: 8c9d0e1f2a3b
Revises: 1a2b3c4d5e6f
Create Date: 2026-03-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8c9d0e1f2a3b"
down_revision = "1a2b3c4d5e6f"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("auth_provider", sa.String(length=20), nullable=False, server_default="local"))
        batch_op.add_column(sa.Column("google_sub", sa.String(length=255), nullable=True))
        batch_op.create_unique_constraint("uq_users_google_sub", ["google_sub"])


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint("uq_users_google_sub", type_="unique")
        batch_op.drop_column("google_sub")
        batch_op.drop_column("auth_provider")
