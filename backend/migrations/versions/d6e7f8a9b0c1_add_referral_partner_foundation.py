"""add referral partner foundation

Revision ID: d6e7f8a9b0c1
Revises: c4d5e6f7a8b9
Create Date: 2026-04-21 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "d6e7f8a9b0c1"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "third_party_partners",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("partner_type", sa.String(length=64), nullable=False, server_default="other"),
        sa.Column("website_url", sa.String(length=500), nullable=True),
        sa.Column("referral_landing_url", sa.String(length=500), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_third_party_partners_name"),
        "third_party_partners",
        ["name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_third_party_partners_partner_type"),
        "third_party_partners",
        ["partner_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_third_party_partners_active"),
        "third_party_partners",
        ["active"],
        unique=False,
    )

    op.create_table(
        "referral_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=255), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=True),
        sa.Column("consumer_id", sa.Integer(), nullable=True),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("request_id", sa.Integer(), nullable=True),
        sa.Column("classification_snapshot", sa.String(length=64), nullable=True),
        sa.Column("qr_payload", sa.Text(), nullable=True),
        sa.Column("qr_target_url", sa.Text(), nullable=True),
        sa.Column("voucher_label", sa.String(length=255), nullable=True),
        sa.Column("bonus_label", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="issued"),
        sa.Column("issued_at", sa.DateTime(), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["consumer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["partner_id"], ["third_party_partners.id"]),
        sa.ForeignKeyConstraint(["request_id"], ["collection_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_referral_codes_code"),
        "referral_codes",
        ["code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_codes_partner_id"),
        "referral_codes",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_codes_consumer_id"),
        "referral_codes",
        ["consumer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_codes_device_id"),
        "referral_codes",
        ["device_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_codes_request_id"),
        "referral_codes",
        ["request_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_codes_status"),
        "referral_codes",
        ["status"],
        unique=False,
    )

    op.create_table(
        "referral_activity",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=True),
        sa.Column("referral_code_id", sa.Integer(), nullable=True),
        sa.Column("consumer_id", sa.Integer(), nullable=True),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("request_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("event_reference", sa.String(length=255), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["consumer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["partner_id"], ["third_party_partners.id"]),
        sa.ForeignKeyConstraint(["referral_code_id"], ["referral_codes.id"]),
        sa.ForeignKeyConstraint(["request_id"], ["collection_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_referral_activity_partner_id"),
        "referral_activity",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_activity_referral_code_id"),
        "referral_activity",
        ["referral_code_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_activity_consumer_id"),
        "referral_activity",
        ["consumer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_activity_device_id"),
        "referral_activity",
        ["device_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_activity_request_id"),
        "referral_activity",
        ["request_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_activity_event_type"),
        "referral_activity",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_activity_occurred_at"),
        "referral_activity",
        ["occurred_at"],
        unique=False,
    )

    op.create_table(
        "referral_fees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("partner_id", sa.Integer(), nullable=True),
        sa.Column("referral_code_id", sa.Integer(), nullable=True),
        sa.Column("referral_activity_id", sa.Integer(), nullable=True),
        sa.Column("consumer_id", sa.Integer(), nullable=True),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("request_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="expected"),
        sa.Column("fee_amount", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="GBP"),
        sa.Column("fee_reference", sa.String(length=255), nullable=True),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["consumer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["partner_id"], ["third_party_partners.id"]),
        sa.ForeignKeyConstraint(["referral_activity_id"], ["referral_activity.id"]),
        sa.ForeignKeyConstraint(["referral_code_id"], ["referral_codes.id"]),
        sa.ForeignKeyConstraint(["request_id"], ["collection_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_referral_fees_partner_id"),
        "referral_fees",
        ["partner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_referral_code_id"),
        "referral_fees",
        ["referral_code_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_referral_activity_id"),
        "referral_fees",
        ["referral_activity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_consumer_id"),
        "referral_fees",
        ["consumer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_device_id"),
        "referral_fees",
        ["device_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_request_id"),
        "referral_fees",
        ["request_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_status"),
        "referral_fees",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_fee_reference"),
        "referral_fees",
        ["fee_reference"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_due_at"),
        "referral_fees",
        ["due_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_referral_fees_paid_at"),
        "referral_fees",
        ["paid_at"],
        unique=False,
    )

    op.execute(
        text(
            """
            INSERT INTO third_party_partners (
                name,
                partner_type,
                active,
                created_at,
                updated_at
            )
            SELECT
                voucher_partner.partner_name,
                CASE
                    WHEN LOWER(voucher_partner.partner_name) LIKE '%cex%' THEN 'resale'
                    WHEN LOWER(voucher_partner.partner_name) LIKE '%collector%' THEN 'marketplace'
                    ELSE 'other'
                END,
                1,
                COALESCE(voucher_partner.first_seen_at, CURRENT_TIMESTAMP),
                COALESCE(voucher_partner.last_seen_at, voucher_partner.first_seen_at, CURRENT_TIMESTAMP)
            FROM (
                SELECT
                    TRIM(partner) AS partner_name,
                    MIN(created_at) AS first_seen_at,
                    MAX(created_at) AS last_seen_at
                FROM reward_vouchers
                WHERE partner IS NOT NULL
                  AND TRIM(partner) != ''
                GROUP BY TRIM(partner)
            ) AS voucher_partner
            WHERE NOT EXISTS (
                SELECT 1
                FROM third_party_partners AS existing_partner
                WHERE LOWER(TRIM(existing_partner.name)) = LOWER(voucher_partner.partner_name)
            )
            """
        )
    )

    op.execute(
        text(
            """
            INSERT INTO referral_codes (
                code,
                partner_id,
                consumer_id,
                device_id,
                request_id,
                classification_snapshot,
                voucher_label,
                bonus_label,
                status,
                issued_at,
                created_at,
                updated_at
            )
            SELECT
                TRIM(rv.code),
                partner.id,
                rv.consumer_id,
                rv.device_id,
                rv.request_id,
                device.classification,
                rv.title,
                rv.value_label,
                CASE
                    WHEN LOWER(COALESCE(rv.status, '')) IN ('redeemed', 'expired', 'cancelled') THEN LOWER(rv.status)
                    WHEN LOWER(COALESCE(rv.status, '')) IN ('used', 'consumed') THEN 'redeemed'
                    ELSE 'issued'
                END,
                COALESCE(rv.created_at, CURRENT_TIMESTAMP),
                COALESCE(rv.created_at, CURRENT_TIMESTAMP),
                COALESCE(rv.created_at, CURRENT_TIMESTAMP)
            FROM reward_vouchers AS rv
            LEFT JOIN third_party_partners AS partner
                ON LOWER(TRIM(partner.name)) = LOWER(TRIM(rv.partner))
            LEFT JOIN devices AS device
                ON device.id = rv.device_id
            WHERE rv.code IS NOT NULL
              AND TRIM(rv.code) != ''
              AND NOT EXISTS (
                  SELECT 1
                  FROM referral_codes AS existing_code
                  WHERE LOWER(TRIM(existing_code.code)) = LOWER(TRIM(rv.code))
              )
            """
        )
    )


def downgrade():
    # Keep this revision non-destructive so existing development data is not
    # dropped if the migration history is rolled back.
    pass
