"""add payment transactions ledger

Revision ID: c4d5e6f7a8b9
Revises: b1c2d3e4f5a6
Create Date: 2026-04-21 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("retrieval_request_id", sa.Integer(), nullable=True),
        sa.Column("consumer_id", sa.Integer(), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="unknown"),
        sa.Column("payment_kind", sa.String(length=32), nullable=False, server_default="initial_retrieval"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="initiated"),
        sa.Column("amount", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="GBP"),
        sa.Column("provider_payment_id", sa.String(length=255), nullable=True),
        sa.Column("checkout_reference", sa.String(length=255), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("initiated_at", sa.DateTime(), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("failed_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("refunded_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["consumer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["retrieval_request_id"], ["data_retrieval_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_payment_transactions_retrieval_request_id"),
        "payment_transactions",
        ["retrieval_request_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_payment_transactions_consumer_id"),
        "payment_transactions",
        ["consumer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_payment_transactions_provider"),
        "payment_transactions",
        ["provider"],
        unique=False,
    )
    op.create_index(
        op.f("ix_payment_transactions_status"),
        "payment_transactions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_payment_transactions_provider_payment_id"),
        "payment_transactions",
        ["provider_payment_id"],
        unique=False,
    )

    op.execute(
        text(
            """
            INSERT INTO payment_transactions (
                retrieval_request_id,
                consumer_id,
                provider,
                payment_kind,
                status,
                amount,
                currency,
                provider_payment_id,
                checkout_reference,
                initiated_at,
                paid_at,
                failed_at,
                cancelled_at,
                refunded_at,
                created_at,
                updated_at
            )
            SELECT
                r.id,
                r.consumer_id,
                COALESCE(NULLIF(TRIM(r.payment_provider), ''), 'unknown'),
                'initial_retrieval',
                COALESCE(NULLIF(TRIM(r.payment_status), ''), 'initiated'),
                COALESCE(r.final_price, r.quoted_price),
                'GBP',
                r.payment_reference,
                r.payment_reference,
                COALESCE(r.requested_at, r.created_at, CURRENT_TIMESTAMP),
                r.paid_at,
                CASE
                    WHEN LOWER(COALESCE(r.payment_status, '')) = 'failed'
                    THEN COALESCE(r.updated_at, r.created_at, CURRENT_TIMESTAMP)
                    ELSE NULL
                END,
                CASE
                    WHEN LOWER(COALESCE(r.payment_status, '')) = 'cancelled'
                    THEN COALESCE(r.updated_at, r.created_at, CURRENT_TIMESTAMP)
                    ELSE NULL
                END,
                CASE
                    WHEN LOWER(COALESCE(r.payment_status, '')) = 'refunded'
                    THEN COALESCE(r.updated_at, r.created_at, CURRENT_TIMESTAMP)
                    ELSE NULL
                END,
                COALESCE(r.created_at, CURRENT_TIMESTAMP),
                COALESCE(r.updated_at, r.created_at, CURRENT_TIMESTAMP)
            FROM data_retrieval_requests AS r
            WHERE (
                r.payment_reference IS NOT NULL
                OR r.paid_at IS NOT NULL
                OR (r.payment_provider IS NOT NULL AND TRIM(r.payment_provider) != '')
                OR LOWER(COALESCE(r.payment_status, 'unpaid')) != 'unpaid'
            )
            """
        )
    )


def downgrade():
    # Keep this revision non-destructive to avoid dropping payment history from
    # existing development databases.
    pass
