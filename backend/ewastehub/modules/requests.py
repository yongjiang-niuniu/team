from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from DBupdate.db_bridge import (
    create_collection_request,
    create_data_retrieval_request,
    create_device,
    get_user_by_email,
    get_user_by_id,
    get_collection_request,
    list_all_collection_requests,
    list_user_collection_requests,
    update_collection_request_status,
)
from ..extensions import db
from ..models import User
from ..permissions import require_roles

requests_bp = Blueprint("requests", __name__, url_prefix="/api/requests")

ALLOWED_TYPES = {"phone", "laptop", "tablet", "console", "other"}
ALLOWED_CONDITIONS = {"working", "broken", "unknown"}
ALLOWED_DEMAND = {"high", "medium", "low", "unknown"}
ALLOWED_METHODS = {"dropoff", "pickup"}


def _s(v) -> str:
    return (v or "").strip()


def _sl(v) -> str:
    return (v or "").strip().lower()


def _auto_classify(age_years: int | None, demand: str | None) -> str:
    d = (demand or "unknown").strip().lower()
    if age_years is not None:
        if age_years <= 2 and d in {"high", "medium"}:
            return "current"
        if age_years >= 8:
            return "recycle"
        if 3 <= age_years <= 7 and d == "high":
            return "rare"
    return "unknown"


def _current_role() -> str:
    return _sl(get_jwt().get("role"))


def _resolve_owner_for_request(current_user_id: int, role: str, data: dict):
    owner_id = data.get("owner_id")
    owner_email = _s(data.get("owner_email")) or None

    if role not in {"staff", "admin"}:
        return db.session.get(User, current_user_id), None

    target_user = None
    if owner_id not in (None, ""):
        try:
            owner_id = int(owner_id)
        except Exception:
            return None, "invalid owner_id"
        target_user = get_user_by_id(owner_id)
        if target_user is None:
            return None, "owner not found"

    if owner_email:
        email_user = get_user_by_email(owner_email)
        if email_user is None:
            return None, "owner not found"
        if target_user and email_user.id != target_user.id:
            return None, "owner_id and owner_email do not match"
        target_user = email_user

    return target_user or db.session.get(User, current_user_id), None


@requests_bp.post("")
@jwt_required()
def create_request():
    user_id = int(get_jwt_identity())
    role = _current_role()
    actor = db.session.get(User, user_id)
    if not actor:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json(silent=True) or {}
    owner, owner_error = _resolve_owner_for_request(user_id, role, data)
    if owner_error:
        status_code = 400 if owner_error.startswith("invalid") or "do not match" in owner_error else 404
        return jsonify({"error": owner_error}), status_code
    if owner is None:
        return jsonify({"error": "owner not found"}), 404

    item_name = _s(data.get("item_name"))
    category = _sl(data.get("category"))
    condition = _sl(data.get("condition"))
    preferred_method = _sl(data.get("preferred_method"))
    pickup_address = _s(data.get("pickup_address")) or None
    contact_phone = _s(data.get("contact_phone")) or None
    scheduled_time = data.get("scheduled_time")
    demand = _sl(data.get("demand")) or None
    age_years = data.get("age_years")

    if not item_name or not category or not condition or not preferred_method:
        return jsonify({
            "error": "missing fields",
            "required": ["item_name", "category", "condition", "preferred_method"]
        }), 400

    if category not in ALLOWED_TYPES:
        return jsonify({"error": "invalid category", "allowed": sorted(list(ALLOWED_TYPES))}), 400

    if condition not in ALLOWED_CONDITIONS:
        return jsonify({"error": "invalid condition", "allowed": sorted(list(ALLOWED_CONDITIONS))}), 400

    if preferred_method not in ALLOWED_METHODS:
        return jsonify({"error": "invalid preferred_method", "allowed": sorted(list(ALLOWED_METHODS))}), 400

    if age_years in (None, ""):
        age_years = None
    else:
        try:
            age_years = int(age_years)
            if age_years < 0 or age_years > 100:
                return jsonify({"error": "invalid age_years"}), 400
        except Exception:
            return jsonify({"error": "invalid age_years"}), 400

    if demand is not None and demand not in ALLOWED_DEMAND:
        return jsonify({"error": "invalid demand", "allowed": sorted(list(ALLOWED_DEMAND))}), 400

    classification = _auto_classify(age_years, demand)
    workflow_status = "pending"
    if role in {"staff", "admin"} and ("workflow_status" in data or "processing_status" in data):
        workflow_status = _sl(data.get("workflow_status") or data.get("processing_status"))
        if workflow_status not in {"pending", "processing", "done", "rejected"}:
            return jsonify({"error": "invalid workflow_status"}), 400

    device = create_device(
        owner_id=owner.id,
        name=item_name,
        device_type=category,
        condition=condition,
        age_years=age_years,
        demand=demand,
        classification=classification,
        workflow_status=workflow_status,
        notes=_s(data.get("notes")) or None,
        brand=None,
        model=None,
    )

    request_status = "submitted"
    if role in {"staff", "admin"} and "status" in data:
        request_status = _sl(data.get("status"))
        allowed_statuses = {"submitted", "approved", "rejected", "completed"}
        if request_status not in allowed_statuses:
            return jsonify({"error": "invalid status", "allowed": sorted(allowed_statuses)}), 400

    assigned_staff_id = None
    if role in {"staff", "admin"}:
        assigned_staff_id = user_id

    if "assigned_staff_id" in data and role in {"staff", "admin"}:
        if data.get("assigned_staff_id") in (None, ""):
            assigned_staff_id = None
        else:
            try:
                assigned_staff_id = int(data.get("assigned_staff_id"))
            except Exception:
                return jsonify({"error": "invalid assigned_staff_id"}), 400

    cr = create_collection_request(
        consumer_id=owner.id,
        device_id=device["id"],
        item_name=item_name,
        category=category,
        condition=condition,
        preferred_method=preferred_method,
        pickup_address=pickup_address,
        contact_phone=contact_phone,
        scheduled_time=scheduled_time,
        status=request_status,
        assigned_staff_id=assigned_staff_id,
        staff_note=_s(data.get("staff_note")) or None,
    )

    request_details = get_collection_request(cr["id"])
    paid_retrieval = bool(data.get("paid_retrieval"))
    if paid_retrieval:
        create_data_retrieval_request(
            device_id=device["id"],
            consumer_id=owner.id,
            status="pending",
            quoted_price=10,
            final_price=10 if classification == "recycle" else None,
            retrieval_status="pending",
            payment_status="unpaid",
            note="Created from user request submission.",
        )
    return jsonify({"message": "created", "request": request_details or cr}), 201


@requests_bp.get("/mine")
@jwt_required()
def list_my_requests():
    user_id = int(get_jwt_identity())
    items = list_user_collection_requests(user_id)
    return jsonify({"requests": items})


@requests_bp.get("")
@require_roles("staff", "admin")
def list_all_requests():
    status = (request.args.get("status") or "").strip()
    items = list_all_collection_requests(status or None)
    return jsonify({"requests": items})

@requests_bp.get("/<int:req_id>")
@jwt_required()
def get_request(req_id: int):
    user_id = int(get_jwt_identity())
    cr = get_collection_request(req_id)
    if not cr:
        return jsonify({"error": "not found"}), 404

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    if cr["consumer_id"] != user_id and user.role not in ("staff", "admin"):
        return jsonify({"error": "forbidden"}), 403

    return jsonify({"request": cr})


@requests_bp.get("/unknown-queue")
@require_roles("staff", "admin")
def list_unknown_requests():
    items = [
        item
        for item in list_all_collection_requests()
        if _sl((item.get("device") or {}).get("classification")) == "unknown"
    ]
    return jsonify({"requests": items})

@requests_bp.patch("/<int:req_id>/status")
@require_roles("staff", "admin")
def update_status(req_id: int):
    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip()

    allowed = {"submitted", "approved", "rejected", "completed"}
    if new_status not in allowed:
        return jsonify({"error": "invalid status", "allowed": sorted(list(allowed))}), 400

    user_id = int(get_jwt_identity())
    cr = update_collection_request_status(
        req_id=req_id,
        new_status=new_status,
        changed_by=user_id,
        note=data.get("note"),
    )
    if not cr:
        return jsonify({"error": "not found"}), 404

    return jsonify({"message": "updated", "request": cr})
