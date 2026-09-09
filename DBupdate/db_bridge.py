import json
from datetime import datetime, timedelta
from secrets import token_urlsafe
from typing import Any

from DBupdate.db_new_test import (
    get_session,
    User,
    Device,
    CollectionRequest,
    RequestStatusLog,
    DataRetrievalRequest,
    DataRetrievalDownload,
    PaymentTransaction,
    RewardVoucher,
    ThirdPartyPartner,
    ReferralCode,
    ReferralActivity,
    ReferralFee,
    Notification,
    WipeJob,
    WipeCertificate,
)

_UNSET = object()
DOWNLOAD_LINK_EXPIRY_HOURS = 24
RETRIEVAL_STORAGE_DAYS = 90
RETRIEVAL_EXTENSION_DAYS = 90
RETRIEVAL_MAX_STORAGE_DAYS = RETRIEVAL_STORAGE_DAYS + RETRIEVAL_EXTENSION_DAYS
INITIAL_RETRIEVAL_PAYMENT_KIND = "initial_retrieval"
EXTENSION_PAYMENT_KIND = "extension"
SUPPORTED_PAYMENT_KINDS = {
    INITIAL_RETRIEVAL_PAYMENT_KIND,
    EXTENSION_PAYMENT_KIND,
}
SUPPORTED_PAYMENT_PROVIDERS = {"stripe", "paypal", "unknown"}
RETRIEVAL_READY_STATUSES = {"completed", "ready", "active", "extended"}
OPEN_PAYMENT_STATUSES = {"initiated", "pending"}
TERMINAL_PAYMENT_STATUSES = {"paid", "failed", "cancelled", "refunded"}
REFERRAL_EVENT_TYPES = {
    "issued",
    "opened",
    "redeemed",
    "handin_confirmed",
    "resale_confirmed",
    "fee_recorded",
}
REFERRAL_SINGLETON_EVENT_TYPES = {
    "issued",
    "redeemed",
    "handin_confirmed",
    "resale_confirmed",
    "fee_recorded",
}
REFERRAL_FEE_STATUSES = {"expected", "pending", "confirmed", "paid", "cancelled"}
CURRENT_DEVICE_PARTNER_NAME = "CeX UK"
RARE_DEVICE_PARTNER_NAME = "Collector Network"


# ---------- common ----------
def _close(session):
    try:
        session.close()
    except Exception:
        pass


def _dt(v):
    if v in (None, "", "null"):
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        s = v.strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None
    return None


def _utcnow():
    return datetime.utcnow()


def _normalize_text(value):
    return (value or "").strip()


def _parse_report_datetime(value):
    if value in (None, "", "null"):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        parsed = _dt(normalized)
        if parsed is not None:
            return parsed
        try:
            return datetime.fromisoformat(f"{normalized}T00:00:00")
        except Exception as exc:
            raise ValueError("invalid datetime filter") from exc
    raise ValueError("invalid datetime filter")


def _report_time_filtered_query(query, model, *, from_at=None, to_at=None, field_name="created_at"):
    column = getattr(model, field_name)
    parsed_from = _parse_report_datetime(from_at)
    parsed_to = _parse_report_datetime(to_at)
    if parsed_from is not None:
        query = query.filter(column >= parsed_from)
    if parsed_to is not None:
        query = query.filter(column <= parsed_to)
    return query


def _serialize_device(device: Device):
    return {
        "id": device.id,
        "owner_id": device.owner_id,
        "name": device.name,
        "device_type": device.device_type,
        "condition": device.condition,
        "age_years": device.age_years,
        "demand": device.demand,
        "classification": device.classification,
        "workflow_status": device.workflow_status,
        "processing_status": device.workflow_status,
        "is_visible": device.is_visible,
        "is_draft": device.is_draft,
        "owner_contacted": device.owner_contacted,
        "owner_contacted_at": device.owner_contacted_at.isoformat() if device.owner_contacted_at else None,
        "notes": device.notes,
        "created_at": device.created_at.isoformat() if device.created_at else None,
    }


def _serialize_collection_request_summary(collection_request: CollectionRequest):
    payload = {
        "id": collection_request.id,
        "consumer_id": collection_request.consumer_id,
        "device_id": collection_request.device_id,
        "preferred_method": collection_request.preferred_method,
        "status": collection_request.status,
        "pickup_address": collection_request.pickup_address,
        "contact_phone": collection_request.contact_phone,
        "scheduled_time": collection_request.scheduled_time.isoformat() if collection_request.scheduled_time else None,
        "assigned_staff_id": collection_request.assigned_staff_id,
        "staff_note": collection_request.staff_note,
        "created_at": collection_request.created_at.isoformat() if collection_request.created_at else None,
        "updated_at": collection_request.updated_at.isoformat() if collection_request.updated_at else None,
    }
    if hasattr(collection_request, "item_name"):
        payload["item_name"] = getattr(collection_request, "item_name", None)
    if hasattr(collection_request, "category"):
        payload["category"] = getattr(collection_request, "category", None)
    if hasattr(collection_request, "condition"):
        payload["condition"] = getattr(collection_request, "condition", None)
    return payload


def _normalize_payment_provider(provider: str | None) -> str:
    normalized = _normalize_text(provider).lower()
    if normalized in SUPPORTED_PAYMENT_PROVIDERS:
        return normalized
    if not normalized:
        return "unknown"
    raise ValueError("unsupported payment provider")


def _normalize_payment_kind(payment_kind: str | None) -> str:
    normalized = _normalize_text(payment_kind).lower()
    if not normalized:
        return INITIAL_RETRIEVAL_PAYMENT_KIND
    if normalized in SUPPORTED_PAYMENT_KINDS:
        return normalized
    raise ValueError("unsupported payment kind")


def _normalize_payment_status(status: str | None, *, allow_unpaid: bool = True) -> str:
    normalized = _normalize_text(status).lower()
    aliases = {
        "": "unpaid" if allow_unpaid else "pending",
        "processing": "pending",
        "succeeded": "paid",
        "success": "paid",
        "canceled": "cancelled",
    }
    normalized = aliases.get(normalized, normalized)
    allowed = {"initiated", "pending", "paid", "failed", "cancelled", "refunded"}
    if allow_unpaid:
        allowed = allowed | {"unpaid"}
    if normalized in allowed:
        return normalized
    raise ValueError("unsupported payment status")


def _add_days(value: datetime | None, days: int) -> datetime | None:
    if value is None:
        return None
    return value + timedelta(days=days)


def _effective_access_until(retrieval: DataRetrievalRequest) -> datetime | None:
    if retrieval.extended_until and retrieval.storage_expires_at:
        return max(retrieval.extended_until, retrieval.storage_expires_at)
    return retrieval.extended_until or retrieval.storage_expires_at


def _hard_delete_due_at(retrieval: DataRetrievalRequest) -> datetime | None:
    if retrieval.paid_at:
        return _add_days(retrieval.paid_at, RETRIEVAL_MAX_STORAGE_DAYS)
    if retrieval.requested_at:
        return _add_days(retrieval.requested_at, RETRIEVAL_MAX_STORAGE_DAYS)
    return _add_days(retrieval.created_at, RETRIEVAL_MAX_STORAGE_DAYS)


def _is_retrieval_ready_for_delivery(retrieval: DataRetrievalRequest) -> bool:
    retrieval_status = _normalize_text(retrieval.retrieval_status).lower()
    status = _normalize_text(retrieval.status).lower()
    return retrieval_status in RETRIEVAL_READY_STATUSES or status == "completed"


def _sync_retrieval_record(retrieval: DataRetrievalRequest, now: datetime | None = None) -> bool:
    if retrieval is None:
        return False

    now = now or _utcnow()
    changed = False

    normalized_payment_status = _normalize_payment_status(retrieval.payment_status, allow_unpaid=True)
    if retrieval.payment_status != normalized_payment_status:
        retrieval.payment_status = normalized_payment_status
        changed = True

    if retrieval.requested_at is None:
        retrieval.requested_at = retrieval.created_at or now
        changed = True

    if retrieval.deleted_at and retrieval.deleted_at <= now:
        if retrieval.status != "deleted":
            retrieval.status = "deleted"
            changed = True
        if retrieval.retrieval_status != "deleted":
            retrieval.retrieval_status = "deleted"
            changed = True
        if changed:
            retrieval.updated_at = now
        return changed

    hard_delete_due_at = _hard_delete_due_at(retrieval)
    if hard_delete_due_at and now >= hard_delete_due_at:
        if retrieval.deleted_at is None:
            retrieval.deleted_at = now
            changed = True
        if retrieval.status != "deleted":
            retrieval.status = "deleted"
            changed = True
        if retrieval.retrieval_status != "deleted":
            retrieval.retrieval_status = "deleted"
            changed = True
        if changed:
            retrieval.updated_at = now
        return changed

    access_until = _effective_access_until(retrieval)
    if normalized_payment_status == "paid" and access_until and now >= access_until:
        if retrieval.status != "locked":
            retrieval.status = "locked"
            changed = True
        if retrieval.retrieval_status not in {"expired", "deleted"}:
            retrieval.retrieval_status = "expired"
            changed = True
    elif normalized_payment_status == "paid" and _is_retrieval_ready_for_delivery(retrieval):
        if retrieval.status != "active":
            retrieval.status = "active"
            changed = True
    elif normalized_payment_status in {"failed", "cancelled"}:
        if retrieval.status != "locked":
            retrieval.status = "locked"
            changed = True
        desired_status = f"payment_{normalized_payment_status}"
        if retrieval.retrieval_status != desired_status:
            retrieval.retrieval_status = desired_status
            changed = True
    elif normalized_payment_status in OPEN_PAYMENT_STATUSES:
        if retrieval.status != "pending":
            retrieval.status = "pending"
            changed = True
        if retrieval.retrieval_status in (None, "", "pending"):
            if retrieval.retrieval_status != "payment_pending":
                retrieval.retrieval_status = "payment_pending"
                changed = True
    else:
        if retrieval.status not in {"pending", "locked"}:
            retrieval.status = "pending"
            changed = True
        if retrieval.retrieval_status in (None, ""):
            retrieval.retrieval_status = "pending"
            changed = True

    if retrieval.updated_at is None or changed:
        retrieval.updated_at = now

    return changed


def _serialize_device_summary(device: Device | None):
    if not device:
        return None

    return {
        "id": device.id,
        "owner_id": device.owner_id,
        "name": device.name,
        "device_type": device.device_type,
        "condition": device.condition,
        "classification": device.classification,
        "workflow_status": device.workflow_status,
        "processing_status": device.workflow_status,
        "created_at": device.created_at.isoformat() if device.created_at else None,
    }


def _serialize_payment_transaction(transaction: PaymentTransaction):
    return {
        "id": transaction.id,
        "retrieval_request_id": transaction.retrieval_request_id,
        "consumer_id": transaction.consumer_id,
        "provider": transaction.provider,
        "payment_kind": transaction.payment_kind,
        "status": transaction.status,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "provider_payment_id": transaction.provider_payment_id,
        "checkout_reference": transaction.checkout_reference,
        "error_code": transaction.error_code,
        "error_message": transaction.error_message,
        "initiated_at": transaction.initiated_at.isoformat() if transaction.initiated_at else None,
        "paid_at": transaction.paid_at.isoformat() if transaction.paid_at else None,
        "failed_at": transaction.failed_at.isoformat() if transaction.failed_at else None,
        "cancelled_at": transaction.cancelled_at.isoformat() if transaction.cancelled_at else None,
        "refunded_at": transaction.refunded_at.isoformat() if transaction.refunded_at else None,
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
        "updated_at": transaction.updated_at.isoformat() if transaction.updated_at else None,
    }


def _serialize_user_summary(user: User | None):
    if not user:
        return None
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "full_name": getattr(user, "full_name", None),
    }


def _serialize_collection_request_summary(collection_request: CollectionRequest | None):
    if not collection_request:
        return None
    return {
        "id": collection_request.id,
        "consumer_id": collection_request.consumer_id,
        "device_id": collection_request.device_id,
        "preferred_method": collection_request.preferred_method,
        "status": collection_request.status,
        "pickup_address": collection_request.pickup_address,
        "contact_phone": collection_request.contact_phone,
        "scheduled_time": collection_request.scheduled_time.isoformat() if collection_request.scheduled_time else None,
        "assigned_staff_id": collection_request.assigned_staff_id,
        "staff_note": collection_request.staff_note,
        "created_at": collection_request.created_at.isoformat() if collection_request.created_at else None,
        "updated_at": collection_request.updated_at.isoformat() if collection_request.updated_at else None,
    }


def _serialize_retrieval_request_summary(session, retrieval: DataRetrievalRequest | None):
    if not retrieval:
        return None
    device = session.get(Device, retrieval.device_id) if retrieval.device_id else None
    return {
        "id": retrieval.id,
        "device_id": retrieval.device_id,
        "consumer_id": retrieval.consumer_id,
        "status": retrieval.status,
        "retrieval_status": retrieval.retrieval_status or retrieval.status,
        "payment_status": retrieval.payment_status,
        "quoted_price": retrieval.quoted_price,
        "final_price": retrieval.final_price,
        "created_at": retrieval.created_at.isoformat() if retrieval.created_at else None,
        "updated_at": retrieval.updated_at.isoformat() if retrieval.updated_at else None,
        "device": _serialize_device_summary(device),
    }


def _serialize_retrieval_request(session, retrieval: DataRetrievalRequest):
    device = session.get(Device, retrieval.device_id) if retrieval.device_id else None
    payment_transactions = (
        session.query(PaymentTransaction)
        .filter(PaymentTransaction.retrieval_request_id == retrieval.id)
        .order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc())
        .all()
    )
    access_until = _effective_access_until(retrieval)
    hard_delete_due_at = _hard_delete_due_at(retrieval)
    now = _utcnow()

    return {
        "id": retrieval.id,
        "device_id": retrieval.device_id,
        "consumer_id": retrieval.consumer_id,
        "status": retrieval.status,
        "retrieval_status": retrieval.retrieval_status or retrieval.status,
        "quoted_price": retrieval.quoted_price,
        "final_price": retrieval.final_price,
        "payment_provider": retrieval.payment_provider,
        "payment_status": retrieval.payment_status,
        "paid_at": retrieval.paid_at.isoformat() if retrieval.paid_at else None,
        "payment_reference": retrieval.payment_reference,
        "storage_expires_at": retrieval.storage_expires_at.isoformat() if retrieval.storage_expires_at else None,
        "extended_until": retrieval.extended_until.isoformat() if retrieval.extended_until else None,
        "access_until": access_until.isoformat() if access_until else None,
        "deletion_due_at": hard_delete_due_at.isoformat() if hard_delete_due_at else None,
        "deleted_at": retrieval.deleted_at.isoformat() if retrieval.deleted_at else None,
        "is_extendable": bool(
            retrieval.payment_status == "paid"
            and retrieval.deleted_at is None
            and hard_delete_due_at is not None
            and now < hard_delete_due_at
        ),
        "download_ready": bool(
            retrieval.payment_status == "paid"
            and retrieval.deleted_at is None
            and access_until is not None
            and now < access_until
            and _is_retrieval_ready_for_delivery(retrieval)
        ),
        "assigned_staff_id": retrieval.assigned_staff_id,
        "note": retrieval.note,
        "requested_at": retrieval.requested_at.isoformat() if retrieval.requested_at else None,
        "created_at": retrieval.created_at.isoformat() if retrieval.created_at else None,
        "updated_at": retrieval.updated_at.isoformat() if retrieval.updated_at else None,
        "device": _serialize_device_summary(device),
        "payment_transactions": [_serialize_payment_transaction(transaction) for transaction in payment_transactions],
        "latest_payment_transaction": (
            _serialize_payment_transaction(payment_transactions[0]) if payment_transactions else None
        ),
    }


def _serialize_download(session, download: DataRetrievalDownload):
    retrieval = session.get(DataRetrievalRequest, download.retrieval_request_id)
    if retrieval:
        _sync_retrieval_record(retrieval)

    return {
        "id": download.id,
        "retrieval_request_id": download.retrieval_request_id,
        "issued_by": download.issued_by,
        "token": download.token,
        "issued_at": download.issued_at.isoformat() if download.issued_at else None,
        "created_at": download.created_at.isoformat() if download.created_at else None,
        "expires_at": download.expires_at.isoformat() if download.expires_at else None,
        "revoked_at": download.revoked_at.isoformat() if download.revoked_at else None,
        "consumed_at": download.consumed_at.isoformat() if download.consumed_at else None,
        "retrieval_request": _serialize_retrieval_request(session, retrieval) if retrieval else None,
    }


def _revoke_active_downloads(session, retrieval_request_id: int, revoked_at: datetime | None = None):
    revoked_at = revoked_at or _utcnow()
    active_downloads = (
        session.query(DataRetrievalDownload)
        .filter(DataRetrievalDownload.retrieval_request_id == retrieval_request_id)
        .filter(DataRetrievalDownload.revoked_at.is_(None))
        .filter(DataRetrievalDownload.consumed_at.is_(None))
        .all()
    )
    for download in active_downloads:
        download.revoked_at = revoked_at


def _download_expiry_for(retrieval: DataRetrievalRequest, now: datetime) -> datetime | None:
    expires_at = now + timedelta(hours=DOWNLOAD_LINK_EXPIRY_HOURS)
    access_until = _effective_access_until(retrieval)
    if access_until is not None:
        expires_at = min(expires_at, access_until)
    if expires_at <= now:
        return None
    return expires_at


def _retrieval_can_issue_download(retrieval: DataRetrievalRequest, now: datetime | None = None) -> bool:
    now = now or _utcnow()
    access_until = _effective_access_until(retrieval)
    return bool(
        retrieval.payment_status == "paid"
        and retrieval.deleted_at is None
        and access_until is not None
        and now < access_until
        and _is_retrieval_ready_for_delivery(retrieval)
    )


def _find_payment_transaction(
    session,
    retrieval_request_id: int,
    *,
    transaction_id: int | None = None,
    payment_kind: str | None = None,
    provider: str | None = None,
    checkout_reference: str | None = None,
    provider_payment_id: str | None = None,
):
    if transaction_id is not None:
        transaction = session.get(PaymentTransaction, transaction_id)
        if transaction and transaction.retrieval_request_id == retrieval_request_id:
            return transaction
        return None

    query = session.query(PaymentTransaction).filter(
        PaymentTransaction.retrieval_request_id == retrieval_request_id
    )
    if payment_kind:
        query = query.filter(PaymentTransaction.payment_kind == payment_kind)
    if provider:
        query = query.filter(PaymentTransaction.provider == provider)
    if checkout_reference:
        query = query.filter(PaymentTransaction.checkout_reference == checkout_reference)
    if provider_payment_id:
        query = query.filter(PaymentTransaction.provider_payment_id == provider_payment_id)

    return query.order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc()).first()


# ---------- user ----------
def get_user_by_id(user_id: int):
    session = get_session()
    try:
        return session.get(User, user_id)
    finally:
        _close(session)


def get_user_by_email(email: str):
    session = get_session()
    try:
        return session.query(User).filter(User.email == email).first()
    finally:
        _close(session)


def create_user(
    email: str,
    password_hash: str,
    role: str = "consumer",
    full_name: str | None = None,
    auth_provider: str = "local",
):
    session = get_session()
    try:
        user = User(
            email=email,
            auth_provider=auth_provider,
            full_name=full_name,
            password_hash=password_hash,
            role=role,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    finally:
        _close(session)


# ---------- notifications ----------
def _serialize_notification(notification: Notification):
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "kind": notification.kind,
        "severity": notification.severity,
        "title": notification.title,
        "body": notification.body,
        "target_path": notification.target_path,
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


def _add_notification(
    session,
    *,
    user_id: int | None,
    kind: str,
    severity: str,
    title: str,
    body: str | None = None,
    target_path: str | None = None,
):
    if user_id is None:
        return None

    notification = Notification(
        user_id=int(user_id),
        kind=_normalize_text(kind) or "system",
        severity=_normalize_text(severity) or "info",
        title=_normalize_text(title) or "Update",
        body=_normalize_text(body) or None,
        target_path=_normalize_text(target_path) or None,
        created_at=_utcnow(),
    )
    session.add(notification)
    return notification


def create_notification(
    *,
    user_id: int,
    kind: str = "system",
    severity: str = "info",
    title: str,
    body: str | None = None,
    target_path: str | None = None,
):
    session = get_session()
    try:
        notification = _add_notification(
            session,
            user_id=user_id,
            kind=kind,
            severity=severity,
            title=title,
            body=body,
            target_path=target_path,
        )
        session.commit()
        session.refresh(notification)
        return _serialize_notification(notification)
    finally:
        _close(session)


def list_user_notifications(user_id: int, *, limit: int = 20):
    session = get_session()
    try:
        items = (
            session.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(limit)
            .all()
        )
        unread_count = (
            session.query(Notification)
            .filter(Notification.user_id == user_id)
            .filter(Notification.read_at.is_(None))
            .count()
        )
        return {
            "notifications": [_serialize_notification(item) for item in items],
            "unread_count": unread_count,
        }
    finally:
        _close(session)


def mark_notification_read(user_id: int, notification_id: int):
    session = get_session()
    try:
        notification = (
            session.query(Notification)
            .filter(Notification.id == notification_id)
            .filter(Notification.user_id == user_id)
            .first()
        )
        if notification is None:
            return None
        if notification.read_at is None:
            notification.read_at = _utcnow()
            session.commit()
            session.refresh(notification)
        return _serialize_notification(notification)
    finally:
        _close(session)


def mark_all_notifications_read(user_id: int):
    session = get_session()
    try:
        unread = (
            session.query(Notification)
            .filter(Notification.user_id == user_id)
            .filter(Notification.read_at.is_(None))
            .all()
        )
        now = _utcnow()
        for notification in unread:
            notification.read_at = now
        session.commit()
        return {"updated": len(unread)}
    finally:
        _close(session)


# ---------- device ----------
def create_device(
    owner_id: int,
    name: str,
    device_type: str,
    condition: str,
    age_years: int | None = None,
    demand: str | None = None,
    classification: str = "unknown",
    workflow_status: str = "pending",
    is_visible: bool = True,
    is_draft: bool = False,
    owner_contacted: bool = False,
    owner_contacted_at=None,
    notes: str | None = None,
    brand: str | None = None,
    model: str | None = None,
):
    session = get_session()
    try:
        device = Device(
            owner_id=owner_id,
            name=name,
            device_type=device_type,
            condition=condition,
            age_years=age_years,
            demand=demand,
            classification=classification,
            workflow_status=workflow_status,
            is_visible=is_visible,
            is_draft=is_draft,
            owner_contacted=owner_contacted,
            owner_contacted_at=_dt(owner_contacted_at),
            notes=notes,
        )
        session.add(device)
        session.commit()
        session.refresh(device)
        return {
            "id": device.id,
            "owner_id": device.owner_id,
            "name": device.name,
            "device_type": device.device_type,
            "condition": device.condition,
            "age_years": device.age_years,
            "demand": device.demand,
            "classification": device.classification,
            "workflow_status": device.workflow_status,
            "processing_status": device.workflow_status,
            "is_visible": device.is_visible,
            "is_draft": device.is_draft,
            "owner_contacted": device.owner_contacted,
            "owner_contacted_at": device.owner_contacted_at.isoformat() if device.owner_contacted_at else None,
            "notes": device.notes,
        }
    finally:
        _close(session)


def get_device(device_id: int):
    session = get_session()
    try:
        d = session.get(Device, device_id)
        if not d:
            return None
        return _serialize_device(d)
    finally:
        _close(session)


def list_user_devices(owner_id: int):
    session = get_session()
    try:
        items = session.query(Device).filter(Device.owner_id == owner_id).order_by(Device.created_at.desc()).all()
        return [_serialize_device(d) for d in items]
    finally:
        _close(session)


def list_all_devices(workflow_status=None, classification=None, device_type=None):
    session = get_session()
    try:
        q = session.query(Device)
        if workflow_status:
            q = q.filter(Device.workflow_status == workflow_status)
        if classification:
            q = q.filter(Device.classification == classification)
        if device_type:
            q = q.filter(Device.device_type == device_type)

        items = q.order_by(Device.created_at.desc()).all()
        return [_serialize_device(d) for d in items]
    finally:
        _close(session)


def list_user_submitted_devices(consumer_id: int):
    session = get_session()
    try:
        items = (
            session.query(CollectionRequest, Device)
            .join(Device, Device.id == CollectionRequest.device_id)
            .filter(CollectionRequest.consumer_id == consumer_id)
            .order_by(CollectionRequest.created_at.desc(), CollectionRequest.id.desc())
            .all()
        )
        return [
            {
                **_serialize_device(device),
                "request": _serialize_collection_request_summary(collection_request),
            }
            for collection_request, device in items
        ]
    finally:
        _close(session)


def update_device_status(device_id: int, workflow_status: str):
    session = get_session()
    try:
        d = session.get(Device, device_id)
        if not d:
            return None
        d.workflow_status = workflow_status
        session.commit()
        session.refresh(d)
        return get_device(device_id)
    finally:
        _close(session)


def update_device_classification(device_id: int, classification: str):
    session = get_session()
    try:
        d = session.get(Device, device_id)
        if not d:
            return None
        d.classification = classification
        session.commit()
        session.refresh(d)
        return get_device(device_id)
    finally:
        _close(session)


def update_device_visibility(device_id: int, is_visible: bool):
    session = get_session()
    try:
        d = session.get(Device, device_id)
        if not d:
            return None
        d.is_visible = is_visible
        session.commit()
        session.refresh(d)
        return get_device(device_id)
    finally:
        _close(session)


def update_device_draft(device_id: int, is_draft: bool):
    session = get_session()
    try:
        d = session.get(Device, device_id)
        if not d:
            return None
        d.is_draft = is_draft
        session.commit()
        session.refresh(d)
        return get_device(device_id)
    finally:
        _close(session)


def update_device_owner_contact(device_id: int, owner_contacted: bool, contact_notes: str | None | object = _UNSET):
    session = get_session()
    try:
        d = session.get(Device, device_id)
        if not d:
            return None
        d.owner_contacted = owner_contacted
        d.owner_contacted_at = datetime.utcnow() if owner_contacted else None
        if contact_notes is not _UNSET:
            d.notes = contact_notes
        session.commit()
        session.refresh(d)
        return get_device(device_id)
    finally:
        _close(session)


def patch_device(device_id: int, patch: dict[str, Any]):
    session = get_session()
    try:
        d = session.get(Device, device_id)
        if not d:
            return None

        for k, v in patch.items():
            if hasattr(d, k):
                setattr(d, k, v)

        session.commit()
        session.refresh(d)
        return get_device(device_id)
    finally:
        _close(session)


def delete_device(device_id: int):
    session = get_session()
    try:
        d = session.get(Device, device_id)
        if not d:
            return False
        session.delete(d)
        session.commit()
        return True
    finally:
        _close(session)


# ---------- collection request ----------
def create_collection_request(
    consumer_id: int,
    device_id: int,
    item_name: str,
    category: str,
    condition: str,
    preferred_method: str,
    pickup_address: str | None = None,
    contact_phone: str | None = None,
    scheduled_time=None,
    status: str = "submitted",
    assigned_staff_id: int | None = None,
    staff_note: str | None = None,
):
    session = get_session()
    try:
        cr = CollectionRequest(
            consumer_id=consumer_id,
            device_id=device_id,
            item_name=item_name,
            category=category,
            condition=condition,
            preferred_method=preferred_method,
            pickup_address=pickup_address,
            contact_phone=contact_phone,
            scheduled_time=_dt(scheduled_time),
            status=status,
            assigned_staff_id=assigned_staff_id,
            staff_note=staff_note,
            updated_at=datetime.utcnow(),
        )
        session.add(cr)
        session.commit()
        session.refresh(cr)
        return {
            "id": cr.id,
            "consumer_id": cr.consumer_id,
            "device_id": cr.device_id,
            "preferred_method": cr.preferred_method,
            "status": cr.status,
            "pickup_address": cr.pickup_address,
            "contact_phone": cr.contact_phone,
            "scheduled_time": cr.scheduled_time.isoformat() if cr.scheduled_time else None,
            "assigned_staff_id": cr.assigned_staff_id,
            "staff_note": cr.staff_note,
            "created_at": cr.created_at.isoformat() if cr.created_at else None,
            "updated_at": cr.updated_at.isoformat() if cr.updated_at else None,
        }
    finally:
        _close(session)


def get_collection_request(req_id: int):
    session = get_session()
    try:
        cr = session.get(CollectionRequest, req_id)
        if not cr:
            return None
        device = session.get(Device, cr.device_id) if cr.device_id else None
        consumer = session.get(User, cr.consumer_id) if cr.consumer_id else None
        payload = _serialize_collection_request_summary(cr)
        payload["device"] = _serialize_device(device) if device else None
        payload["consumer"] = _serialize_user_summary(consumer)
        return payload
    finally:
        _close(session)


def list_user_collection_requests(consumer_id: int):
    session = get_session()
    try:
        items = session.query(CollectionRequest).filter(CollectionRequest.consumer_id == consumer_id).order_by(CollectionRequest.created_at.desc()).all()
        return [get_collection_request(x.id) for x in items]
    finally:
        _close(session)


def list_all_collection_requests(status=None):
    session = get_session()
    try:
        q = session.query(CollectionRequest)
        if status:
            q = q.filter(CollectionRequest.status == status)
        items = q.order_by(CollectionRequest.created_at.desc()).all()
        return [get_collection_request(x.id) for x in items]
    finally:
        _close(session)


def update_collection_request_status(req_id: int, new_status: str, changed_by=None, note=None):
    session = get_session()
    try:
        cr = session.get(CollectionRequest, req_id)
        if not cr:
            return None

        old_status = cr.status
        cr.status = new_status
        cr.updated_at = datetime.utcnow()

        session.add(
            RequestStatusLog(
                request_type="collection_request",
                request_id=req_id,
                old_status=old_status,
                new_status=new_status,
                changed_by=changed_by,
                note=note,
            )
        )

        session.commit()
        session.refresh(cr)
        return get_collection_request(req_id)
    finally:
        _close(session)


# ---------- data retrieval ----------
def create_data_retrieval_request(
    device_id: int,
    consumer_id: int,
    status: str = "pending",
    quoted_price: int | None = 10,
    final_price: int | None = 10,
    assigned_staff_id: int | None = None,
    note: str | None = None,
    retrieval_status: str | None = None,
    payment_provider: str | None = None,
    payment_status: str = "unpaid",
    paid_at=None,
    payment_reference: str | None = None,
    storage_expires_at=None,
    extended_until=None,
    deleted_at=None,
):
    session = get_session()
    try:
        now = _utcnow()
        retrieval = DataRetrievalRequest(
            device_id=device_id,
            consumer_id=consumer_id,
            status=status,
            retrieval_status=retrieval_status or "pending",
            quoted_price=quoted_price,
            final_price=final_price,
            payment_provider=_normalize_payment_provider(payment_provider),
            payment_status=_normalize_payment_status(payment_status, allow_unpaid=True),
            paid_at=_dt(paid_at),
            payment_reference=payment_reference,
            storage_expires_at=_dt(storage_expires_at),
            extended_until=_dt(extended_until),
            deleted_at=_dt(deleted_at),
            assigned_staff_id=assigned_staff_id,
            note=note,
            requested_at=now,
            updated_at=now,
        )
        _sync_retrieval_record(retrieval, now)
        session.add(retrieval)
        session.commit()
        session.refresh(retrieval)

        if (
            retrieval.payment_reference is not None
            or retrieval.paid_at is not None
            or retrieval.payment_provider not in (None, "", "unknown")
            or retrieval.payment_status not in {"", "unpaid"}
        ):
            transaction = PaymentTransaction(
                retrieval_request_id=retrieval.id,
                consumer_id=retrieval.consumer_id,
                provider=_normalize_payment_provider(retrieval.payment_provider),
                payment_kind=INITIAL_RETRIEVAL_PAYMENT_KIND,
                status=_normalize_payment_status(retrieval.payment_status, allow_unpaid=False)
                if retrieval.payment_status not in {"", "unpaid"}
                else "initiated",
                amount=retrieval.final_price or retrieval.quoted_price,
                currency="GBP",
                provider_payment_id=retrieval.payment_reference,
                checkout_reference=retrieval.payment_reference,
                initiated_at=retrieval.requested_at or now,
                paid_at=retrieval.paid_at,
                failed_at=now if retrieval.payment_status == "failed" else None,
                cancelled_at=now if retrieval.payment_status == "cancelled" else None,
                refunded_at=now if retrieval.payment_status == "refunded" else None,
                created_at=now,
                updated_at=now,
            )
            session.add(transaction)
            session.commit()

        return _serialize_retrieval_request(session, retrieval)
    finally:
        _close(session)


def get_data_retrieval_request(retrieval_id: int):
    session = get_session()
    try:
        retrieval = session.get(DataRetrievalRequest, retrieval_id)
        if not retrieval:
            return None

        if _sync_retrieval_record(retrieval):
            session.commit()
            session.refresh(retrieval)

        return _serialize_retrieval_request(session, retrieval)
    finally:
        _close(session)


def list_user_data_retrieval_requests(consumer_id: int):
    session = get_session()
    try:
        items = (
            session.query(DataRetrievalRequest)
            .filter(DataRetrievalRequest.consumer_id == consumer_id)
            .order_by(DataRetrievalRequest.created_at.desc())
            .all()
        )
        changed = False
        for item in items:
            changed = _sync_retrieval_record(item) or changed
        if changed:
            session.commit()
            for item in items:
                session.refresh(item)
        return [_serialize_retrieval_request(session, item) for item in items]
    finally:
        _close(session)


def get_latest_data_retrieval_download_for_request(retrieval_request_id: int):
    session = get_session()
    try:
        download = (
            session.query(DataRetrievalDownload)
            .filter(DataRetrievalDownload.retrieval_request_id == retrieval_request_id)
            .order_by(DataRetrievalDownload.created_at.desc(), DataRetrievalDownload.id.desc())
            .first()
        )
        if not download:
            return None
        return _serialize_download(session, download)
    finally:
        _close(session)


def get_or_create_data_retrieval_download(retrieval_request_id: int, issued_by: int | None = None):
    session = get_session()
    try:
        now = _utcnow()
        retrieval = session.get(DataRetrievalRequest, retrieval_request_id)
        if not retrieval:
            return None
        if _sync_retrieval_record(retrieval, now):
            session.commit()
            session.refresh(retrieval)
        if not _retrieval_can_issue_download(retrieval, now):
            return None

        latest = (
            session.query(DataRetrievalDownload)
            .filter(DataRetrievalDownload.retrieval_request_id == retrieval_request_id)
            .filter(DataRetrievalDownload.revoked_at.is_(None))
            .filter(DataRetrievalDownload.consumed_at.is_(None))
            .order_by(DataRetrievalDownload.created_at.desc(), DataRetrievalDownload.id.desc())
            .first()
        )
        if latest and (latest.expires_at is None or latest.expires_at > now):
            return _serialize_download(session, latest)

        expires_at = _download_expiry_for(retrieval, now)
        if expires_at is None:
            return None

        download = DataRetrievalDownload(
            retrieval_request_id=retrieval_request_id,
            issued_by=issued_by,
            token=token_urlsafe(32),
            issued_at=now,
            expires_at=expires_at,
        )
        session.add(download)
        session.commit()
        session.refresh(download)
        return _serialize_download(session, download)
    finally:
        _close(session)


def issue_data_retrieval_download(retrieval_request_id: int, issued_by: int | None = None):
    session = get_session()
    try:
        now = _utcnow()
        retrieval = session.get(DataRetrievalRequest, retrieval_request_id)
        if not retrieval:
            return None
        if _sync_retrieval_record(retrieval, now):
            session.commit()
            session.refresh(retrieval)
        if not _retrieval_can_issue_download(retrieval, now):
            return None

        _revoke_active_downloads(session, retrieval_request_id, revoked_at=now)
        expires_at = _download_expiry_for(retrieval, now)
        if expires_at is None:
            session.commit()
            return None

        download = DataRetrievalDownload(
            retrieval_request_id=retrieval_request_id,
            issued_by=issued_by,
            token=token_urlsafe(32),
            issued_at=now,
            expires_at=expires_at,
        )
        session.add(download)
        session.commit()
        session.refresh(download)
        return _serialize_download(session, download)
    finally:
        _close(session)


def get_data_retrieval_download(download_id: int):
    session = get_session()
    try:
        download = session.get(DataRetrievalDownload, download_id)
        if not download:
            return None

        retrieval = session.get(DataRetrievalRequest, download.retrieval_request_id)
        if retrieval and _sync_retrieval_record(retrieval):
            session.commit()
            session.refresh(retrieval)

        return _serialize_download(session, download)
    finally:
        _close(session)


def get_data_retrieval_download_by_token(token: str):
    session = get_session()
    try:
        download = (
            session.query(DataRetrievalDownload)
            .filter(DataRetrievalDownload.token == token)
            .first()
        )
        if not download:
            return None
        retrieval = session.get(DataRetrievalRequest, download.retrieval_request_id)
        if retrieval and _sync_retrieval_record(retrieval):
            session.commit()
            session.refresh(retrieval)
        return _serialize_download(session, download)
    finally:
        _close(session)


def access_data_retrieval_download(token: str, consumer_id: int):
    session = get_session()
    try:
        now = _utcnow()
        download = (
            session.query(DataRetrievalDownload)
            .filter(DataRetrievalDownload.token == token)
            .first()
        )
        if not download:
            return {"error": "not_found"}

        retrieval = session.get(DataRetrievalRequest, download.retrieval_request_id)
        if not retrieval:
            return {"error": "not_found"}

        if _sync_retrieval_record(retrieval, now):
            session.commit()
            session.refresh(retrieval)

        if retrieval.consumer_id != consumer_id:
            return {"error": "forbidden"}
        if download.revoked_at is not None:
            return {"error": "revoked"}
        if download.consumed_at is not None:
            return {"error": "consumed"}
        if download.expires_at and now >= download.expires_at:
            return {"error": "expired"}
        if retrieval.deleted_at is not None:
            return {"error": "deleted"}
        if not _retrieval_can_issue_download(retrieval, now):
            return {"error": "unavailable"}

        download.consumed_at = now
        session.commit()
        session.refresh(download)
        return {
            "download": _serialize_download(session, download),
        }
    finally:
        _close(session)


def list_payment_transactions_for_request(retrieval_request_id: int):
    session = get_session()
    try:
        items = (
            session.query(PaymentTransaction)
            .filter(PaymentTransaction.retrieval_request_id == retrieval_request_id)
            .order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc())
            .all()
        )
        return [_serialize_payment_transaction(item) for item in items]
    finally:
        _close(session)


def _serialize_payment_report_transaction(session, transaction: PaymentTransaction):
    payload = _serialize_payment_transaction(transaction)
    retrieval_request = session.get(DataRetrievalRequest, transaction.retrieval_request_id) if transaction.retrieval_request_id else None
    consumer = session.get(User, transaction.consumer_id) if transaction.consumer_id else None
    device = session.get(Device, retrieval_request.device_id) if retrieval_request and retrieval_request.device_id else None
    payload["retrieval_request"] = _serialize_retrieval_request(session, retrieval_request) if retrieval_request else None
    payload["consumer"] = (
        {
            "id": consumer.id,
            "email": consumer.email,
            "role": consumer.role,
            "created_at": consumer.created_at.isoformat() if consumer.created_at else None,
        }
        if consumer
        else None
    )
    payload["device"] = _serialize_device_summary(device)
    return payload


def list_payment_report_transactions(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    provider: str | None = None,
    payment_kind: str | None = None,
):
    session = get_session()
    try:
        query = session.query(PaymentTransaction)
        query = _report_time_filtered_query(query, PaymentTransaction, from_at=from_at, to_at=to_at)
        normalized_status = _normalize_text(status).lower()
        normalized_provider = _normalize_text(provider).lower()
        normalized_payment_kind = _normalize_text(payment_kind).lower()
        if normalized_status:
            query = query.filter(PaymentTransaction.status == normalized_status)
        if normalized_provider:
            query = query.filter(PaymentTransaction.provider == normalized_provider)
        if normalized_payment_kind:
            query = query.filter(PaymentTransaction.payment_kind == normalized_payment_kind)
        items = query.order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc()).all()
        return [_serialize_payment_report_transaction(session, item) for item in items]
    finally:
        _close(session)


def get_payment_report_summary(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    provider: str | None = None,
    payment_kind: str | None = None,
):
    transactions = list_payment_report_transactions(
        from_at=from_at,
        to_at=to_at,
        status=status,
        provider=provider,
        payment_kind=payment_kind,
    )

    counts_by_status = {}
    counts_by_provider = {}
    counts_by_payment_kind = {}
    total_amount = 0
    paid_amount = 0
    pending_amount = 0
    initiated_amount = 0
    latest_created_at = None

    for item in transactions:
        current_status = item.get("status")
        current_provider = item.get("provider")
        current_payment_kind = item.get("payment_kind")
        amount = item.get("amount") or 0
        created_at = item.get("created_at")

        if current_status:
            counts_by_status[current_status] = counts_by_status.get(current_status, 0) + 1
        if current_provider:
            counts_by_provider[current_provider] = counts_by_provider.get(current_provider, 0) + 1
        if current_payment_kind:
            counts_by_payment_kind[current_payment_kind] = counts_by_payment_kind.get(current_payment_kind, 0) + 1

        total_amount += amount
        if current_status == "paid":
            paid_amount += amount
        elif current_status == "pending":
            pending_amount += amount
        elif current_status == "initiated":
            initiated_amount += amount

        if created_at and (latest_created_at is None or created_at > latest_created_at):
            latest_created_at = created_at

    return {
        "total_transactions": len(transactions),
        "total_amount": total_amount,
        "counts_by_status": counts_by_status,
        "counts_by_provider": counts_by_provider,
        "counts_by_payment_kind": counts_by_payment_kind,
        "paid_amount": paid_amount,
        "pending_amount": pending_amount,
        "initiated_amount": initiated_amount,
        "latest_created_at": latest_created_at,
    }


def initiate_retrieval_payment(
    retrieval_request_id: int,
    *,
    provider: str,
    payment_kind: str | None = None,
    amount: int | None = None,
    currency: str = "GBP",
):
    session = get_session()
    try:
        now = _utcnow()
        retrieval = session.get(DataRetrievalRequest, retrieval_request_id)
        if not retrieval:
            return None

        provider = _normalize_payment_provider(provider)
        payment_kind = _normalize_payment_kind(payment_kind)
        if _sync_retrieval_record(retrieval, now):
            session.commit()
            session.refresh(retrieval)

        if retrieval.deleted_at is not None:
            raise ValueError("retrieval request has been deleted")

        if payment_kind == INITIAL_RETRIEVAL_PAYMENT_KIND and retrieval.payment_status == "paid":
            raise ValueError("retrieval request is already paid")

        if payment_kind == EXTENSION_PAYMENT_KIND:
            if retrieval.paid_at is None or retrieval.payment_status != "paid":
                raise ValueError("initial payment must be completed before requesting an extension")
            if retrieval.deleted_at is not None:
                raise ValueError("retrieval request has been deleted")
            hard_delete_due_at = _hard_delete_due_at(retrieval)
            if hard_delete_due_at and now >= hard_delete_due_at:
                raise ValueError("retrieval request is no longer eligible for extension")

        resolved_amount = amount
        if resolved_amount is None:
            resolved_amount = retrieval.final_price or retrieval.quoted_price or 10

        existing = (
            session.query(PaymentTransaction)
            .filter(PaymentTransaction.retrieval_request_id == retrieval_request_id)
            .filter(PaymentTransaction.payment_kind == payment_kind)
            .filter(PaymentTransaction.provider == provider)
            .filter(PaymentTransaction.status.in_(tuple(OPEN_PAYMENT_STATUSES)))
            .order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc())
            .first()
        )
        if existing:
            if existing.amount is None:
                existing.amount = resolved_amount
            existing.updated_at = now
            session.commit()
            session.refresh(existing)
            session.refresh(retrieval)
            return {
                "retrieval_request": _serialize_retrieval_request(session, retrieval),
                "payment_transaction": _serialize_payment_transaction(existing),
            }

        transaction = PaymentTransaction(
            retrieval_request_id=retrieval.id,
            consumer_id=retrieval.consumer_id,
            provider=provider,
            payment_kind=payment_kind,
            status="initiated",
            amount=resolved_amount,
            currency=(currency or "GBP").strip().upper() or "GBP",
            checkout_reference=token_urlsafe(24),
            initiated_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(transaction)

        if payment_kind == INITIAL_RETRIEVAL_PAYMENT_KIND:
            retrieval.payment_provider = provider
            retrieval.payment_status = "pending"
            retrieval.retrieval_status = "payment_pending"
            retrieval.status = "pending"
            retrieval.updated_at = now

        session.commit()
        session.refresh(transaction)
        session.refresh(retrieval)

        return {
            "retrieval_request": _serialize_retrieval_request(session, retrieval),
            "payment_transaction": _serialize_payment_transaction(transaction),
        }
    finally:
        _close(session)


def update_retrieval_payment_transaction(
    retrieval_request_id: int,
    *,
    provider: str | None = None,
    payment_kind: str | None = None,
    status: str,
    transaction_id: int | None = None,
    checkout_reference: str | None = None,
    provider_payment_id: str | None = None,
    amount: int | None = None,
    currency: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    occurred_at=None,
):
    session = get_session()
    try:
        now = _dt(occurred_at) or _utcnow()
        retrieval = session.get(DataRetrievalRequest, retrieval_request_id)
        if not retrieval:
            return None

        payment_kind = _normalize_payment_kind(payment_kind)
        normalized_status = _normalize_payment_status(status, allow_unpaid=False)
        normalized_provider = _normalize_payment_provider(provider or retrieval.payment_provider or "unknown")

        transaction = _find_payment_transaction(
            session,
            retrieval_request_id,
            transaction_id=transaction_id,
            payment_kind=payment_kind,
            provider=normalized_provider,
            checkout_reference=checkout_reference,
            provider_payment_id=provider_payment_id,
        )
        if transaction is None:
            transaction = PaymentTransaction(
                retrieval_request_id=retrieval_request_id,
                consumer_id=retrieval.consumer_id,
                provider=normalized_provider,
                payment_kind=payment_kind,
                status="initiated",
                amount=amount if amount is not None else (retrieval.final_price or retrieval.quoted_price),
                currency=(currency or "GBP").strip().upper() or "GBP",
                checkout_reference=checkout_reference,
                initiated_at=now,
                created_at=now,
                updated_at=now,
            )
            session.add(transaction)
            session.flush()

        transaction.provider = normalized_provider
        if amount is not None:
            transaction.amount = amount
        if currency:
            transaction.currency = currency.strip().upper() or transaction.currency
        if checkout_reference:
            transaction.checkout_reference = checkout_reference
        if provider_payment_id:
            transaction.provider_payment_id = provider_payment_id
        if error_code is not None:
            transaction.error_code = error_code
        if error_message is not None:
            transaction.error_message = error_message
        transaction.status = normalized_status
        transaction.updated_at = now

        if transaction.initiated_at is None:
            transaction.initiated_at = now

        if normalized_status == "pending":
            if payment_kind == INITIAL_RETRIEVAL_PAYMENT_KIND:
                retrieval.payment_provider = normalized_provider
                retrieval.payment_status = "pending"
                retrieval.retrieval_status = "payment_pending"
                retrieval.status = "pending"
        elif normalized_status == "paid":
            transaction.paid_at = transaction.paid_at or now
            retrieval.payment_provider = normalized_provider
            retrieval.payment_reference = (
                provider_payment_id
                or checkout_reference
                or transaction.provider_payment_id
                or transaction.checkout_reference
            )
            if payment_kind == INITIAL_RETRIEVAL_PAYMENT_KIND:
                retrieval.payment_status = "paid"
                retrieval.paid_at = retrieval.paid_at or transaction.paid_at or now
                if retrieval.final_price is None:
                    retrieval.final_price = transaction.amount or retrieval.quoted_price
                if retrieval.storage_expires_at is None:
                    retrieval.storage_expires_at = _add_days(retrieval.paid_at, RETRIEVAL_STORAGE_DAYS)
                if retrieval.retrieval_status in {"pending", "payment_pending", "payment_failed", "payment_cancelled", "expired"}:
                    retrieval.retrieval_status = "paid"
                retrieval.status = "active" if _is_retrieval_ready_for_delivery(retrieval) else "pending"
            else:
                if retrieval.paid_at is None:
                    raise ValueError("initial payment must be completed before recording an extension payment")
                hard_delete_due_at = _hard_delete_due_at(retrieval)
                if hard_delete_due_at and now >= hard_delete_due_at:
                    raise ValueError("retrieval request is no longer eligible for extension")
                extension_until = _add_days(retrieval.paid_at, RETRIEVAL_MAX_STORAGE_DAYS)
                if retrieval.extended_until is None or retrieval.extended_until < extension_until:
                    retrieval.extended_until = extension_until
                retrieval.status = "active"
                retrieval.retrieval_status = "extended"
        elif normalized_status == "failed":
            transaction.failed_at = transaction.failed_at or now
            if payment_kind == INITIAL_RETRIEVAL_PAYMENT_KIND and retrieval.payment_status != "paid":
                retrieval.payment_provider = normalized_provider
                retrieval.payment_status = "failed"
                retrieval.retrieval_status = "payment_failed"
                retrieval.status = "locked"
        elif normalized_status == "cancelled":
            transaction.cancelled_at = transaction.cancelled_at or now
            if payment_kind == INITIAL_RETRIEVAL_PAYMENT_KIND and retrieval.payment_status != "paid":
                retrieval.payment_provider = normalized_provider
                retrieval.payment_status = "cancelled"
                retrieval.retrieval_status = "payment_cancelled"
                retrieval.status = "locked"
        elif normalized_status == "refunded":
            transaction.refunded_at = transaction.refunded_at or now

        _sync_retrieval_record(retrieval, now)
        retrieval.updated_at = now

        session.commit()
        session.refresh(transaction)
        session.refresh(retrieval)

        return {
            "retrieval_request": _serialize_retrieval_request(session, retrieval),
            "payment_transaction": _serialize_payment_transaction(transaction),
        }
    finally:
        _close(session)


def update_data_retrieval_request_state(
    retrieval_request_id: int,
    *,
    status: str | None = None,
    retrieval_status: str | None = None,
    assigned_staff_id: int | None | object = _UNSET,
    note: str | None | object = _UNSET,
):
    session = get_session()
    try:
        now = _utcnow()
        retrieval = session.get(DataRetrievalRequest, retrieval_request_id)
        if not retrieval:
            return None

        if status is not None:
            retrieval.status = _normalize_text(status).lower() or retrieval.status
        if retrieval_status is not None:
            retrieval.retrieval_status = _normalize_text(retrieval_status).lower() or retrieval.retrieval_status
        if assigned_staff_id is not _UNSET:
            retrieval.assigned_staff_id = assigned_staff_id
        if note is not _UNSET:
            retrieval.note = note

        normalized_retrieval_status = _normalize_text(retrieval.retrieval_status).lower()
        if normalized_retrieval_status in {"completed", "ready"} and retrieval.payment_status == "paid":
            retrieval.status = "active"
        elif normalized_retrieval_status in {"processing", "paid", "payment_pending", "pending"}:
            retrieval.status = "pending"
        elif normalized_retrieval_status == "expired":
            retrieval.status = "locked"
        elif normalized_retrieval_status == "deleted":
            retrieval.deleted_at = retrieval.deleted_at or now
            retrieval.status = "deleted"

        _sync_retrieval_record(retrieval, now)
        retrieval.updated_at = now
        session.commit()
        session.refresh(retrieval)

        return _serialize_retrieval_request(session, retrieval)
    finally:
        _close(session)


def run_retrieval_lifecycle_maintenance(now=None):
    session = get_session()
    try:
        current_time = _dt(now) or _utcnow()
        items = session.query(DataRetrievalRequest).all()
        updated_count = 0
        for retrieval in items:
            if _sync_retrieval_record(retrieval, current_time):
                updated_count += 1
        if updated_count:
            session.commit()
        return {
            "processed": len(items),
            "updated": updated_count,
            "checked_at": current_time.isoformat(),
        }
    finally:
        _close(session)


def _referral_defaults_for_classification(classification: str | None):
    normalized = _normalize_text(classification).lower()
    if normalized == "current":
        return {
            "partner_name": CURRENT_DEVICE_PARTNER_NAME,
            "partner_type": "resale",
            "website_url": "https://uk.webuy.com/",
            "referral_landing_url": "https://uk.webuy.com/",
            "voucher_label": "Trade-in Bonus",
            "demo_estimated_value": "GBP 120-220",
            "demo_value_source": "CeX UK demo estimate range",
            "demo_hand_in_locations": [
                "CeX Sheffield High Street",
                "CeX Meadowhall",
                "CeX Leeds Headrow",
            ],
            "demo_wiping_guarantee": "Partner hand-in includes a demo secure data-wiping guarantee before resale.",
            "partner_detail_url": "https://uk.webuy.com/search?stext=used%20phone",
            "bonus_label": "£185.00",
        }
    if normalized == "rare":
        return {
            "partner_name": RARE_DEVICE_PARTNER_NAME,
            "partner_type": "marketplace",
            "website_url": "https://www.ebay.co.uk/",
            "referral_landing_url": "https://www.ebay.co.uk/",
            "voucher_label": "Rare Device Referral",
            "demo_estimated_value": "GBP 80-300 collector guidance",
            "demo_value_source": "eBay UK and Collector Network demo guidance",
            "demo_hand_in_locations": [
                "eBay UK marketplace listing",
                "Collector Network remote appraisal",
                "eWaste Hub staff-assisted hand-in",
            ],
            "demo_wiping_guarantee": "Rare-device referrals include a demo marketplace wipe and ownership handover note.",
            "partner_detail_url": "https://www.ebay.co.uk/sch/i.html?_nkw=retro%20electronics",
            "bonus_label": "£250.00",
        }
    return None


def _supported_partner_classifications(partner: ThirdPartyPartner):
    partner_type = _normalize_text(partner.partner_type).lower()
    if partner_type == "resale":
        return ["current"]
    if partner_type == "marketplace":
        return ["rare"]
    return ["current", "rare"]


def _serialize_partner(partner: ThirdPartyPartner):
    supported_classifications = _supported_partner_classifications(partner)
    metadata_classification = "rare" if "rare" in supported_classifications and "current" not in supported_classifications else "current"
    demo_metadata = _referral_defaults_for_classification(metadata_classification) or {}
    return {
        "id": partner.id,
        "name": partner.name,
        "partner_type": partner.partner_type,
        "website_url": partner.website_url,
        "referral_landing_url": partner.referral_landing_url,
        "active": partner.active,
        "supported_classifications": supported_classifications,
        "demo_estimated_value": demo_metadata.get("demo_estimated_value"),
        "demo_value_source": demo_metadata.get("demo_value_source"),
        "demo_hand_in_locations": demo_metadata.get("demo_hand_in_locations", []),
        "demo_wiping_guarantee": demo_metadata.get("demo_wiping_guarantee"),
        "partner_detail_url": demo_metadata.get("partner_detail_url") or partner.referral_landing_url or partner.website_url,
        "created_at": partner.created_at.isoformat() if partner.created_at else None,
        "updated_at": partner.updated_at.isoformat() if partner.updated_at else None,
    }


def _serialize_referral_activity(activity: ReferralActivity):
    metadata_json = None
    if activity.metadata_json:
        try:
            metadata_json = json.loads(activity.metadata_json)
        except Exception:
            metadata_json = activity.metadata_json

    return {
        "id": activity.id,
        "partner_id": activity.partner_id,
        "referral_code_id": activity.referral_code_id,
        "consumer_id": activity.consumer_id,
        "device_id": activity.device_id,
        "request_id": activity.request_id,
        "event_type": activity.event_type,
        "event_reference": activity.event_reference,
        "metadata": metadata_json,
        "notes": activity.notes,
        "occurred_at": activity.occurred_at.isoformat() if activity.occurred_at else None,
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
    }


def _serialize_referral_fee(fee: ReferralFee):
    return {
        "id": fee.id,
        "partner_id": fee.partner_id,
        "referral_code_id": fee.referral_code_id,
        "referral_activity_id": fee.referral_activity_id,
        "consumer_id": fee.consumer_id,
        "device_id": fee.device_id,
        "request_id": fee.request_id,
        "status": fee.status,
        "fee_amount": fee.fee_amount,
        "currency": fee.currency,
        "fee_reference": fee.fee_reference,
        "due_at": fee.due_at.isoformat() if fee.due_at else None,
        "confirmed_at": fee.confirmed_at.isoformat() if fee.confirmed_at else None,
        "paid_at": fee.paid_at.isoformat() if fee.paid_at else None,
        "created_at": fee.created_at.isoformat() if fee.created_at else None,
        "updated_at": fee.updated_at.isoformat() if fee.updated_at else None,
    }


def _serialize_referral_code_summary(session, referral_code: ReferralCode | None):
    if not referral_code:
        return None
    partner = session.get(ThirdPartyPartner, referral_code.partner_id) if referral_code.partner_id else None
    device = session.get(Device, referral_code.device_id) if referral_code.device_id else None
    return {
        "id": referral_code.id,
        "code": referral_code.code,
        "partner_id": referral_code.partner_id,
        "consumer_id": referral_code.consumer_id,
        "device_id": referral_code.device_id,
        "request_id": referral_code.request_id,
        "classification_snapshot": referral_code.classification_snapshot,
        "status": referral_code.status,
        "issued_at": referral_code.issued_at.isoformat() if referral_code.issued_at else None,
        "redeemed_at": referral_code.redeemed_at.isoformat() if referral_code.redeemed_at else None,
        "created_at": referral_code.created_at.isoformat() if referral_code.created_at else None,
        "updated_at": referral_code.updated_at.isoformat() if referral_code.updated_at else None,
        "partner": _serialize_partner(partner) if partner else None,
        "device": _serialize_device_summary(device),
    }


def _serialize_referral_code(session, referral_code: ReferralCode):
    partner = session.get(ThirdPartyPartner, referral_code.partner_id) if referral_code.partner_id else None
    device = session.get(Device, referral_code.device_id) if referral_code.device_id else None
    activities = (
        session.query(ReferralActivity)
        .filter(ReferralActivity.referral_code_id == referral_code.id)
        .order_by(ReferralActivity.occurred_at.desc(), ReferralActivity.id.desc())
        .all()
    )
    fees = (
        session.query(ReferralFee)
        .filter(ReferralFee.referral_code_id == referral_code.id)
        .order_by(ReferralFee.created_at.desc(), ReferralFee.id.desc())
        .all()
    )
    return {
        "id": referral_code.id,
        "code": referral_code.code,
        "partner_id": referral_code.partner_id,
        "consumer_id": referral_code.consumer_id,
        "device_id": referral_code.device_id,
        "request_id": referral_code.request_id,
        "classification_snapshot": referral_code.classification_snapshot,
        "qr_payload": referral_code.qr_payload,
        "qr_target_url": referral_code.qr_target_url,
        "voucher_label": referral_code.voucher_label,
        "bonus_label": referral_code.bonus_label,
        "status": referral_code.status,
        "issued_at": referral_code.issued_at.isoformat() if referral_code.issued_at else None,
        "redeemed_at": referral_code.redeemed_at.isoformat() if referral_code.redeemed_at else None,
        "expires_at": referral_code.expires_at.isoformat() if referral_code.expires_at else None,
        "created_at": referral_code.created_at.isoformat() if referral_code.created_at else None,
        "updated_at": referral_code.updated_at.isoformat() if referral_code.updated_at else None,
        "partner": _serialize_partner(partner) if partner else None,
        "device": _serialize_device_summary(device),
        "activities": [_serialize_referral_activity(activity) for activity in activities],
        "latest_activity": _serialize_referral_activity(activities[0]) if activities else None,
        "fees": [_serialize_referral_fee(fee) for fee in fees],
        "latest_fee": _serialize_referral_fee(fees[0]) if fees else None,
    }


def _ensure_default_referral_partners(session):
    now = _utcnow()
    defaults = [
        _referral_defaults_for_classification("current"),
        _referral_defaults_for_classification("rare"),
    ]
    created = False
    for default in defaults:
        if default is None:
            continue
        partner = (
            session.query(ThirdPartyPartner)
            .filter(ThirdPartyPartner.name == default["partner_name"])
            .first()
        )
        if partner is None:
            partner = ThirdPartyPartner(
                name=default["partner_name"],
                partner_type=default["partner_type"],
                website_url=default["website_url"],
                referral_landing_url=default["referral_landing_url"],
                active=True,
                created_at=now,
                updated_at=now,
            )
            session.add(partner)
            created = True
        else:
            changed = False
            if not partner.partner_type:
                partner.partner_type = default["partner_type"]
                changed = True
            if not partner.website_url:
                partner.website_url = default["website_url"]
                changed = True
            if not partner.referral_landing_url:
                partner.referral_landing_url = default["referral_landing_url"]
                changed = True
            if changed:
                partner.updated_at = now
    if created:
        session.commit()


def _find_default_partner(session, classification: str | None):
    default = _referral_defaults_for_classification(classification)
    if default is None:
        return None
    _ensure_default_referral_partners(session)
    return (
        session.query(ThirdPartyPartner)
        .filter(ThirdPartyPartner.name == default["partner_name"])
        .first()
    )


def _find_reward_voucher_by_code(session, code: str):
    return session.query(RewardVoucher).filter(RewardVoucher.code == code).first()


def _ensure_reward_voucher_for_referral(session, referral_code: ReferralCode):
    if not referral_code.code:
        return None
    existing = _find_reward_voucher_by_code(session, referral_code.code)
    partner = session.get(ThirdPartyPartner, referral_code.partner_id) if referral_code.partner_id else None
    partner_name = partner.name if partner else (referral_code.classification_snapshot or "Partner")
    if existing is None:
        existing = RewardVoucher(
            consumer_id=referral_code.consumer_id,
            device_id=referral_code.device_id,
            request_id=referral_code.request_id,
            partner=partner_name,
            title=referral_code.voucher_label,
            value_label=referral_code.bonus_label,
            code=referral_code.code,
            status="active" if referral_code.status in {"issued", "opened"} else referral_code.status,
            created_at=referral_code.created_at or _utcnow(),
        )
        session.add(existing)
        session.flush()
        return existing

    changed = False
    if existing.partner != partner_name:
        existing.partner = partner_name
        changed = True
    if existing.title != referral_code.voucher_label:
        existing.title = referral_code.voucher_label
        changed = True
    if existing.value_label != referral_code.bonus_label:
        existing.value_label = referral_code.bonus_label
        changed = True
    next_status = "active" if referral_code.status in {"issued", "opened"} else referral_code.status
    if existing.status != next_status:
        existing.status = next_status
        changed = True
    if changed:
        session.flush()
    return existing


def _singleton_referral_activity(session, referral_code_id: int, event_type: str, event_reference: str | None):
    query = session.query(ReferralActivity).filter(
        ReferralActivity.referral_code_id == referral_code_id,
        ReferralActivity.event_type == event_type,
    )
    if event_reference:
        query = query.filter(ReferralActivity.event_reference == event_reference)
    elif event_type in REFERRAL_SINGLETON_EVENT_TYPES:
        query = query.filter(ReferralActivity.event_reference.is_(None))
    else:
        return None
    return query.order_by(ReferralActivity.id.desc()).first()


def _parse_datetime_filter(value, *, boundary: str):
    if value in (None, ""):
        return None
    parsed = _dt(value)
    if parsed is None:
        raise ValueError("invalid datetime filter")
    if isinstance(value, str) and len(value.strip()) == 10 and "T" not in value and boundary == "end":
        parsed = parsed + timedelta(days=1) - timedelta(microseconds=1)
    return parsed


def _counts_by(items, key_fn):
    counts = {}
    for item in items:
        key = key_fn(item)
        if key in (None, ""):
            key = "unknown"
        counts[key] = counts.get(key, 0) + 1
    return counts


def _sum_amount(items, predicate=None):
    total = 0
    for item in items:
        if predicate and not predicate(item):
            continue
        if item.amount is not None:
            total += item.amount
    return total


def _resolve_partner_filter_id(session, partner_id: int | None = None, partner: str | None = None):
    if partner_id is not None:
        return partner_id
    normalized_partner = _normalize_text(partner)
    if not normalized_partner:
        return None
    matched_partner = (
        session.query(ThirdPartyPartner)
        .filter(ThirdPartyPartner.name.ilike(normalized_partner))
        .order_by(ThirdPartyPartner.id.asc())
        .first()
    )
    if matched_partner is not None:
        return matched_partner.id
    matched_partner = (
        session.query(ThirdPartyPartner)
        .filter(ThirdPartyPartner.name.ilike(f"%{normalized_partner}%"))
        .order_by(ThirdPartyPartner.id.asc())
        .first()
    )
    if matched_partner is not None:
        return matched_partner.id
    return -1


def _query_payment_transactions(
    session,
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    provider: str | None = None,
    payment_kind: str | None = None,
):
    start_dt = _parse_datetime_filter(from_at, boundary="start")
    end_dt = _parse_datetime_filter(to_at, boundary="end")

    query = session.query(PaymentTransaction)
    if start_dt is not None:
        query = query.filter(PaymentTransaction.created_at >= start_dt)
    if end_dt is not None:
        query = query.filter(PaymentTransaction.created_at <= end_dt)
    if status:
        query = query.filter(PaymentTransaction.status == _normalize_text(status).lower())
    if provider:
        query = query.filter(PaymentTransaction.provider == _normalize_text(provider).lower())
    if payment_kind:
        query = query.filter(PaymentTransaction.payment_kind == _normalize_text(payment_kind).lower())
    return query


def _serialize_payment_transaction_report(session, transaction: PaymentTransaction):
    retrieval = session.get(DataRetrievalRequest, transaction.retrieval_request_id) if transaction.retrieval_request_id else None
    consumer = session.get(User, transaction.consumer_id) if transaction.consumer_id else None
    device = session.get(Device, retrieval.device_id) if retrieval and retrieval.device_id else None
    payload = _serialize_payment_transaction(transaction)
    payload["retrieval_request"] = _serialize_retrieval_request_summary(session, retrieval)
    payload["consumer"] = _serialize_user_summary(consumer)
    payload["consumer_email"] = consumer.email if consumer else None
    payload["device_name"] = device.name if device else None
    payload["device"] = _serialize_device_summary(device)
    return payload


def get_payment_report_summary(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    provider: str | None = None,
    payment_kind: str | None = None,
):
    session = get_session()
    try:
        items = (
            _query_payment_transactions(
                session,
                from_at=from_at,
                to_at=to_at,
                status=status,
                provider=provider,
                payment_kind=payment_kind,
            )
            .order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc())
            .all()
        )
        latest_created_at = items[0].created_at.isoformat() if items and items[0].created_at else None
        return {
            "total_transactions": len(items),
            "total_amount": _sum_amount(items),
            "counts_by_status": _counts_by(items, lambda item: item.status),
            "counts_by_provider": _counts_by(items, lambda item: item.provider),
            "counts_by_payment_kind": _counts_by(items, lambda item: item.payment_kind),
            "paid_amount": _sum_amount(items, lambda item: item.status == "paid"),
            "pending_amount": _sum_amount(items, lambda item: item.status == "pending"),
            "initiated_amount": _sum_amount(items, lambda item: item.status == "initiated"),
            "latest_created_at": latest_created_at,
        }
    finally:
        _close(session)


def list_payment_report_transactions(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    provider: str | None = None,
    payment_kind: str | None = None,
):
    session = get_session()
    try:
        items = (
            _query_payment_transactions(
                session,
                from_at=from_at,
                to_at=to_at,
                status=status,
                provider=provider,
                payment_kind=payment_kind,
            )
            .order_by(PaymentTransaction.created_at.desc(), PaymentTransaction.id.desc())
            .all()
        )
        return [_serialize_payment_transaction_report(session, item) for item in items]
    finally:
        _close(session)


def _query_referral_codes(
    session,
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    start_dt = _parse_datetime_filter(from_at, boundary="start")
    end_dt = _parse_datetime_filter(to_at, boundary="end")
    resolved_partner_id = _resolve_partner_filter_id(session, partner_id=partner_id, partner=partner)

    query = session.query(ReferralCode)
    if start_dt is not None:
        query = query.filter(ReferralCode.created_at >= start_dt)
    if end_dt is not None:
        query = query.filter(ReferralCode.created_at <= end_dt)
    if status:
        query = query.filter(ReferralCode.status == _normalize_text(status).lower())
    if resolved_partner_id is not None:
        query = query.filter(ReferralCode.partner_id == resolved_partner_id)
    return query


def _query_referral_fees(
    session,
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    start_dt = _parse_datetime_filter(from_at, boundary="start")
    end_dt = _parse_datetime_filter(to_at, boundary="end")
    resolved_partner_id = _resolve_partner_filter_id(session, partner_id=partner_id, partner=partner)

    query = session.query(ReferralFee)
    if start_dt is not None:
        query = query.filter(ReferralFee.created_at >= start_dt)
    if end_dt is not None:
        query = query.filter(ReferralFee.created_at <= end_dt)
    if status:
        query = query.filter(ReferralFee.status == _normalize_text(status).lower())
    if resolved_partner_id is not None:
        query = query.filter(ReferralFee.partner_id == resolved_partner_id)
    return query


def _query_referral_activity(
    session,
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    start_dt = _parse_datetime_filter(from_at, boundary="start")
    end_dt = _parse_datetime_filter(to_at, boundary="end")
    resolved_partner_id = _resolve_partner_filter_id(session, partner_id=partner_id, partner=partner)

    query = session.query(ReferralActivity)
    if start_dt is not None:
        query = query.filter(ReferralActivity.occurred_at >= start_dt)
    if end_dt is not None:
        query = query.filter(ReferralActivity.occurred_at <= end_dt)
    if resolved_partner_id is not None:
        query = query.filter(ReferralActivity.partner_id == resolved_partner_id)
    if status:
        normalized_status = _normalize_text(status).lower()
        query = query.join(ReferralCode, ReferralCode.id == ReferralActivity.referral_code_id).filter(
            ReferralCode.status == normalized_status
        )
    return query


def _serialize_referral_fee_report(session, fee: ReferralFee):
    partner = session.get(ThirdPartyPartner, fee.partner_id) if fee.partner_id else None
    referral_code = session.get(ReferralCode, fee.referral_code_id) if fee.referral_code_id else None
    collection_request = session.get(CollectionRequest, fee.request_id) if fee.request_id else None
    device = session.get(Device, fee.device_id) if fee.device_id else None
    consumer = session.get(User, fee.consumer_id) if fee.consumer_id else None
    payload = _serialize_referral_fee(fee)
    payload["partner"] = _serialize_partner(partner) if partner else None
    payload["referral_code"] = _serialize_referral_code_summary(session, referral_code)
    payload["request"] = _serialize_collection_request_summary(collection_request)
    payload["device"] = _serialize_device_summary(device)
    payload["consumer"] = _serialize_user_summary(consumer)
    return payload


def _serialize_referral_activity_report(session, activity: ReferralActivity):
    partner = session.get(ThirdPartyPartner, activity.partner_id) if activity.partner_id else None
    referral_code = session.get(ReferralCode, activity.referral_code_id) if activity.referral_code_id else None
    collection_request = session.get(CollectionRequest, activity.request_id) if activity.request_id else None
    device = session.get(Device, activity.device_id) if activity.device_id else None
    consumer = session.get(User, activity.consumer_id) if activity.consumer_id else None
    payload = _serialize_referral_activity(activity)
    payload["metadata_json"] = activity.metadata_json
    payload["partner"] = _serialize_partner(partner) if partner else None
    payload["referral_code"] = _serialize_referral_code_summary(session, referral_code)
    payload["request"] = _serialize_collection_request_summary(collection_request)
    payload["device"] = _serialize_device_summary(device)
    payload["consumer"] = _serialize_user_summary(consumer)
    return payload


def get_referral_report_summary(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    session = get_session()
    try:
        codes = (
            _query_referral_codes(
                session,
                from_at=from_at,
                to_at=to_at,
                status=status,
                partner_id=partner_id,
                partner=partner,
            )
            .order_by(ReferralCode.created_at.desc(), ReferralCode.id.desc())
            .all()
        )
        fees = (
            _query_referral_fees(
                session,
                from_at=from_at,
                to_at=to_at,
                status=status,
                partner_id=partner_id,
                partner=partner,
            )
            .order_by(ReferralFee.created_at.desc(), ReferralFee.id.desc())
            .all()
        )
        activity = (
            _query_referral_activity(
                session,
                from_at=from_at,
                to_at=to_at,
                status=status,
                partner_id=partner_id,
                partner=partner,
            )
            .order_by(ReferralActivity.occurred_at.desc(), ReferralActivity.id.desc())
            .all()
        )

        counts_by_partner = {}
        for code in codes:
            partner_row = session.get(ThirdPartyPartner, code.partner_id) if code.partner_id else None
            partner_name = partner_row.name if partner_row else "unknown"
            counts_by_partner[partner_name] = counts_by_partner.get(partner_name, 0) + 1

        return {
            "total_referral_codes": len(codes),
            "total_referral_activity": len(activity),
            "total_referral_fees": len(fees),
            "fee_amount_total": sum((item.fee_amount or 0) for item in fees),
            "fee_amount_confirmed": sum((item.fee_amount or 0) for item in fees if item.status == "confirmed"),
            "fee_amount_paid": sum((item.fee_amount or 0) for item in fees if item.status == "paid"),
            "counts_by_fee_status": _counts_by(fees, lambda item: item.status),
            "counts_by_activity_event_type": _counts_by(activity, lambda item: item.event_type),
            "counts_by_partner": counts_by_partner,
        }
    finally:
        _close(session)


def list_referral_report_fees(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    session = get_session()
    try:
        items = (
            _query_referral_fees(
                session,
                from_at=from_at,
                to_at=to_at,
                status=status,
                partner_id=partner_id,
                partner=partner,
            )
            .order_by(ReferralFee.created_at.desc(), ReferralFee.id.desc())
            .all()
        )
        return [_serialize_referral_fee_report(session, item) for item in items]
    finally:
        _close(session)


def list_referral_report_activity(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    session = get_session()
    try:
        items = (
            _query_referral_activity(
                session,
                from_at=from_at,
                to_at=to_at,
                status=status,
                partner_id=partner_id,
                partner=partner,
            )
            .order_by(ReferralActivity.occurred_at.desc(), ReferralActivity.id.desc())
            .all()
        )
        return [_serialize_referral_activity_report(session, item) for item in items]
    finally:
        _close(session)

# ---------- rewards ----------
def create_reward_voucher(
    consumer_id: int,
    device_id: int | None = None,
    request_id: int | None = None,
    partner: str = "CeX UK",
    title: str = "Trade-in Bonus",
    value_label: str = "£0.00",
    code: str = "eWasteHub-Ref",
    status: str = "active",
):
    session = get_session()
    try:
        voucher = RewardVoucher(
            consumer_id=consumer_id,
            device_id=device_id,
            request_id=request_id,
            partner=partner,
            title=title,
            value_label=value_label,
            code=code,
            status=status,
        )
        session.add(voucher)
        session.commit()
        session.refresh(voucher)
        return get_reward_voucher(voucher.id)
    finally:
        _close(session)


def get_reward_voucher(voucher_id: int):
    session = get_session()
    try:
        voucher = session.get(RewardVoucher, voucher_id)
        if not voucher:
            return None

        device = session.get(Device, voucher.device_id) if voucher.device_id else None
        referral_code = None
        if voucher.code:
            referral_code = (
                session.query(ReferralCode)
                .filter(ReferralCode.code == voucher.code)
                .order_by(ReferralCode.created_at.desc(), ReferralCode.id.desc())
                .first()
            )
        return {
            "id": voucher.id,
            "consumer_id": voucher.consumer_id,
            "device_id": voucher.device_id,
            "request_id": voucher.request_id,
            "partner": voucher.partner,
            "title": voucher.title,
            "value_label": voucher.value_label,
            "code": voucher.code,
            "status": voucher.status,
            "created_at": voucher.created_at.isoformat() if voucher.created_at else None,
            "device": {
                "id": device.id,
                "name": device.name,
                "device_type": device.device_type,
                "classification": device.classification,
            } if device else None,
            "referral_code": _serialize_referral_code(session, referral_code) if referral_code else None,
        }
    finally:
        _close(session)


def list_user_reward_vouchers(consumer_id: int):
    session = get_session()
    try:
        items = (
            session.query(RewardVoucher)
            .filter(RewardVoucher.consumer_id == consumer_id)
            .order_by(RewardVoucher.created_at.desc())
            .all()
        )
        return [get_reward_voucher(item.id) for item in items]
    finally:
        _close(session)


def list_partner_options(classification: str | None = None):
    session = get_session()
    try:
        _ensure_default_referral_partners(session)
        query = session.query(ThirdPartyPartner).filter(ThirdPartyPartner.active.is_(True))
        normalized = _normalize_text(classification).lower()
        if normalized == "current":
            query = query.filter(ThirdPartyPartner.partner_type == "resale")
        elif normalized == "rare":
            query = query.filter(ThirdPartyPartner.partner_type == "marketplace")
        items = query.order_by(ThirdPartyPartner.name.asc(), ThirdPartyPartner.id.asc()).all()
        return [_serialize_partner(item) for item in items]
    finally:
        _close(session)


def get_partner_option(partner_id: int):
    session = get_session()
    try:
        _ensure_default_referral_partners(session)
        partner = session.get(ThirdPartyPartner, partner_id)
        if not partner:
            return None
        return _serialize_partner(partner)
    finally:
        _close(session)


def issue_referral_code(
    *,
    consumer_id: int,
    device_id: int | None = None,
    request_id: int | None = None,
    partner_id: int | None = None,
    qr_target_url: str | None = None,
):
    session = get_session()
    try:
        _ensure_default_referral_partners(session)
        now = _utcnow()
        request_record = session.get(CollectionRequest, request_id) if request_id else None
        if request_record and request_record.consumer_id != consumer_id:
            raise ValueError("request does not belong to the consumer")

        if request_record and device_id is None:
            device_id = request_record.device_id

        device = session.get(Device, device_id) if device_id else None
        if device is None:
            raise ValueError("device not found")
        if device.owner_id != consumer_id:
            raise ValueError("device does not belong to the consumer")

        classification = _normalize_text(device.classification).lower()
        if classification not in {"current", "rare"}:
            raise ValueError("device is not eligible for third-party referral")

        if partner_id is not None:
            partner = session.get(ThirdPartyPartner, partner_id)
            if partner is None or not partner.active:
                raise ValueError("partner not found")
        else:
            partner = _find_default_partner(session, classification)
            if partner is None:
                raise ValueError("no partner available for this device classification")

        existing = (
            session.query(ReferralCode)
            .filter(ReferralCode.consumer_id == consumer_id)
            .filter(ReferralCode.device_id == device.id)
            .filter(ReferralCode.partner_id == partner.id)
            .order_by(ReferralCode.created_at.desc(), ReferralCode.id.desc())
            .first()
        )
        if existing and existing.status in {"issued", "opened", "redeemed", "handin_confirmed", "resale_confirmed"}:
            _ensure_reward_voucher_for_referral(session, existing)
            session.commit()
            return _serialize_referral_code(session, existing)

        defaults = _referral_defaults_for_classification(classification) or {}
        bonus_label = "GBP 185.00" if classification == "current" else "GBP 250.00"
        request_reference = request_id or (request_record.id if request_record else device.id)
        code_prefix = "EWH" if classification == "current" else "RARE"
        referral_code = ReferralCode(
            code=f"{code_prefix}-{request_reference}-{token_urlsafe(4).upper()}",
            partner_id=partner.id,
            consumer_id=consumer_id,
            device_id=device.id,
            request_id=request_record.id if request_record else request_id,
            classification_snapshot=classification,
            qr_payload=None,
            qr_target_url=qr_target_url or partner.referral_landing_url,
            voucher_label=defaults.get("voucher_label"),
            bonus_label=bonus_label,
            status="issued",
            issued_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(referral_code)
        session.flush()

        if not referral_code.qr_target_url:
            referral_code.qr_target_url = f"/api/rewards/referrals/code/{referral_code.code}"
        referral_code.qr_payload = json.dumps(
            {
                "code": referral_code.code,
                "referral_code_id": referral_code.id,
                "partner_id": referral_code.partner_id,
                "partner_name": partner.name,
                "target_url": referral_code.qr_target_url,
                "classification": classification,
            }
        )

        activity = ReferralActivity(
            partner_id=partner.id,
            referral_code_id=referral_code.id,
            consumer_id=consumer_id,
            device_id=device.id,
            request_id=referral_code.request_id,
            event_type="issued",
            occurred_at=now,
            created_at=now,
        )
        session.add(activity)
        _add_notification(
            session,
            user_id=consumer_id,
            kind="referral",
            severity="success",
            title="Trade-in QR code ready",
            body=f"{device.name} is ready for partner hand-in at {partner.name}.",
            target_path=f"/app/rewards/referrals/{referral_code.id}",
        )
        _ensure_reward_voucher_for_referral(session, referral_code)
        session.commit()
        session.refresh(referral_code)
        return _serialize_referral_code(session, referral_code)
    finally:
        _close(session)


def get_referral_code(referral_code_id: int):
    session = get_session()
    try:
        referral_code = session.get(ReferralCode, referral_code_id)
        if referral_code is None:
            return None
        return _serialize_referral_code(session, referral_code)
    finally:
        _close(session)


def get_referral_code_by_code(code: str):
    session = get_session()
    try:
        referral_code = (
            session.query(ReferralCode)
            .filter(ReferralCode.code == code)
            .order_by(ReferralCode.created_at.desc(), ReferralCode.id.desc())
            .first()
        )
        if referral_code is None:
            return None
        return _serialize_referral_code(session, referral_code)
    finally:
        _close(session)


def record_referral_activity(
    referral_code_id: int,
    *,
    event_type: str,
    actor_consumer_id: int | None = None,
    event_reference: str | None = None,
    metadata: dict | str | None = None,
    notes: str | None = None,
):
    session = get_session()
    try:
        referral_code = session.get(ReferralCode, referral_code_id)
        if referral_code is None:
            return None

        normalized_event_type = _normalize_text(event_type).lower()
        if normalized_event_type not in REFERRAL_EVENT_TYPES:
            raise ValueError("unsupported referral event type")

        if actor_consumer_id is not None and referral_code.consumer_id != actor_consumer_id:
            raise ValueError("referral code does not belong to the consumer")

        existing = _singleton_referral_activity(
            session,
            referral_code_id,
            normalized_event_type,
            _normalize_text(event_reference) or None,
        )
        if existing is not None:
            return {
                "referral_code": _serialize_referral_code(session, referral_code),
                "activity": _serialize_referral_activity(existing),
            }

        now = _utcnow()
        payload = None
        if metadata is not None:
            payload = metadata if isinstance(metadata, str) else json.dumps(metadata)
        activity = ReferralActivity(
            partner_id=referral_code.partner_id,
            referral_code_id=referral_code.id,
            consumer_id=referral_code.consumer_id,
            device_id=referral_code.device_id,
            request_id=referral_code.request_id,
            event_type=normalized_event_type,
            event_reference=_normalize_text(event_reference) or None,
            metadata_json=payload,
            notes=notes,
            occurred_at=now,
            created_at=now,
        )
        session.add(activity)

        if normalized_event_type == "opened" and referral_code.status == "issued":
            referral_code.status = "opened"
        elif normalized_event_type == "redeemed":
            referral_code.status = "redeemed"
            referral_code.redeemed_at = referral_code.redeemed_at or now
        elif normalized_event_type == "handin_confirmed":
            referral_code.status = "handin_confirmed"
        elif normalized_event_type == "resale_confirmed":
            referral_code.status = "resale_confirmed"

        referral_code.updated_at = now
        _ensure_reward_voucher_for_referral(session, referral_code)
        session.commit()
        session.refresh(referral_code)
        session.refresh(activity)
        return {
            "referral_code": _serialize_referral_code(session, referral_code),
            "activity": _serialize_referral_activity(activity),
        }
    finally:
        _close(session)


def create_referral_fee(
    *,
    referral_code_id: int,
    status: str = "expected",
    fee_amount: int | None = None,
    currency: str = "GBP",
    fee_reference: str | None = None,
    due_at=None,
    referral_activity_id: int | None = None,
):
    session = get_session()
    try:
        referral_code = session.get(ReferralCode, referral_code_id)
        if referral_code is None:
            return None

        normalized_status = _normalize_text(status).lower()
        if normalized_status not in REFERRAL_FEE_STATUSES:
            raise ValueError("unsupported referral fee status")

        existing = None
        if fee_reference:
            existing = (
                session.query(ReferralFee)
                .filter(ReferralFee.fee_reference == fee_reference)
                .order_by(ReferralFee.created_at.desc(), ReferralFee.id.desc())
                .first()
            )
        if existing is None and referral_activity_id is not None:
            existing = (
                session.query(ReferralFee)
                .filter(ReferralFee.referral_activity_id == referral_activity_id)
                .order_by(ReferralFee.created_at.desc(), ReferralFee.id.desc())
                .first()
            )
        if existing is not None:
            return _serialize_referral_fee(existing)

        now = _utcnow()
        fee = ReferralFee(
            partner_id=referral_code.partner_id,
            referral_code_id=referral_code.id,
            referral_activity_id=referral_activity_id,
            consumer_id=referral_code.consumer_id,
            device_id=referral_code.device_id,
            request_id=referral_code.request_id,
            status=normalized_status,
            fee_amount=fee_amount,
            currency=(currency or "GBP").strip().upper() or "GBP",
            fee_reference=_normalize_text(fee_reference) or None,
            due_at=_dt(due_at),
            confirmed_at=now if normalized_status == "confirmed" else None,
            paid_at=now if normalized_status == "paid" else None,
            created_at=now,
            updated_at=now,
        )
        session.add(fee)
        session.commit()
        session.refresh(fee)
        return _serialize_referral_fee(fee)
    finally:
        _close(session)


def update_referral_fee(
    referral_fee_id: int,
    *,
    status: str | None = None,
    fee_amount: int | None | object = _UNSET,
    currency: str | None = None,
    fee_reference: str | None | object = _UNSET,
    due_at: str | None | object = _UNSET,
):
    session = get_session()
    try:
        fee = session.get(ReferralFee, referral_fee_id)
        if fee is None:
            return None

        now = _utcnow()
        if status is not None:
            normalized_status = _normalize_text(status).lower()
            if normalized_status not in REFERRAL_FEE_STATUSES:
                raise ValueError("unsupported referral fee status")
            fee.status = normalized_status
            if normalized_status == "confirmed" and fee.confirmed_at is None:
                fee.confirmed_at = now
            if normalized_status == "paid" and fee.paid_at is None:
                fee.paid_at = now
            if normalized_status == "cancelled":
                fee.paid_at = None
        if fee_amount is not _UNSET:
            fee.fee_amount = fee_amount
        if currency is not None:
            fee.currency = (currency or "GBP").strip().upper() or "GBP"
        if fee_reference is not _UNSET:
            fee.fee_reference = _normalize_text(fee_reference) or None
        if due_at is not _UNSET:
            fee.due_at = _dt(due_at)
        fee.updated_at = now
        session.commit()
        session.refresh(fee)
        return _serialize_referral_fee(fee)
    finally:
        _close(session)


def list_referral_fees(*, status: str | None = None, partner_id: int | None = None):
    session = get_session()
    try:
        query = session.query(ReferralFee)
        if status:
            query = query.filter(ReferralFee.status == _normalize_text(status).lower())
        if partner_id is not None:
            query = query.filter(ReferralFee.partner_id == partner_id)
        items = query.order_by(ReferralFee.created_at.desc(), ReferralFee.id.desc()).all()
        return [_serialize_referral_fee(item) for item in items]
    finally:
        _close(session)


def list_referral_activity(*, event_type: str | None = None, referral_code_id: int | None = None):
    session = get_session()
    try:
        query = session.query(ReferralActivity)
        if event_type:
            query = query.filter(ReferralActivity.event_type == _normalize_text(event_type).lower())
        if referral_code_id is not None:
            query = query.filter(ReferralActivity.referral_code_id == referral_code_id)
        items = query.order_by(ReferralActivity.occurred_at.desc(), ReferralActivity.id.desc()).all()
        return [_serialize_referral_activity(item) for item in items]
    finally:
        _close(session)


def _serialize_referral_fee_report_item(session, fee: ReferralFee):
    payload = _serialize_referral_fee(fee)
    partner = session.get(ThirdPartyPartner, fee.partner_id) if fee.partner_id else None
    referral_code = session.get(ReferralCode, fee.referral_code_id) if fee.referral_code_id else None
    device = session.get(Device, fee.device_id) if fee.device_id else None
    payload["partner"] = _serialize_partner(partner) if partner else None
    payload["referral_code"] = _serialize_referral_code(session, referral_code) if referral_code else None
    payload["request"] = get_collection_request(fee.request_id) if fee.request_id else None
    payload["device"] = _serialize_device_summary(device)
    return payload


def _serialize_referral_activity_report_item(session, activity: ReferralActivity):
    payload = _serialize_referral_activity(activity)
    partner = session.get(ThirdPartyPartner, activity.partner_id) if activity.partner_id else None
    referral_code = session.get(ReferralCode, activity.referral_code_id) if activity.referral_code_id else None
    payload["metadata_json"] = payload.pop("metadata")
    payload["partner"] = _serialize_partner(partner) if partner else None
    payload["referral_code"] = _serialize_referral_code(session, referral_code) if referral_code else None
    return payload


def list_referral_report_fees(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    session = get_session()
    try:
        query = session.query(ReferralFee)
        query = _report_time_filtered_query(query, ReferralFee, from_at=from_at, to_at=to_at)
        normalized_status = _normalize_text(status).lower()
        normalized_partner = _normalize_text(partner)
        if normalized_status:
            query = query.filter(ReferralFee.status == normalized_status)
        if partner_id is not None:
            query = query.filter(ReferralFee.partner_id == partner_id)
        if normalized_partner:
            query = query.join(ThirdPartyPartner, ThirdPartyPartner.id == ReferralFee.partner_id)
            query = query.filter(ThirdPartyPartner.name == normalized_partner)
        items = query.order_by(ReferralFee.created_at.desc(), ReferralFee.id.desc()).all()
        return [_serialize_referral_fee_report_item(session, item) for item in items]
    finally:
        _close(session)


def list_referral_report_activity(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    session = get_session()
    try:
        query = session.query(ReferralActivity)
        query = _report_time_filtered_query(
            query,
            ReferralActivity,
            from_at=from_at,
            to_at=to_at,
            field_name="occurred_at",
        )
        normalized_status = _normalize_text(status).lower()
        normalized_partner = _normalize_text(partner)
        if normalized_status:
            query = query.join(ReferralCode, ReferralCode.id == ReferralActivity.referral_code_id)
            query = query.filter(ReferralCode.status == normalized_status)
        if partner_id is not None:
            query = query.filter(ReferralActivity.partner_id == partner_id)
        if normalized_partner:
            query = query.join(ThirdPartyPartner, ThirdPartyPartner.id == ReferralActivity.partner_id)
            query = query.filter(ThirdPartyPartner.name == normalized_partner)
        items = query.order_by(ReferralActivity.occurred_at.desc(), ReferralActivity.id.desc()).all()
        return [_serialize_referral_activity_report_item(session, item) for item in items]
    finally:
        _close(session)


def get_referral_report_summary(
    *,
    from_at=None,
    to_at=None,
    status: str | None = None,
    partner_id: int | None = None,
    partner: str | None = None,
):
    fees = list_referral_report_fees(
        from_at=from_at,
        to_at=to_at,
        status=status,
        partner_id=partner_id,
        partner=partner,
    )
    activity = list_referral_report_activity(
        from_at=from_at,
        to_at=to_at,
        status=status,
        partner_id=partner_id,
        partner=partner,
    )

    counts_by_fee_status = {}
    counts_by_activity_event_type = {}
    partner_names_by_referral_code = {}
    referral_code_ids = set()
    fee_amount_total = 0
    fee_amount_confirmed = 0
    fee_amount_paid = 0

    for item in fees:
        current_status = item.get("status")
        amount = item.get("fee_amount") or 0
        referral_code_id = item.get("referral_code_id")
        partner_name = ((item.get("partner") or {}).get("name")) or None

        if current_status:
            counts_by_fee_status[current_status] = counts_by_fee_status.get(current_status, 0) + 1
        if referral_code_id is not None:
            referral_code_ids.add(referral_code_id)
            if partner_name:
                partner_names_by_referral_code[referral_code_id] = partner_name

        fee_amount_total += amount
        if current_status == "confirmed":
            fee_amount_confirmed += amount
        if current_status == "paid":
            fee_amount_paid += amount

    for item in activity:
        event_type = item.get("event_type")
        referral_code_id = item.get("referral_code_id")
        partner_name = ((item.get("partner") or {}).get("name")) or None

        if event_type:
            counts_by_activity_event_type[event_type] = counts_by_activity_event_type.get(event_type, 0) + 1
        if referral_code_id is not None:
            referral_code_ids.add(referral_code_id)
            if partner_name:
                partner_names_by_referral_code[referral_code_id] = partner_name

    counts_by_partner = {}
    for partner_name in partner_names_by_referral_code.values():
        counts_by_partner[partner_name] = counts_by_partner.get(partner_name, 0) + 1

    return {
        "total_referral_codes": len(referral_code_ids),
        "total_referral_activity": len(activity),
        "total_referral_fees": len(fees),
        "fee_amount_total": fee_amount_total,
        "fee_amount_confirmed": fee_amount_confirmed,
        "fee_amount_paid": fee_amount_paid,
        "counts_by_fee_status": counts_by_fee_status,
        "counts_by_activity_event_type": counts_by_activity_event_type,
        "counts_by_partner": counts_by_partner,
    }


def _serialize_wipe_certificate(certificate: WipeCertificate):
    return {
        "id": certificate.id,
        "wipe_job_id": certificate.wipe_job_id,
        "certificate_reference": certificate.certificate_reference,
        "certificate_url": certificate.certificate_url,
        "storage_key": certificate.storage_key,
        "issued_at": certificate.issued_at.isoformat() if certificate.issued_at else None,
        "expires_at": certificate.expires_at.isoformat() if certificate.expires_at else None,
        "created_at": certificate.created_at.isoformat() if certificate.created_at else None,
    }


def _serialize_wipe_job(session, wipe_job: WipeJob, *, include_certificates: bool = False):
    device = session.get(Device, wipe_job.device_id) if wipe_job.device_id else None
    collection_request = session.get(CollectionRequest, wipe_job.request_id) if wipe_job.request_id else None
    certificates = []
    if include_certificates:
        certificate_rows = (
            session.query(WipeCertificate)
            .filter(WipeCertificate.wipe_job_id == wipe_job.id)
            .order_by(WipeCertificate.issued_at.desc(), WipeCertificate.id.desc())
            .all()
        )
        certificates = [_serialize_wipe_certificate(item) for item in certificate_rows]

    return {
        "id": wipe_job.id,
        "device_id": wipe_job.device_id,
        "request_id": wipe_job.request_id,
        "consumer_id": wipe_job.consumer_id,
        "assigned_staff_id": wipe_job.assigned_staff_id,
        "wipe_type": wipe_job.wipe_type,
        "status": wipe_job.status,
        "requested_at": wipe_job.requested_at.isoformat() if wipe_job.requested_at else None,
        "started_at": wipe_job.started_at.isoformat() if wipe_job.started_at else None,
        "completed_at": wipe_job.completed_at.isoformat() if wipe_job.completed_at else None,
        "failed_at": wipe_job.failed_at.isoformat() if wipe_job.failed_at else None,
        "cancelled_at": wipe_job.cancelled_at.isoformat() if wipe_job.cancelled_at else None,
        "verification_status": wipe_job.verification_status,
        "notes": wipe_job.notes,
        "created_at": wipe_job.created_at.isoformat() if wipe_job.created_at else None,
        "updated_at": wipe_job.updated_at.isoformat() if wipe_job.updated_at else None,
        "device": _serialize_device_summary(device),
        "request": get_collection_request(collection_request.id) if collection_request else None,
        "certificates": certificates,
        "certificate_count": len(certificates) if include_certificates else None,
    }


def create_wipe_job(
    *,
    device_id: int,
    request_id: int | None = None,
    consumer_id: int | None = None,
    assigned_staff_id: int | None = None,
    wipe_type: str = "standard",
    status: str = "queued",
    verification_status: str = "pending",
    requested_at=None,
    started_at=None,
    completed_at=None,
    failed_at=None,
    cancelled_at=None,
    notes: str | None = None,
):
    session = get_session()
    try:
        device = session.get(Device, device_id)
        if device is None:
            return None

        collection_request = session.get(CollectionRequest, request_id) if request_id else None
        if collection_request and collection_request.device_id != device_id:
            raise ValueError("request does not belong to the device")

        now = _utcnow()
        wipe_job = WipeJob(
            device_id=device_id,
            request_id=collection_request.id if collection_request else request_id,
            consumer_id=consumer_id if consumer_id is not None else device.owner_id,
            assigned_staff_id=assigned_staff_id,
            wipe_type=_normalize_text(wipe_type) or "standard",
            status=_normalize_text(status) or "queued",
            verification_status=_normalize_text(verification_status) or "pending",
            requested_at=_dt(requested_at) or now,
            started_at=_dt(started_at),
            completed_at=_dt(completed_at),
            failed_at=_dt(failed_at),
            cancelled_at=_dt(cancelled_at),
            notes=notes,
            created_at=now,
            updated_at=now,
        )
        session.add(wipe_job)
        session.commit()
        session.refresh(wipe_job)
        return _serialize_wipe_job(session, wipe_job, include_certificates=True)
    finally:
        _close(session)


def list_wipe_jobs(
    *,
    device_id: int | None = None,
    request_id: int | None = None,
    status: str | None = None,
    assigned_staff_id: int | None = None,
    verification_status: str | None = None,
):
    session = get_session()
    try:
        query = session.query(WipeJob)
        if device_id is not None:
            query = query.filter(WipeJob.device_id == device_id)
        if request_id is not None:
            query = query.filter(WipeJob.request_id == request_id)
        if status:
            query = query.filter(WipeJob.status == _normalize_text(status).lower())
        if assigned_staff_id is not None:
            query = query.filter(WipeJob.assigned_staff_id == assigned_staff_id)
        if verification_status:
            query = query.filter(WipeJob.verification_status == _normalize_text(verification_status).lower())
        rows = query.order_by(WipeJob.created_at.desc(), WipeJob.id.desc()).all()
        return [_serialize_wipe_job(session, row, include_certificates=False) for row in rows]
    finally:
        _close(session)


def get_wipe_job(wipe_job_id: int):
    session = get_session()
    try:
        wipe_job = session.get(WipeJob, wipe_job_id)
        if wipe_job is None:
            return None
        return _serialize_wipe_job(session, wipe_job, include_certificates=True)
    finally:
        _close(session)


def update_wipe_job(wipe_job_id: int, patch: dict[str, Any]):
    session = get_session()
    try:
        wipe_job = session.get(WipeJob, wipe_job_id)
        if wipe_job is None:
            return None

        now = _utcnow()
        for key, value in patch.items():
            if not hasattr(wipe_job, key):
                continue
            setattr(wipe_job, key, value)

        status = _normalize_text(getattr(wipe_job, "status", None)).lower()
        if status == "in_progress" and wipe_job.started_at is None:
            wipe_job.started_at = now
        if status == "completed":
            wipe_job.completed_at = wipe_job.completed_at or now
            if wipe_job.started_at is None:
                wipe_job.started_at = now
            wipe_job.failed_at = None
            wipe_job.cancelled_at = None
        elif status == "failed":
            wipe_job.failed_at = wipe_job.failed_at or now
            wipe_job.completed_at = None
            wipe_job.cancelled_at = None
        elif status == "cancelled":
            wipe_job.cancelled_at = wipe_job.cancelled_at or now
            wipe_job.completed_at = None
            wipe_job.failed_at = None

        wipe_job.updated_at = now
        session.commit()
        session.refresh(wipe_job)
        return _serialize_wipe_job(session, wipe_job, include_certificates=True)
    finally:
        _close(session)


def create_wipe_certificate(
    *,
    wipe_job_id: int,
    certificate_reference: str | None = None,
    certificate_url: str | None = None,
    storage_key: str | None = None,
    issued_at=None,
    expires_at=None,
):
    session = get_session()
    try:
        wipe_job = session.get(WipeJob, wipe_job_id)
        if wipe_job is None:
            return None

        normalized_reference = _normalize_text(certificate_reference) or None
        existing = None
        if normalized_reference:
            existing = (
                session.query(WipeCertificate)
                .filter(
                    WipeCertificate.wipe_job_id == wipe_job_id,
                    WipeCertificate.certificate_reference == normalized_reference,
                )
                .order_by(WipeCertificate.id.desc())
                .first()
            )
        if existing is not None:
            return _serialize_wipe_certificate(existing)

        certificate = WipeCertificate(
            wipe_job_id=wipe_job_id,
            certificate_reference=normalized_reference,
            certificate_url=_normalize_text(certificate_url) or None,
            storage_key=_normalize_text(storage_key) or None,
            issued_at=_dt(issued_at) or _utcnow(),
            expires_at=_dt(expires_at),
            created_at=_utcnow(),
        )
        session.add(certificate)
        session.commit()
        session.refresh(certificate)
        return _serialize_wipe_certificate(certificate)
    finally:
        _close(session)


def list_wipe_certificates(wipe_job_id: int):
    session = get_session()
    try:
        rows = (
            session.query(WipeCertificate)
            .filter(WipeCertificate.wipe_job_id == wipe_job_id)
            .order_by(WipeCertificate.issued_at.desc(), WipeCertificate.id.desc())
            .all()
        )
        return [_serialize_wipe_certificate(row) for row in rows]
    finally:
        _close(session)
