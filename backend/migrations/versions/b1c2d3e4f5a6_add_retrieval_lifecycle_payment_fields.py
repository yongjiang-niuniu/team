"""add retrieval lifecycle payment fields

Revision ID: b1c2d3e4f5a6
Revises: 9a6b3e8f2c1d
Create Date: 2026-04-21 22:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "9a6b3e8f2c1d"
branch_labels = None
depends_on = None


def _column_map(inspector, table_name):
    if table_name not in inspector.get_table_names():
        return {}
    return {column["name"]: column for column in inspector.get_columns(table_name)}


def _ensure_retrieval_request_columns(inspector):
    columns = _column_map(inspector, "data_retrieval_requests")
    if not columns:
        return

    with op.batch_alter_table("data_retrieval_requests", schema=None) as batch_op:
        if "retrieval_status" not in columns:
            batch_op.add_column(
                sa.Column("retrieval_status", sa.String(length=32), nullable=False, server_default="pending")
            )
        if "payment_provider" not in columns:
            batch_op.add_column(sa.Column("payment_provider", sa.String(length=32), nullable=True))
        if "payment_status" not in columns:
            batch_op.add_column(
                sa.Column("payment_status", sa.String(length=32), nullable=False, server_default="unpaid")
            )
        if "paid_at" not in columns:
            batch_op.add_column(sa.Column("paid_at", sa.DateTime(), nullable=True))
        if "payment_reference" not in columns:
            batch_op.add_column(sa.Column("payment_reference", sa.String(length=255), nullable=True))
        if "storage_expires_at" not in columns:
            batch_op.add_column(sa.Column("storage_expires_at", sa.DateTime(), nullable=True))
        if "extended_until" not in columns:
            batch_op.add_column(sa.Column("extended_until", sa.DateTime(), nullable=True))
        if "deleted_at" not in columns:
            batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))
        if "requested_at" not in columns:
            batch_op.add_column(sa.Column("requested_at", sa.DateTime(), nullable=True))
        if "updated_at" not in columns:
            batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))

    op.execute(
        text(
            """
            UPDATE data_retrieval_requests
            SET retrieval_status = COALESCE(NULLIF(TRIM(retrieval_status), ''), NULLIF(TRIM(status), ''), 'pending'),
                payment_status = COALESCE(NULLIF(TRIM(payment_status), ''), 'unpaid'),
                requested_at = COALESCE(requested_at, created_at, CURRENT_TIMESTAMP),
                updated_at = COALESCE(updated_at, requested_at, created_at, CURRENT_TIMESTAMP)
            WHERE retrieval_status IS NULL
               OR TRIM(retrieval_status) = ''
               OR payment_status IS NULL
               OR TRIM(payment_status) = ''
               OR requested_at IS NULL
               OR updated_at IS NULL
            """
        )
    )


def _ensure_retrieval_download_columns(inspector):
    columns = _column_map(inspector, "data_retrieval_downloads")
    if not columns:
        return

    with op.batch_alter_table("data_retrieval_downloads", schema=None) as batch_op:
        if "issued_at" not in columns:
            batch_op.add_column(sa.Column("issued_at", sa.DateTime(), nullable=True))
        if "revoked_at" not in columns:
            batch_op.add_column(sa.Column("revoked_at", sa.DateTime(), nullable=True))
        if "consumed_at" not in columns:
            batch_op.add_column(sa.Column("consumed_at", sa.DateTime(), nullable=True))

    op.execute(
        text(
            """
            UPDATE data_retrieval_downloads
            SET issued_at = COALESCE(issued_at, created_at, CURRENT_TIMESTAMP)
            WHERE issued_at IS NULL
            """
        )
    )


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    _ensure_retrieval_request_columns(inspector)
    inspector = sa.inspect(bind)

    _ensure_retrieval_download_columns(inspector)


def downgrade():
    # Keep this revision non-destructive for existing dev databases that may
    # already rely on the expanded runtime schema.
    pass
