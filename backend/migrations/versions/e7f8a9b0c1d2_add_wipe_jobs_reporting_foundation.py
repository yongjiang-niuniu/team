"""add wipe jobs reporting foundation

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-04-21 23:55:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "e7f8a9b0c1d2"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "wipe_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.Integer(), nullable=True),
        sa.Column("consumer_id", sa.Integer(), nullable=True),
        sa.Column("assigned_staff_id", sa.Integer(), nullable=True),
        sa.Column("wipe_type", sa.String(length=64), nullable=False, server_default="standard"),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="queued"),
        sa.Column("requested_at", sa.DateTime(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("failed_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("verification_status", sa.String(length=64), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["assigned_staff_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["consumer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["request_id"], ["collection_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_wipe_jobs_device_id"), "wipe_jobs", ["device_id"], unique=False)
    op.create_index(op.f("ix_wipe_jobs_request_id"), "wipe_jobs", ["request_id"], unique=False)
    op.create_index(op.f("ix_wipe_jobs_consumer_id"), "wipe_jobs", ["consumer_id"], unique=False)
    op.create_index(op.f("ix_wipe_jobs_assigned_staff_id"), "wipe_jobs", ["assigned_staff_id"], unique=False)
    op.create_index(op.f("ix_wipe_jobs_wipe_type"), "wipe_jobs", ["wipe_type"], unique=False)
    op.create_index(op.f("ix_wipe_jobs_status"), "wipe_jobs", ["status"], unique=False)
    op.create_index(op.f("ix_wipe_jobs_requested_at"), "wipe_jobs", ["requested_at"], unique=False)
    op.create_index(op.f("ix_wipe_jobs_completed_at"), "wipe_jobs", ["completed_at"], unique=False)
    op.create_index(
        op.f("ix_wipe_jobs_verification_status"),
        "wipe_jobs",
        ["verification_status"],
        unique=False,
    )

    op.create_table(
        "wipe_certificates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("wipe_job_id", sa.Integer(), nullable=False),
        sa.Column("certificate_reference", sa.String(length=255), nullable=True),
        sa.Column("certificate_url", sa.String(length=500), nullable=True),
        sa.Column("storage_key", sa.String(length=500), nullable=True),
        sa.Column("issued_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["wipe_job_id"], ["wipe_jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_wipe_certificates_wipe_job_id"), "wipe_certificates", ["wipe_job_id"], unique=False)
    op.create_index(
        op.f("ix_wipe_certificates_certificate_reference"),
        "wipe_certificates",
        ["certificate_reference"],
        unique=False,
    )
    op.create_index(op.f("ix_wipe_certificates_issued_at"), "wipe_certificates", ["issued_at"], unique=False)

    op.execute(text("CREATE INDEX IF NOT EXISTS ix_devices_workflow_status ON devices (workflow_status)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_devices_classification ON devices (classification)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_devices_created_at ON devices (created_at)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_collection_requests_status ON collection_requests (status)"))
    op.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_collection_requests_assigned_staff_id ON collection_requests (assigned_staff_id)"
        )
    )
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_collection_requests_updated_at ON collection_requests (updated_at)"))
    op.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_request_status_logs_request_lookup "
            "ON request_status_logs (request_type, request_id, created_at)"
        )
    )
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_payment_transactions_paid_at ON payment_transactions (paid_at)"))
    op.execute(
        text("CREATE INDEX IF NOT EXISTS ix_payment_transactions_created_at ON payment_transactions (created_at)")
    )


def downgrade():
    # Keep this revision non-destructive so wipe history, certificates, and
    # reporting indexes are preserved on existing development databases.
    pass
