"""add owner contact fields to devices

Revision ID: 4d5e6f7a8b9c
Revises: 3c4d5e6f7a8b
Create Date: 2026-03-27 20:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "4d5e6f7a8b9c"
down_revision = "3c4d5e6f7a8b"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("devices", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("owner_contacted", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(sa.Column("owner_contacted_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("devices", schema=None) as batch_op:
        batch_op.drop_column("owner_contacted_at")
        batch_op.drop_column("owner_contacted")
