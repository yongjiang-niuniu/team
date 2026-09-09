from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from DBupdate.db_bridge import (
    create_referral_fee,
    get_device as bridge_get_device,
    get_partner_option,
    get_referral_code,
    get_referral_code_by_code,
    issue_referral_code,
    list_partner_options,
    list_referral_activity,
    list_referral_fees,
    list_user_collection_requests,
    list_user_reward_vouchers,
    record_referral_activity,
    update_referral_fee,
)
from ..permissions import require_roles

rewards_bp = Blueprint("rewards", __name__, url_prefix="/api/rewards")
SUPPORTED_CLASSIFICATIONS = {"current", "rare"}
STAFF_EVENT_TYPES = {"handin_confirmed", "resale_confirmed", "fee_recorded"}


def _s(value) -> str:
    return (value or "").strip()


def _sl(value) -> str:
    return _s(value).lower()


def _current_role() -> str:
    return _sl(get_jwt().get("role"))


def _is_staff() -> bool:
    return _current_role() in {"staff", "admin"}


def _authorize_referral_payload(device_id: int | None, request_id: int | None):
    user_id = int(get_jwt_identity())
    if request_id not in (None, ""):
        try:
            request_id = int(request_id)
        except Exception:
            return None, None, (jsonify({"error": "invalid request_id"}), 400)

        owned_request = next(
            (item for item in list_user_collection_requests(user_id) if item.get("id") == request_id),
            None,
        )
        if not owned_request and not _is_staff():
            return None, None, (jsonify({"error": "forbidden"}), 403)
        if owned_request:
            request_device_id = (owned_request.get("device") or {}).get("id") or owned_request.get("device_id")
            if device_id in (None, ""):
                device_id = request_device_id
            elif request_device_id is not None and int(device_id) != request_device_id:
                return None, None, (jsonify({"error": "device_id does not match request"}), 400)

    if device_id in (None, ""):
        return None, None, (jsonify({"error": "device_id is required"}), 400)

    try:
        device_id = int(device_id)
    except Exception:
        return None, None, (jsonify({"error": "invalid device_id"}), 400)

    device = bridge_get_device(device_id)
    if not device:
        return None, None, (jsonify({"error": "device not found"}), 404)

    if device.get("owner_id") != user_id and not _is_staff():
        return None, None, (jsonify({"error": "forbidden"}), 403)

    return device, request_id, None


def _ensure_user_rewards(user_id: int):
    for request_record in list_user_collection_requests(user_id):
        request_id = request_record.get("id")
        device = request_record.get("device") or {}
        classification = _sl(device.get("classification"))

        if classification not in SUPPORTED_CLASSIFICATIONS:
            continue

        try:
            issue_referral_code(
                consumer_id=user_id,
                device_id=device.get("id"),
                request_id=request_id,
            )
        except ValueError:
            continue

    return list_user_reward_vouchers(user_id)


@rewards_bp.get("/mine")
@jwt_required()
def list_my_rewards():
    user_id = int(get_jwt_identity())
    rewards = _ensure_user_rewards(user_id)
    return jsonify({"rewards": rewards})


@rewards_bp.get("/partners")
@jwt_required()
def partner_options():
    classification = _sl(request.args.get("classification")) or None
    if classification and classification not in SUPPORTED_CLASSIFICATIONS:
        return jsonify({"error": "invalid classification", "allowed": sorted(SUPPORTED_CLASSIFICATIONS)}), 400

    if request.args.get("device_id") or request.args.get("request_id"):
        device, _, error_response = _authorize_referral_payload(
            request.args.get("device_id"),
            request.args.get("request_id"),
        )
        if error_response:
            return error_response
        classification = _sl(device.get("classification"))

    partners = list_partner_options(classification=classification)
    return jsonify({"partners": partners, "classification": classification})


@rewards_bp.post("/referrals")
@jwt_required()
def create_referral():
    data = request.get_json(silent=True) or {}
    device, request_id, error_response = _authorize_referral_payload(data.get("device_id"), data.get("request_id"))
    if error_response:
        return error_response

    partner_id = data.get("partner_id")
    if partner_id not in (None, ""):
        try:
            partner_id = int(partner_id)
        except Exception:
            return jsonify({"error": "invalid partner_id"}), 400
        if get_partner_option(partner_id) is None:
            return jsonify({"error": "partner not found"}), 404
    else:
        partner_id = None

    try:
        referral_code = issue_referral_code(
            consumer_id=int(get_jwt_identity()),
            device_id=device.get("id"),
            request_id=request_id,
            partner_id=partner_id,
        )
    except ValueError as exc:
        message = str(exc)
        if "does not belong" in message:
            return jsonify({"error": "forbidden"}), 403
        return jsonify({"error": message}), 409

    return jsonify({"message": "issued", "referral": referral_code}), 201


@rewards_bp.get("/referrals/<int:referral_code_id>")
@jwt_required()
def get_referral_detail(referral_code_id: int):
    referral_code = get_referral_code(referral_code_id)
    if not referral_code:
        return jsonify({"error": "referral not found"}), 404
    if referral_code.get("consumer_id") != int(get_jwt_identity()) and not _is_staff():
        return jsonify({"error": "forbidden"}), 403
    return jsonify({"referral": referral_code})


@rewards_bp.get("/referrals/code/<string:code>")
@jwt_required()
def get_referral_by_code(code: str):
    referral_code = get_referral_code_by_code(code)
    if not referral_code:
        return jsonify({"error": "referral not found"}), 404
    if referral_code.get("consumer_id") != int(get_jwt_identity()) and not _is_staff():
        return jsonify({"error": "forbidden"}), 403
    return jsonify({"referral": referral_code})


@rewards_bp.post("/referrals/<int:referral_code_id>/open")
@jwt_required()
def record_referral_open(referral_code_id: int):
    data = request.get_json(silent=True) or {}
    metadata = {
        "source": _s(data.get("source")) or "owner_portal",
    }
    try:
        result = record_referral_activity(
            referral_code_id,
            event_type="opened",
            actor_consumer_id=int(get_jwt_identity()),
            event_reference=_s(data.get("event_reference")) or None,
            metadata=metadata,
        )
    except ValueError:
        return jsonify({"error": "forbidden"}), 403
    if result is None:
        return jsonify({"error": "referral not found"}), 404
    return jsonify({"message": "recorded", "referral": result["referral_code"], "activity": result["activity"]})


@rewards_bp.post("/referrals/<int:referral_code_id>/redeem")
@jwt_required()
def record_referral_redeem(referral_code_id: int):
    data = request.get_json(silent=True) or {}
    try:
        result = record_referral_activity(
            referral_code_id,
            event_type="redeemed",
            actor_consumer_id=int(get_jwt_identity()),
            event_reference=_s(data.get("event_reference")) or None,
            metadata={"redemption_channel": _s(data.get("channel")) or "partner"},
            notes=_s(data.get("notes")) or None,
        )
    except ValueError:
        return jsonify({"error": "forbidden"}), 403
    if result is None:
        return jsonify({"error": "referral not found"}), 404
    return jsonify({"message": "recorded", "referral": result["referral_code"], "activity": result["activity"]})


@rewards_bp.post("/referrals/<int:referral_code_id>/events")
@require_roles("staff", "admin")
def record_staff_referral_event(referral_code_id: int):
    data = request.get_json(silent=True) or {}
    event_type = _sl(data.get("event_type"))
    if event_type not in STAFF_EVENT_TYPES:
        return jsonify({"error": "invalid event_type", "allowed": sorted(STAFF_EVENT_TYPES)}), 400

    result = record_referral_activity(
        referral_code_id,
        event_type=event_type,
        event_reference=_s(data.get("event_reference")) or None,
        metadata={
            "recorded_by_role": _current_role(),
            "staff_user_id": int(get_jwt_identity()),
        },
        notes=_s(data.get("notes")) or None,
    )
    if result is None:
        return jsonify({"error": "referral not found"}), 404
    return jsonify({"message": "recorded", "referral": result["referral_code"], "activity": result["activity"]})


@rewards_bp.post("/referral-fees")
@require_roles("staff", "admin")
def create_fee():
    data = request.get_json(silent=True) or {}
    referral_code_id = data.get("referral_code_id")
    if referral_code_id in (None, ""):
        return jsonify({"error": "referral_code_id is required"}), 400
    try:
        referral_code_id = int(referral_code_id)
    except Exception:
        return jsonify({"error": "invalid referral_code_id"}), 400

    fee_amount = data.get("fee_amount")
    if fee_amount not in (None, ""):
        try:
            fee_amount = int(fee_amount)
        except Exception:
            return jsonify({"error": "invalid fee_amount"}), 400
    else:
        fee_amount = None

    referral_activity_id = data.get("referral_activity_id")
    if referral_activity_id not in (None, ""):
        try:
            referral_activity_id = int(referral_activity_id)
        except Exception:
            return jsonify({"error": "invalid referral_activity_id"}), 400
    else:
        referral_activity_id = None

    try:
        fee = create_referral_fee(
            referral_code_id=referral_code_id,
            status=_sl(data.get("status")) or "expected",
            fee_amount=fee_amount,
            currency=_s(data.get("currency")) or "GBP",
            fee_reference=_s(data.get("fee_reference")) or None,
            due_at=data.get("due_at"),
            referral_activity_id=referral_activity_id,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if fee is None:
        return jsonify({"error": "referral not found"}), 404
    return jsonify({"message": "created", "referral_fee": fee}), 201


@rewards_bp.patch("/referral-fees/<int:referral_fee_id>")
@require_roles("staff", "admin")
def patch_fee(referral_fee_id: int):
    data = request.get_json(silent=True) or {}

    fee_amount = data.get("fee_amount", None)
    if fee_amount not in (None, "",):
        try:
            fee_amount = int(fee_amount)
        except Exception:
            return jsonify({"error": "invalid fee_amount"}), 400
    elif "fee_amount" in data:
        fee_amount = None

    kwargs = {}
    if "status" in data:
        kwargs["status"] = _sl(data.get("status")) or None
    if "fee_amount" in data:
        kwargs["fee_amount"] = fee_amount
    if "currency" in data:
        kwargs["currency"] = _s(data.get("currency")) or None
    if "fee_reference" in data:
        kwargs["fee_reference"] = _s(data.get("fee_reference")) or None
    if "due_at" in data:
        kwargs["due_at"] = data.get("due_at")

    try:
        fee = update_referral_fee(referral_fee_id, **kwargs)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if fee is None:
        return jsonify({"error": "referral fee not found"}), 404
    return jsonify({"message": "updated", "referral_fee": fee})


@rewards_bp.get("/referral-fees")
@require_roles("staff", "admin")
def list_fees():
    status = _sl(request.args.get("status")) or None
    partner_id = request.args.get("partner_id")
    if partner_id not in (None, ""):
        try:
            partner_id = int(partner_id)
        except Exception:
            return jsonify({"error": "invalid partner_id"}), 400
    else:
        partner_id = None

    fees = list_referral_fees(status=status, partner_id=partner_id)
    return jsonify({"referral_fees": fees})


@rewards_bp.get("/referral-activity")
@require_roles("staff", "admin")
def list_activity():
    event_type = _sl(request.args.get("event_type")) or None
    referral_code_id = request.args.get("referral_code_id")
    if referral_code_id not in (None, ""):
        try:
            referral_code_id = int(referral_code_id)
        except Exception:
            return jsonify({"error": "invalid referral_code_id"}), 400
    else:
        referral_code_id = None

    activity = list_referral_activity(event_type=event_type, referral_code_id=referral_code_id)
    return jsonify({"referral_activity": activity})
