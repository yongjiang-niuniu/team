from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

from project_database import resolve_database_url


def _resolve_database_url() -> str:
    return resolve_database_url()


DATABASE_URL = _resolve_database_url()
engine = None
SessionLocal = None


def configure_database(database_url: str | None = None):
    global DATABASE_URL, engine, SessionLocal

    DATABASE_URL = database_url or _resolve_database_url()

    if engine is not None:
        engine.dispose()

    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    return engine

Base = declarative_base()


configure_database(DATABASE_URL)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    auth_provider = Column(String, nullable=False, default="local")
    google_sub = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    full_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    device_type = Column(String)
    condition = Column(String)
    age_years = Column(Integer)
    demand = Column(String)
    classification = Column(String)
    workflow_status = Column(String)
    is_visible = Column(Boolean, nullable=False, default=True)
    is_draft = Column(Boolean, nullable=False, default=False)
    owner_contacted = Column(Boolean, nullable=False, default=False)
    owner_contacted_at = Column(DateTime, nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class CollectionRequest(Base):
    __tablename__ = "collection_requests"

    id = Column(Integer, primary_key=True)
    consumer_id = Column(Integer, ForeignKey("users.id"))
    device_id = Column(Integer, ForeignKey("devices.id"))
    item_name = Column(String)
    category = Column(String)
    condition = Column(String)
    preferred_method = Column(String)
    pickup_address = Column(Text)
    contact_phone = Column(String)
    scheduled_time = Column(DateTime)
    status = Column(String)
    assigned_staff_id = Column(Integer, ForeignKey("users.id"))
    staff_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class RequestStatusLog(Base):
    __tablename__ = "request_status_logs"

    id = Column(Integer, primary_key=True)
    request_type = Column(String)
    request_id = Column(Integer)
    old_status = Column(String)
    new_status = Column(String)
    changed_by = Column(Integer, ForeignKey("users.id"))
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class DataRetrievalRequest(Base):
    __tablename__ = "data_retrieval_requests"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    consumer_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String)
    retrieval_status = Column(String, default="pending")
    quoted_price = Column(Integer)
    final_price = Column(Integer)
    payment_provider = Column(String, nullable=True)
    payment_status = Column(String, nullable=False, default="unpaid")
    paid_at = Column(DateTime, nullable=True)
    payment_reference = Column(String, nullable=True)
    storage_expires_at = Column(DateTime, nullable=True)
    extended_until = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("users.id"))
    note = Column(Text)
    requested_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class DataRetrievalDownload(Base):
    __tablename__ = "data_retrieval_downloads"

    id = Column(Integer, primary_key=True)
    retrieval_request_id = Column(Integer, ForeignKey("data_retrieval_requests.id"), nullable=False)
    issued_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    token = Column(String, unique=True, nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    consumed_at = Column(DateTime, nullable=True)


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True)
    retrieval_request_id = Column(Integer, ForeignKey("data_retrieval_requests.id"), nullable=True, index=True)
    consumer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    provider = Column(String, nullable=False, default="unknown", index=True)
    payment_kind = Column(String, nullable=False, default="initial_retrieval")
    status = Column(String, nullable=False, default="initiated", index=True)
    amount = Column(Integer, nullable=True)
    currency = Column(String, nullable=False, default="GBP")
    provider_payment_id = Column(String, nullable=True, index=True)
    checkout_reference = Column(String, nullable=True)
    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    initiated_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    refunded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class RewardVoucher(Base):
    __tablename__ = "reward_vouchers"

    id = Column(Integer, primary_key=True)
    consumer_id = Column(Integer, ForeignKey("users.id"))
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    request_id = Column(Integer, ForeignKey("collection_requests.id"), nullable=True)
    partner = Column(String)
    title = Column(String)
    value_label = Column(String)
    code = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)


class ThirdPartyPartner(Base):
    __tablename__ = "third_party_partners"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, index=True)
    partner_type = Column(String, nullable=False, default="other", index=True)
    website_url = Column(String, nullable=True)
    referral_landing_url = Column(String, nullable=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ReferralCode(Base):
    __tablename__ = "referral_codes"

    id = Column(Integer, primary_key=True)
    code = Column(String, nullable=False, index=True)
    partner_id = Column(Integer, ForeignKey("third_party_partners.id"), nullable=True, index=True)
    consumer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True, index=True)
    request_id = Column(Integer, ForeignKey("collection_requests.id"), nullable=True, index=True)
    classification_snapshot = Column(String, nullable=True)
    qr_payload = Column(Text, nullable=True)
    qr_target_url = Column(Text, nullable=True)
    voucher_label = Column(String, nullable=True)
    bonus_label = Column(String, nullable=True)
    status = Column(String, nullable=False, default="issued", index=True)
    issued_at = Column(DateTime, default=datetime.utcnow)
    redeemed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ReferralActivity(Base):
    __tablename__ = "referral_activity"

    id = Column(Integer, primary_key=True)
    partner_id = Column(Integer, ForeignKey("third_party_partners.id"), nullable=True, index=True)
    referral_code_id = Column(Integer, ForeignKey("referral_codes.id"), nullable=True, index=True)
    consumer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True, index=True)
    request_id = Column(Integer, ForeignKey("collection_requests.id"), nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    event_reference = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReferralFee(Base):
    __tablename__ = "referral_fees"

    id = Column(Integer, primary_key=True)
    partner_id = Column(Integer, ForeignKey("third_party_partners.id"), nullable=True, index=True)
    referral_code_id = Column(Integer, ForeignKey("referral_codes.id"), nullable=True, index=True)
    referral_activity_id = Column(Integer, ForeignKey("referral_activity.id"), nullable=True, index=True)
    consumer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True, index=True)
    request_id = Column(Integer, ForeignKey("collection_requests.id"), nullable=True, index=True)
    status = Column(String, nullable=False, default="expected", index=True)
    fee_amount = Column(Integer, nullable=True)
    currency = Column(String, nullable=False, default="GBP")
    fee_reference = Column(String, nullable=True, index=True)
    due_at = Column(DateTime, nullable=True, index=True)
    confirmed_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class WipeJob(Base):
    __tablename__ = "wipe_jobs"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    request_id = Column(Integer, ForeignKey("collection_requests.id"), nullable=True, index=True)
    consumer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    wipe_type = Column(String, nullable=False, default="standard", index=True)
    status = Column(String, nullable=False, default="queued", index=True)
    requested_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True, index=True)
    failed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    verification_status = Column(String, nullable=False, default="pending", index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class WipeCertificate(Base):
    __tablename__ = "wipe_certificates"

    id = Column(Integer, primary_key=True)
    wipe_job_id = Column(Integer, ForeignKey("wipe_jobs.id"), nullable=False, index=True)
    certificate_reference = Column(String, nullable=True, index=True)
    certificate_url = Column(String, nullable=True)
    storage_key = Column(String, nullable=True)
    issued_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String, nullable=False, default="system", index=True)
    severity = Column(String, nullable=False, default="info", index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    target_path = Column(String, nullable=True)
    read_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


BRIDGE_BOOTSTRAP_TABLES = (
    "users",
    "devices",
    "collection_requests",
    "request_status_logs",
    "data_retrieval_requests",
    "data_retrieval_downloads",
    "payment_transactions",
    "reward_vouchers",
    "third_party_partners",
    "referral_codes",
    "referral_activity",
    "referral_fees",
    "wipe_jobs",
    "wipe_certificates",
    "notifications",
)


def _runtime_bootstrap_tables():
    # Local launcher-based development should be able to open every staff/admin
    # page against an existing SQLite file without a separate Alembic step.
    return [
        Base.metadata.tables[name]
        for name in BRIDGE_BOOTSTRAP_TABLES
        if name in Base.metadata.tables
    ]


def _ensure_collection_request_runtime_columns(inspector) -> None:
    if "collection_requests" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("collection_requests")}
    statements = []
    if "item_name" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN item_name VARCHAR")
    if "category" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN category VARCHAR")
    if "condition" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN condition VARCHAR")
    if "device_id" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN device_id INTEGER")
    if "pickup_address" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN pickup_address TEXT")
    if "contact_phone" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN contact_phone VARCHAR")
    if "scheduled_time" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN scheduled_time DATETIME")
    if "assigned_staff_id" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN assigned_staff_id INTEGER")
    if "staff_note" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN staff_note TEXT")
    if "updated_at" not in columns:
        statements.append("ALTER TABLE collection_requests ADD COLUMN updated_at DATETIME")

    if not statements:
        return

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        conn.execute(
            text(
                """
                UPDATE collection_requests
                SET item_name = COALESCE(NULLIF(TRIM(item_name), ''), (
                        SELECT NULLIF(TRIM(devices.name), '')
                        FROM devices
                        WHERE devices.id = collection_requests.device_id
                    )),
                    category = COALESCE(NULLIF(TRIM(category), ''), (
                        SELECT NULLIF(TRIM(devices.device_type), '')
                        FROM devices
                        WHERE devices.id = collection_requests.device_id
                    )),
                    condition = COALESCE(NULLIF(TRIM(condition), ''), (
                        SELECT NULLIF(TRIM(devices.condition), '')
                        FROM devices
                        WHERE devices.id = collection_requests.device_id
                    )),
                    updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
                WHERE updated_at IS NULL
                   OR item_name IS NULL
                   OR TRIM(item_name) = ''
                   OR category IS NULL
                   OR TRIM(category) = ''
                   OR condition IS NULL
                   OR TRIM(condition) = ''
                """
            )
        )


def _ensure_device_runtime_columns(inspector) -> None:
    if "devices" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("devices")}
    statements = []
    if "is_visible" not in columns:
        statements.append("ALTER TABLE devices ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT 1")
    if "is_draft" not in columns:
        statements.append("ALTER TABLE devices ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT 0")
    if "owner_contacted" not in columns:
        statements.append("ALTER TABLE devices ADD COLUMN owner_contacted BOOLEAN NOT NULL DEFAULT 0")
    if "owner_contacted_at" not in columns:
        statements.append("ALTER TABLE devices ADD COLUMN owner_contacted_at DATETIME")
    if "notes" not in columns:
        statements.append("ALTER TABLE devices ADD COLUMN notes TEXT")

    if not statements:
        return

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        conn.execute(
            text(
                """
                UPDATE devices
                SET is_visible = COALESCE(is_visible, 1),
                    is_draft = COALESCE(is_draft, 0),
                    owner_contacted = COALESCE(owner_contacted, 0)
                WHERE is_visible IS NULL
                   OR is_draft IS NULL
                   OR owner_contacted IS NULL
                """
            )
        )


def _ensure_download_expiry_column(inspector) -> None:
    if "data_retrieval_downloads" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("data_retrieval_downloads")}
    if "expires_at" in columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE data_retrieval_downloads ADD COLUMN expires_at DATETIME"))
        conn.execute(
            text(
                """
                UPDATE data_retrieval_downloads
                SET expires_at = DATETIME(COALESCE(created_at, CURRENT_TIMESTAMP), '+24 hours')
                WHERE expires_at IS NULL
                """
            )
        )


def _ensure_retrieval_request_runtime_columns(inspector) -> None:
    if "data_retrieval_requests" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("data_retrieval_requests")}
    statements = []
    if "retrieval_status" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN retrieval_status VARCHAR DEFAULT 'pending'")
    if "payment_provider" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN payment_provider VARCHAR")
    if "payment_status" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN payment_status VARCHAR NOT NULL DEFAULT 'unpaid'")
    if "paid_at" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN paid_at DATETIME")
    if "payment_reference" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN payment_reference VARCHAR")
    if "storage_expires_at" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN storage_expires_at DATETIME")
    if "extended_until" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN extended_until DATETIME")
    if "deleted_at" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN deleted_at DATETIME")
    if "requested_at" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN requested_at DATETIME")
    if "updated_at" not in columns:
        statements.append("ALTER TABLE data_retrieval_requests ADD COLUMN updated_at DATETIME")

    if not statements:
        return

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        conn.execute(
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


def _ensure_download_runtime_columns(inspector) -> None:
    if "data_retrieval_downloads" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("data_retrieval_downloads")}
    statements = []
    if "issued_at" not in columns:
        statements.append("ALTER TABLE data_retrieval_downloads ADD COLUMN issued_at DATETIME")
    if "revoked_at" not in columns:
        statements.append("ALTER TABLE data_retrieval_downloads ADD COLUMN revoked_at DATETIME")
    if "consumed_at" not in columns:
        statements.append("ALTER TABLE data_retrieval_downloads ADD COLUMN consumed_at DATETIME")

    if not statements:
        return

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        conn.execute(
            text(
                """
                UPDATE data_retrieval_downloads
                SET issued_at = COALESCE(issued_at, created_at, CURRENT_TIMESTAMP)
                WHERE issued_at IS NULL
                """
            )
        )


def _backfill_payment_transactions(inspector) -> None:
    if "payment_transactions" not in inspector.get_table_names():
        return
    if "data_retrieval_requests" not in inspector.get_table_names():
        return

    with engine.begin() as conn:
        conn.execute(
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
                AND NOT EXISTS (
                    SELECT 1
                    FROM payment_transactions AS pt
                    WHERE pt.retrieval_request_id = r.id
                      AND COALESCE(pt.payment_kind, '') = 'initial_retrieval'
                      AND COALESCE(pt.provider_payment_id, '') = COALESCE(r.payment_reference, '')
                      AND COALESCE(pt.status, '') = COALESCE(r.payment_status, '')
                      AND COALESCE(pt.amount, -1) = COALESCE(r.final_price, r.quoted_price, -1)
                )
                """
            )
        )


def init_db():
    Base.metadata.create_all(engine, tables=_runtime_bootstrap_tables())
    inspector = inspect(engine)
    _ensure_device_runtime_columns(inspector)
    inspector = inspect(engine)
    _ensure_collection_request_runtime_columns(inspector)
    inspector = inspect(engine)
    _ensure_retrieval_request_runtime_columns(inspector)
    inspector = inspect(engine)
    _ensure_download_expiry_column(inspector)
    inspector = inspect(engine)
    _ensure_download_runtime_columns(inspector)
    inspector = inspect(engine)
    _backfill_payment_transactions(inspector)


def get_session():
    return SessionLocal()
