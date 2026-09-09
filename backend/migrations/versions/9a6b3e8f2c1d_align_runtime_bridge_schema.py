"""align runtime bridge schema

Revision ID: 9a6b3e8f2c1d
Revises: 4d5e6f7a8b9c
Create Date: 2026-04-21 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "9a6b3e8f2c1d"
down_revision = "4d5e6f7a8b9c"
branch_labels = None
depends_on = None


def _column_map(inspector, table_name):
    if table_name not in inspector.get_table_names():
        return {}
    return {column["name"]: column for column in inspector.get_columns(table_name)}


def _ensure_users_alignment(inspector):
    columns = _column_map(inspector, "users")
    if not columns:
        return

    if "full_name" in columns:
        return

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("full_name", sa.String(length=255), nullable=True))


def _ensure_collection_requests_alignment(inspector):
    columns = _column_map(inspector, "collection_requests")
    if not columns:
        return

    needs_batch = any(
        [
            "device_id" not in columns,
            "pickup_address" not in columns,
            "contact_phone" not in columns,
            "scheduled_time" not in columns,
            "assigned_staff_id" not in columns,
            "staff_note" not in columns,
            "updated_at" not in columns,
            "item_name" in columns and not columns["item_name"]["nullable"],
            "category" in columns and not columns["category"]["nullable"],
            "condition" in columns and not columns["condition"]["nullable"],
        ]
    )
    if not needs_batch:
        return

    with op.batch_alter_table("collection_requests", schema=None) as batch_op:
        if "item_name" in columns and not columns["item_name"]["nullable"]:
            batch_op.alter_column(
                "item_name",
                existing_type=sa.String(length=120),
                nullable=True,
            )
        if "category" in columns and not columns["category"]["nullable"]:
            batch_op.alter_column(
                "category",
                existing_type=sa.String(length=50),
                nullable=True,
            )
        if "condition" in columns and not columns["condition"]["nullable"]:
            batch_op.alter_column(
                "condition",
                existing_type=sa.String(length=50),
                nullable=True,
            )
        if "device_id" not in columns:
            batch_op.add_column(sa.Column("device_id", sa.Integer(), nullable=True))
        if "pickup_address" not in columns:
            batch_op.add_column(sa.Column("pickup_address", sa.Text(), nullable=True))
        if "contact_phone" not in columns:
            batch_op.add_column(sa.Column("contact_phone", sa.String(), nullable=True))
        if "scheduled_time" not in columns:
            batch_op.add_column(sa.Column("scheduled_time", sa.DateTime(), nullable=True))
        if "assigned_staff_id" not in columns:
            batch_op.add_column(sa.Column("assigned_staff_id", sa.Integer(), nullable=True))
        if "staff_note" not in columns:
            batch_op.add_column(sa.Column("staff_note", sa.Text(), nullable=True))
        if "updated_at" not in columns:
            batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))

    op.execute(
        text(
            """
            UPDATE collection_requests
            SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
            WHERE updated_at IS NULL
            """
        )
    )


def _create_request_status_logs_table(inspector):
    if "request_status_logs" in inspector.get_table_names():
        return

    op.create_table(
        "request_status_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("request_type", sa.String(), nullable=True),
        sa.Column("request_id", sa.Integer(), nullable=True),
        sa.Column("old_status", sa.String(), nullable=True),
        sa.Column("new_status", sa.String(), nullable=True),
        sa.Column("changed_by", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def _create_data_retrieval_requests_table(inspector):
    if "data_retrieval_requests" in inspector.get_table_names():
        return

    op.create_table(
        "data_retrieval_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("consumer_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("quoted_price", sa.Integer(), nullable=True),
        sa.Column("final_price", sa.Integer(), nullable=True),
        sa.Column("assigned_staff_id", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["assigned_staff_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["consumer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def _ensure_data_retrieval_downloads_alignment(inspector):
    columns = _column_map(inspector, "data_retrieval_downloads")
    if not columns:
        op.create_table(
            "data_retrieval_downloads",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("retrieval_request_id", sa.Integer(), nullable=False),
            sa.Column("issued_by", sa.Integer(), nullable=True),
            sa.Column("token", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["issued_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["retrieval_request_id"], ["data_retrieval_requests.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token"),
        )
        return

    if "expires_at" not in columns:
        with op.batch_alter_table("data_retrieval_downloads", schema=None) as batch_op:
            batch_op.add_column(sa.Column("expires_at", sa.DateTime(), nullable=True))

    op.execute(
        text(
            """
            UPDATE data_retrieval_downloads
            SET expires_at = DATETIME(COALESCE(created_at, CURRENT_TIMESTAMP), '+24 hours')
            WHERE expires_at IS NULL
            """
        )
    )


def _create_reward_vouchers_table(inspector):
    if "reward_vouchers" in inspector.get_table_names():
        return

    op.create_table(
        "reward_vouchers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("consumer_id", sa.Integer(), nullable=True),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("request_id", sa.Integer(), nullable=True),
        sa.Column("partner", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("value_label", sa.String(), nullable=True),
        sa.Column("code", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["consumer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["request_id"], ["collection_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    _ensure_users_alignment(inspector)
    inspector = sa.inspect(bind)

    _ensure_collection_requests_alignment(inspector)
    inspector = sa.inspect(bind)

    _create_request_status_logs_table(inspector)
    inspector = sa.inspect(bind)

    _create_data_retrieval_requests_table(inspector)
    inspector = sa.inspect(bind)

    _ensure_data_retrieval_downloads_alignment(inspector)
    inspector = sa.inspect(bind)

    _create_reward_vouchers_table(inspector)


def downgrade():
    # This revision captures schema that has already existed in live SQLite
    # databases outside Alembic, so dropping it on downgrade would be unsafe.
    pass
