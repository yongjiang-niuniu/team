import os
from urllib.parse import urlencode

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from DBupdate.db_bridge import (
    EXTENSION_PAYMENT_KIND,
    INITIAL_RETRIEVAL_PAYMENT_KIND,
    access_data_retrieval_download,
    create_data_retrieval_request,
    get_data_retrieval_request,
    get_device as bridge_get_device,
    get_or_create_data_retrieval_download,
    initiate_retrieval_payment,
    issue_data_retrieval_download,
    list_user_data_retrieval_requests,
    run_retrieval_lifecycle_maintenance,
    update_data_retrieval_request_state,
    update_retrieval_payment_transaction,
)
from ..permissions import require_roles

vault_bp = Blueprint("vault", __name__, url_prefix="/api/vault")
retrieval_requests_bp = Blueprint("retrieval_requests", __name__, url_prefix="/api/retrieval-requests")
retrieval_download_bp = Blueprint("retrieval_download", __name__, url_prefix="/api/retrieval-download")

SUPPORTED_PAYMENT_PROVIDERS = {"stripe", "paypal"}
SUPPORTED_PAYMENT_KINDS = {INITIAL_RETRIEVAL_PAYMENT_KIND, EXTENSION_PAYMENT_KIND}
STAFF_VISIBLE_RETRIEVAL_ROLES = {"staff", "admin"}


def _s(value) -> str:
    return (value or "").strip()


def _sl(value) -> str:
    return _s(value).lower()


def _current_role() -> str:
    return _sl(get_jwt().get("role"))


def _is_staff_role(role: str) -> bool:
    return role in STAFF_VISIBLE_RETRIEVAL_ROLES


def _serialize_retrieval_request(retrieval_request):
    payload = dict(retrieval_request)
    payload["owner_id"] = payload.get("consumer_id")
    return payload


def _serialize_download(download):
    retrieval_request = dict(download.get("retrieval_request") or {})
    retrieval_request["owner_id"] = retrieval_request.get("consumer_id")
    return {
        "id": download.get("id"),
        "retrieval_request_id": download.get("retrieval_request_id"),
        "token": download.get("token"),
        "download_url": f"/api/retrieval-download/{download.get('token')}",
        "issued_at": download.get("issued_at") or download.get("created_at"),
        "created_at": download.get("created_at"),
        "expires_at": download.get("expires_at"),
        "revoked_at": download.get("revoked_at"),
        "consumed_at": download.get("consumed_at"),
        "retrieval_request": retrieval_request,
    }


def _frontend_url() -> str:
    return (current_app.config.get("FRONTEND_URL") or "http://127.0.0.1:5173").rstrip("/")


def _payment_provider_configured(provider: str) -> bool:
    if provider == "stripe":
        return bool(
            _s(os.getenv("STRIPE_SECRET_KEY") or current_app.config.get("STRIPE_SECRET_KEY"))
            and _s(os.getenv("STRIPE_PUBLISHABLE_KEY") or current_app.config.get("STRIPE_PUBLISHABLE_KEY"))
        )
    if provider == "paypal":
        return bool(
            _s(os.getenv("PAYPAL_CLIENT_ID") or current_app.config.get("PAYPAL_CLIENT_ID"))
            and _s(os.getenv("PAYPAL_CLIENT_SECRET") or current_app.config.get("PAYPAL_CLIENT_SECRET"))
        )
    return False


def _build_checkout_payload(retrieval_request, payment_transaction):
    provider = payment_transaction.get("provider") or "unknown"
    amount = payment_transaction.get("amount") or retrieval_request.get("final_price") or retrieval_request.get("quoted_price") or 10
    currency = payment_transaction.get("currency") or "GBP"
    device_name = ((retrieval_request.get("device") or {}).get("name")) or f"Retrieval {retrieval_request.get('id')}"

    success_query = urlencode(
        {
            "provider": provider,
            "amount": amount,
            "currency": currency,
            "device": device_name,
            "retrieval_request_id": retrieval_request.get("id"),
            "payment_kind": payment_transaction.get("payment_kind"),
            "reference": payment_transaction.get("checkout_reference"),
            "session_id": payment_transaction.get("checkout_reference"),
        }
    )
    cancel_query = urlencode(
        {
            "provider": provider,
            "amount": amount,
            "currency": currency,
            "device": device_name,
            "retrieval_request_id": retrieval_request.get("id"),
            "payment_kind": payment_transaction.get("payment_kind"),
            "reference": payment_transaction.get("checkout_reference"),
        }
    )

    provider_configured = _payment_provider_configured(provider)
    return {
        "provider": provider,
        "payment_kind": payment_transaction.get("payment_kind"),
        "transaction_id": payment_transaction.get("id"),
        "checkout_reference": payment_transaction.get("checkout_reference"),
        "amount": amount,
        "currency": currency,
        "integration_mode": "provider" if provider_configured else "stub",
        "provider_configured": provider_configured,
        "success_url": f"{_frontend_url()}/app/payment/success?{success_query}",
        "cancel_url": f"{_frontend_url()}/app/payment/cancel?{cancel_query}",
    }


def _authorized_retrieval_request(retrieval_request_id: int, *, allow_staff: bool = True):
    retrieval_request = get_data_retrieval_request(retrieval_request_id)
    if not retrieval_request:
        return None, (jsonify({"error": "retrieval request not found"}), 404)

    user_id = int(get_jwt_identity())
    role = _current_role()
    if retrieval_request.get("consumer_id") != user_id and not (allow_staff and _is_staff_role(role)):
        return None, (jsonify({"error": "forbidden"}), 403)

    return retrieval_request, None


def _parse_payment_request_payload(data, *, default_kind=INITIAL_RETRIEVAL_PAYMENT_KIND):
    provider = _sl(data.get("provider"))
    if provider not in SUPPORTED_PAYMENT_PROVIDERS:
        return None, (jsonify({"error": "invalid provider", "allowed": sorted(SUPPORTED_PAYMENT_PROVIDERS)}), 400)

    payment_kind = _sl(data.get("payment_kind")) or default_kind
    if payment_kind not in SUPPORTED_PAYMENT_KINDS:
        return None, (jsonify({"error": "invalid payment_kind", "allowed": sorted(SUPPORTED_PAYMENT_KINDS)}), 400)

    amount = data.get("amount")
    if amount not in (None, ""):
        try:
            amount = int(amount)
        except Exception:
            return None, (jsonify({"error": "invalid amount"}), 400)
        if amount < 0:
            return None, (jsonify({"error": "invalid amount"}), 400)
    else:
        amount = None

    currency = _s(data.get("currency")) or "GBP"
    return {
        "provider": provider,
        "payment_kind": payment_kind,
        "amount": amount,
        "currency": currency,
    }, None


@vault_bp.get("/mine")
@jwt_required()
def list_my_vault_archives():
    user_id = int(get_jwt_identity())
    archives = []
    run_retrieval_lifecycle_maintenance()
    for archive in list_user_data_retrieval_requests(user_id):
        archive_payload = dict(archive)
        download = None
        if archive_payload.get("download_ready"):
            download = get_or_create_data_retrieval_download(archive_payload["id"])
        archive_payload["download"] = _serialize_download(download) if download else None
        archives.append(archive_payload)

    return jsonify({"archives": archives})


@retrieval_requests_bp.get("/mine")
@jwt_required()
def list_my_retrieval_requests():
    user_id = int(get_jwt_identity())
    run_retrieval_lifecycle_maintenance()
    items = [_serialize_retrieval_request(item) for item in list_user_data_retrieval_requests(user_id)]
    return jsonify({"retrieval_requests": items})


@retrieval_requests_bp.get("/<int:retrieval_request_id>")
@jwt_required()
def get_retrieval_request_detail(retrieval_request_id: int):
    retrieval_request, error_response = _authorized_retrieval_request(retrieval_request_id)
    if error_response:
        return error_response
    return jsonify({"retrieval_request": _serialize_retrieval_request(retrieval_request)})


@retrieval_requests_bp.post("")
@jwt_required()
def create_retrieval_request():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    device_id = data.get("device_id")
    if device_id in (None, ""):
        return jsonify({"error": "device_id is required"}), 400

    try:
        device_id = int(device_id)
    except Exception:
        return jsonify({"error": "invalid device_id"}), 400

    note = data.get("note")
    if note is not None and not isinstance(note, str):
        return jsonify({"error": "invalid note", "expected": "string"}), 400
    note = _s(note) or None

    device = bridge_get_device(device_id)
    if not device:
        return jsonify({"error": "device not found"}), 404

    if device.get("owner_id") != user_id:
        return jsonify({"error": "forbidden"}), 403

    classification = _sl(device.get("classification"))
    final_price = 10 if classification == "recycle" else None
    retrieval_request = create_data_retrieval_request(
        device_id=device_id,
        consumer_id=user_id,
        status="pending",
        quoted_price=10,
        final_price=final_price,
        note=note,
        retrieval_status="pending",
        payment_status="unpaid",
    )

    return jsonify({"message": "created", "retrieval_request": _serialize_retrieval_request(retrieval_request)}), 201


@retrieval_requests_bp.post("/<int:retrieval_request_id>/checkout")
@jwt_required()
def initiate_checkout(retrieval_request_id: int):
    retrieval_request, error_response = _authorized_retrieval_request(retrieval_request_id)
    if error_response:
        return error_response

    payload, payload_error = _parse_payment_request_payload(request.get_json(silent=True) or {})
    if payload_error:
        return payload_error

    try:
        result = initiate_retrieval_payment(retrieval_request_id, **payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 409

    if result is None:
        return jsonify({"error": "retrieval request not found"}), 404

    updated_request = _serialize_retrieval_request(result["retrieval_request"])
    payment_transaction = result["payment_transaction"]
    return jsonify(
        {
            "message": "checkout initiated",
            "retrieval_request": updated_request,
            "payment_transaction": payment_transaction,
            "checkout": _build_checkout_payload(updated_request, payment_transaction),
        }
    )


@retrieval_requests_bp.post("/<int:retrieval_request_id>/extension-checkout")
@jwt_required()
def initiate_extension_checkout(retrieval_request_id: int):
    retrieval_request, error_response = _authorized_retrieval_request(retrieval_request_id)
    if error_response:
        return error_response

    data = request.get_json(silent=True) or {}
    data["payment_kind"] = EXTENSION_PAYMENT_KIND
    payload, payload_error = _parse_payment_request_payload(data, default_kind=EXTENSION_PAYMENT_KIND)
    if payload_error:
        return payload_error

    try:
        result = initiate_retrieval_payment(retrieval_request_id, **payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 409

    if result is None:
        return jsonify({"error": "retrieval request not found"}), 404

    updated_request = _serialize_retrieval_request(result["retrieval_request"])
    payment_transaction = result["payment_transaction"]
    return jsonify(
        {
            "message": "extension checkout initiated",
            "retrieval_request": updated_request,
            "payment_transaction": payment_transaction,
            "checkout": _build_checkout_payload(updated_request, payment_transaction),
        }
    )


@retrieval_requests_bp.post("/<int:retrieval_request_id>/payment-status")
@jwt_required()
def update_payment_status(retrieval_request_id: int):
    retrieval_request, error_response = _authorized_retrieval_request(retrieval_request_id)
    if error_response:
        return error_response

    data = request.get_json(silent=True) or {}
    status = _sl(data.get("status"))
    if status not in {"initiated", "pending", "paid", "failed", "cancelled", "refunded"}:
        return jsonify(
            {
                "error": "invalid status",
                "allowed": ["cancelled", "failed", "initiated", "paid", "pending", "refunded"],
            }
        ), 400

    payment_kind = _sl(data.get("payment_kind")) or INITIAL_RETRIEVAL_PAYMENT_KIND
    if payment_kind not in SUPPORTED_PAYMENT_KINDS:
        return jsonify({"error": "invalid payment_kind", "allowed": sorted(SUPPORTED_PAYMENT_KINDS)}), 400

    transaction_id = data.get("transaction_id")
    if transaction_id not in (None, ""):
        try:
            transaction_id = int(transaction_id)
        except Exception:
            return jsonify({"error": "invalid transaction_id"}), 400
    else:
        transaction_id = None

    provider = _sl(data.get("provider")) or None
    if provider is not None and provider not in SUPPORTED_PAYMENT_PROVIDERS:
        return jsonify({"error": "invalid provider", "allowed": sorted(SUPPORTED_PAYMENT_PROVIDERS)}), 400

    amount = data.get("amount")
    if amount not in (None, ""):
        try:
            amount = int(amount)
        except Exception:
            return jsonify({"error": "invalid amount"}), 400
    else:
        amount = None

    try:
        result = update_retrieval_payment_transaction(
            retrieval_request_id,
            provider=provider,
            payment_kind=payment_kind,
            status=status,
            transaction_id=transaction_id,
            checkout_reference=_s(data.get("checkout_reference")) or None,
            provider_payment_id=_s(data.get("provider_payment_id")) or None,
            amount=amount,
            currency=_s(data.get("currency")) or None,
            error_code=_s(data.get("error_code")) or None,
            error_message=_s(data.get("error_message")) or None,
            occurred_at=data.get("occurred_at"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 409

    if result is None:
        return jsonify({"error": "retrieval request not found"}), 404

    return jsonify(
        {
            "message": "payment status updated",
            "retrieval_request": _serialize_retrieval_request(result["retrieval_request"]),
            "payment_transaction": result["payment_transaction"],
        }
    )


@retrieval_requests_bp.patch("/<int:retrieval_request_id>/status")
@require_roles("staff", "admin")
def update_retrieval_status(retrieval_request_id: int):
    data = request.get_json(silent=True) or {}
    retrieval_status = _sl(data.get("retrieval_status")) or None
    status = _sl(data.get("status")) or None
    note = data.get("note", None)
    assigned_staff_id = data.get("assigned_staff_id", get_jwt_identity())

    if note is not None and not isinstance(note, str):
        return jsonify({"error": "invalid note", "expected": "string"}), 400

    if assigned_staff_id not in (None, ""):
        try:
            assigned_staff_id = int(assigned_staff_id)
        except Exception:
            return jsonify({"error": "invalid assigned_staff_id"}), 400
    else:
        assigned_staff_id = None

    retrieval_request = update_data_retrieval_request_state(
        retrieval_request_id,
        status=status,
        retrieval_status=retrieval_status,
        assigned_staff_id=assigned_staff_id,
        note=_s(note) or None if note is not None else note,
    )
    if not retrieval_request:
        return jsonify({"error": "retrieval request not found"}), 404

    return jsonify({"message": "updated", "retrieval_request": _serialize_retrieval_request(retrieval_request)})


@retrieval_requests_bp.post("/<int:retrieval_request_id>/issue-download-link")
@require_roles("staff", "admin")
def issue_download_link(retrieval_request_id: int):
    retrieval_request = get_data_retrieval_request(retrieval_request_id)
    if not retrieval_request:
        return jsonify({"error": "retrieval request not found"}), 404

    download = issue_data_retrieval_download(retrieval_request_id, issued_by=int(get_jwt_identity()))
    if not download:
        return jsonify({"error": "retrieval request is not ready for download"}), 409

    return jsonify({"message": "issued", "download": _serialize_download(download)}), 201


@retrieval_download_bp.get("/<string:token>")
@jwt_required()
def access_retrieval_download(token: str):
    result = access_data_retrieval_download(token, int(get_jwt_identity()))
    error = result.get("error")
    if error == "not_found":
        return jsonify({"error": "download not found"}), 404
    if error == "forbidden":
        return jsonify({"error": "forbidden"}), 403
    if error == "expired":
        return jsonify({"error": "download link has expired"}), 410
    if error == "consumed":
        return jsonify({"error": "download link has already been used"}), 410
    if error == "revoked":
        return jsonify({"error": "download link has been revoked"}), 410
    if error in {"deleted", "unavailable"}:
        return jsonify({"error": "download unavailable"}), 410

    download = result["download"]
    retrieval_request = download.get("retrieval_request") or {}
    return jsonify(
        {
            "download": {
                "retrieval_request_id": download.get("retrieval_request_id"),
                "status": retrieval_request.get("status"),
                "retrieval_status": retrieval_request.get("retrieval_status"),
                "device_id": retrieval_request.get("device_id"),
                "owner_id": retrieval_request.get("consumer_id"),
                "quoted_price": retrieval_request.get("quoted_price"),
                "final_price": retrieval_request.get("final_price"),
                "payment_status": retrieval_request.get("payment_status"),
                "payment_reference": retrieval_request.get("payment_reference"),
                "storage_expires_at": retrieval_request.get("storage_expires_at"),
                "extended_until": retrieval_request.get("extended_until"),
                "note": retrieval_request.get("note"),
                "issued_at": download.get("issued_at"),
                "expires_at": download.get("expires_at"),
                "content": {
                    "kind": "retrieved-data-package",
                    "message": "Secure retrieval content is ready.",
                },
            }
        }
    )
