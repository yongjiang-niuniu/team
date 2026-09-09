"""add is visible to devices

Revision ID: 2b3c4d5e6f7a
Revises: 8c9d0e1f2a3b
Create Date: 2026-03-27 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2b3c4d5e6f7a"
down_revision = "8c9d0e1f2a3b"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("devices", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.true())
        )


def downgrade():
    with op.batch_alter_table("devices", schema=None) as batch_op:
        batch_op.drop_column("is_visible")
