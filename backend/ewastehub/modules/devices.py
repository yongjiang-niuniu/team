from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from DBupdate.db_bridge import (
    create_wipe_certificate,
    create_wipe_job,
    create_device as bridge_create_device,
    delete_device as bridge_delete_device,
    get_device as bridge_get_device,
    get_user_by_id,
    get_user_by_email,
    get_wipe_job,
    list_all_devices as bridge_list_all_devices,
    list_user_submitted_devices,
    list_wipe_certificates,
    list_wipe_jobs,
    list_user_devices,
    patch_device,
    update_wipe_job,
    update_device_classification,
    update_device_status,
    update_device_draft,
    update_device_visibility,
    update_device_owner_contact,
)
from ..permissions import require_roles

devices_bp = Blueprint("devices", __name__, url_prefix="/api/devices")


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


ALLOWED_TYPES = {"phone", "laptop", "tablet", "console", "other"}
ALLOWED_CONDITIONS = {"working", "broken", "unknown"}
ALLOWED_DEMAND = {"high", "medium", "low", "unknown"}
ALLOWED_CLASSIFICATION = {"current", "recycle", "rare", "unwanted", "unknown"}
ALLOWED_WORKFLOW = {"pending", "processing", "done", "rejected"}
ALLOWED_PROCESSING_STATUS = ALLOWED_WORKFLOW
ALLOWED_WIPE_STATUS = {"queued", "in_progress", "completed", "failed", "cancelled"}
ALLOWED_WIPE_TYPES = {"standard", "secure_erase", "factory_reset", "manual"}
ALLOWED_WIPE_VERIFICATION_STATUS = {"pending", "verified", "unverified", "failed"}


def _parse_age_years(value):
    if value is None or value == "":
        return None, True
    try:
        age_years = int(value)
        if age_years < 0 or age_years > 100:
            return None, False
        return age_years, True
    except Exception:
        return None, False


def _parse_bool_query(value):
    if value is None or value == "":
        return None, True
    normalized = _sl(value)
    if normalized == "true":
        return True, True
    if normalized == "false":
        return False, True
    return None, False


def _parse_non_negative_int_query(value, *, default=0):
    if value is None or value == "":
        return default, True
    try:
        parsed = int(value)
        if parsed < 0:
            return None, False
        return parsed, True
    except Exception:
        return None, False


def _current_role() -> str:
    return _sl(get_jwt().get("role"))


def _resolve_owner_for_staff_payload(current_user_id: int, role: str, data: dict):
    owner_id = data.get("owner_id")
    owner_email = _s(data.get("owner_email")) or None

    if role not in {"staff", "admin"}:
        return get_user_by_id(current_user_id), None

    target_user = None
    if owner_id not in (None, ""):
        try:
            owner_id = int(owner_id)
        except Exception:
            return None, "invalid owner_id"
        target_user = get_user_by_id(owner_id)
        if not target_user:
            return None, "owner not found"

    if owner_email:
        email_user = get_user_by_email(owner_email)
        if not email_user:
            return None, "owner not found"
        if target_user and email_user.id != target_user.id:
            return None, "owner_id and owner_email do not match"
        target_user = email_user

    return target_user or get_user_by_id(current_user_id), None
@devices_bp.post("")
@jwt_required()
def create_device():
    user_id = int(get_jwt_identity())
    role = _current_role()
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json(silent=True) or {}
    owner, owner_error = _resolve_owner_for_staff_payload(user_id, role, data)
    if owner_error:
        status_code = 400 if owner_error.startswith("invalid") or "do not match" in owner_error else 404
        return jsonify({"error": owner_error}), status_code
    if not owner:
        return jsonify({"error": "owner not found"}), 404

    name = _s(data.get("name") or data.get("item_name"))
    device_type = _sl(data.get("device_type") or data.get("category"))
    condition = _sl(data.get("condition"))
    demand = _sl(data.get("demand")) or None
    age_years = data.get("age_years", None)

    if not name or not device_type or not condition:
        return jsonify({
            "error": "missing fields",
            "required": ["name", "device_type", "condition"]
        }), 400

    if device_type not in ALLOWED_TYPES:
        return jsonify({"error": "invalid device_type", "allowed": sorted(list(ALLOWED_TYPES))}), 400

    if condition not in ALLOWED_CONDITIONS:
        return jsonify({"error": "invalid condition", "allowed": sorted(list(ALLOWED_CONDITIONS))}), 400

    if age_years is not None:
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
    is_visible = True
    is_draft = False
    owner_contacted = False
    notes = _s(data.get("notes")) or None

    if role in {"staff", "admin"}:
        if "classification" in data:
            classification = _sl(data.get("classification"))
            if classification not in ALLOWED_CLASSIFICATION:
                return jsonify({"error": "invalid classification", "allowed": sorted(list(ALLOWED_CLASSIFICATION))}), 400

        if "workflow_status" in data or "processing_status" in data:
            workflow_status = _sl(data.get("workflow_status") or data.get("processing_status"))
            if workflow_status not in ALLOWED_WORKFLOW:
                return jsonify({"error": "invalid workflow_status", "allowed": sorted(list(ALLOWED_WORKFLOW))}), 400

        if "is_visible" in data:
            if not isinstance(data.get("is_visible"), bool):
                return jsonify({"error": "invalid is_visible", "expected": "boolean"}), 400
            is_visible = data.get("is_visible")

        if "is_draft" in data:
            if not isinstance(data.get("is_draft"), bool):
                return jsonify({"error": "invalid is_draft", "expected": "boolean"}), 400
            is_draft = data.get("is_draft")

        if "owner_contacted" in data:
            if not isinstance(data.get("owner_contacted"), bool):
                return jsonify({"error": "invalid owner_contacted", "expected": "boolean"}), 400
            owner_contacted = data.get("owner_contacted")

    device = bridge_create_device(
        owner_id=owner.id,
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
        owner_contacted_at=datetime.utcnow() if owner_contacted else None,
        notes=notes,
        brand=None,
        model=None,
    )

    return jsonify({"message": "created", "device": device}), 201


@devices_bp.get("/mine")
@jwt_required()
def list_my_devices():
    user_id = int(get_jwt_identity())
    items = list_user_devices(user_id)
    return jsonify({"devices": items})


@devices_bp.get("/mine/submitted")
@jwt_required()
def list_my_submitted_devices():
    user_id = int(get_jwt_identity())
    items = list_user_submitted_devices(user_id)
    return jsonify({"devices": items})


@devices_bp.get("/<int:device_id>")
@jwt_required()
def get_device(device_id: int):
    user_id = int(get_jwt_identity())
    device = bridge_get_device(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    if device["owner_id"] != user_id:
        role = _sl(get_jwt().get("role"))
        if role not in {"staff", "admin"}:
            return jsonify({"error": "forbidden"}), 403

    return jsonify({"device": device})


@devices_bp.get("")
@require_roles("staff", "admin")
def list_all_devices():
    status = _sl(request.args.get("status"))
    classification = _sl(request.args.get("classification"))
    device_type = _sl(request.args.get("device_type"))

    items = bridge_list_all_devices(
        workflow_status=status or None,
        classification=classification or None,
        device_type=device_type or None,
    )
    return jsonify({"devices": items})


@devices_bp.get("/statistics")
@require_roles("staff", "admin")
def device_statistics():
    if request.args:
        return jsonify({"error": "query params are not supported"}), 400

    items = bridge_list_all_devices()

    processing_counts = {status: 0 for status in sorted(ALLOWED_PROCESSING_STATUS)}
    workflow_counts = {status: 0 for status in sorted(ALLOWED_WORKFLOW)}
    classification_counts = {classification: 0 for classification in sorted(ALLOWED_CLASSIFICATION)}

    totals = {
        "devices": len(items),
        "visible": 0,
        "hidden": 0,
        "draft": 0,
        "non_draft": 0,
    }

    for item in items:
        workflow_status = _sl(item.get("workflow_status"))
        processing_status = _sl(item.get("processing_status")) or workflow_status
        classification = _sl(item.get("classification"))

        if processing_status in processing_counts:
            processing_counts[processing_status] += 1
        if workflow_status in workflow_counts:
            workflow_counts[workflow_status] += 1
        if classification in classification_counts:
            classification_counts[classification] += 1

        if item.get("is_visible"):
            totals["visible"] += 1
        else:
            totals["hidden"] += 1

        if item.get("is_draft"):
            totals["draft"] += 1
        else:
            totals["non_draft"] += 1

    return jsonify(
        {
            "totals": totals,
            "processing_status": processing_counts,
            "workflow_status": workflow_counts,
            "classification": classification_counts,
        }
    )


@devices_bp.get("/unknown-queue")
@require_roles("staff", "admin")
def list_unknown_queue():
    limit, limit_ok = _parse_non_negative_int_query(request.args.get("limit"), default=None)
    if not limit_ok:
        return jsonify({"error": "invalid limit"}), 400

    offset, offset_ok = _parse_non_negative_int_query(request.args.get("offset"), default=0)
    if not offset_ok:
        return jsonify({"error": "invalid offset"}), 400

    is_visible, is_visible_ok = _parse_bool_query(request.args.get("is_visible"))
    if not is_visible_ok:
        return jsonify({"error": "invalid is_visible"}), 400

    is_draft, is_draft_ok = _parse_bool_query(request.args.get("is_draft"))
    if not is_draft_ok:
        return jsonify({"error": "invalid is_draft"}), 400

    items = bridge_list_all_devices(classification="unknown")

    if is_visible is not None:
        items = [item for item in items if item.get("is_visible") is is_visible]

    if is_draft is not None:
        items = [item for item in items if item.get("is_draft") is is_draft]

    if offset:
        items = items[offset:]

    if limit is not None:
        items = items[:limit]

    return jsonify({"devices": items})


@devices_bp.patch("/<int:device_id>/status")
@require_roles("staff", "admin")
def update_workflow_status(device_id: int):
    data = request.get_json(silent=True) or {}
    new_status = _sl(data.get("workflow_status"))

    if new_status not in ALLOWED_WORKFLOW:
        return jsonify({"error": "invalid workflow_status", "allowed": sorted(list(ALLOWED_WORKFLOW))}), 400

    device = update_device_status(device_id, new_status)
    if not device:
        return jsonify({"error": "not found"}), 404

    return jsonify({"message": "updated", "device": device})


@devices_bp.patch("/<int:device_id>/processing-status")
@require_roles("staff", "admin")
def update_processing_status(device_id: int):
    data = request.get_json(silent=True) or {}
    new_status = _sl(data.get("processing_status"))

    if new_status not in ALLOWED_PROCESSING_STATUS:
        return jsonify({
            "error": "invalid processing_status",
            "allowed": sorted(list(ALLOWED_PROCESSING_STATUS)),
        }), 400

    device = update_device_status(device_id, new_status)
    if not device:
        return jsonify({"error": "not found"}), 404

    return jsonify({"message": "updated", "device": device})


@devices_bp.patch("/<int:device_id>/classification")
@require_roles("staff", "admin")
def update_classification(device_id: int):
    data = request.get_json(silent=True) or {}
    new_cls = _sl(data.get("classification"))

    if new_cls not in ALLOWED_CLASSIFICATION:
        return jsonify({"error": "invalid classification", "allowed": sorted(list(ALLOWED_CLASSIFICATION))}), 400

    device = update_device_classification(device_id, new_cls)
    if not device:
        return jsonify({"error": "not found"}), 404

    return jsonify({"message": "updated", "device": device})


@devices_bp.patch("/<int:device_id>/visibility")
@require_roles("staff", "admin")
def update_visibility(device_id: int):
    data = request.get_json(silent=True) or {}

    if "is_visible" not in data or not isinstance(data.get("is_visible"), bool):
        return jsonify({"error": "invalid is_visible", "expected": "boolean"}), 400

    device = update_device_visibility(device_id, data["is_visible"])
    if not device:
        return jsonify({"error": "not found"}), 404

    return jsonify({"message": "updated", "device": device})


@devices_bp.patch("/<int:device_id>/draft")
@require_roles("staff", "admin")
def update_draft(device_id: int):
    data = request.get_json(silent=True) or {}

    if "is_draft" not in data or not isinstance(data.get("is_draft"), bool):
        return jsonify({"error": "invalid is_draft", "expected": "boolean"}), 400

    device = update_device_draft(device_id, data["is_draft"])
    if not device:
        return jsonify({"error": "not found"}), 404

    return jsonify({"message": "updated", "device": device})


@devices_bp.patch("/unknown-queue/<int:device_id>")
@require_roles("staff", "admin")
def resolve_unknown_queue_item(device_id: int):
    existing = bridge_get_device(device_id)
    if not existing:
        return jsonify({"error": "not found"}), 404
    if _sl(existing.get("classification")) != "unknown":
        return jsonify({"error": "device is not in unknown queue"}), 409

    data = request.get_json(silent=True) or {}
    classification = _sl(data.get("classification"))
    if classification not in ALLOWED_CLASSIFICATION or classification == "unknown":
        return jsonify(
            {"error": "invalid classification", "allowed": sorted([item for item in ALLOWED_CLASSIFICATION if item != "unknown"])}
        ), 400

    patch = {"classification": classification}

    if "workflow_status" in data or "processing_status" in data:
        workflow_status = _sl(data.get("workflow_status") or data.get("processing_status"))
        if workflow_status not in ALLOWED_WORKFLOW:
            return jsonify({"error": "invalid workflow_status", "allowed": sorted(list(ALLOWED_WORKFLOW))}), 400
        patch["workflow_status"] = workflow_status

    if "is_visible" in data:
        if not isinstance(data.get("is_visible"), bool):
            return jsonify({"error": "invalid is_visible", "expected": "boolean"}), 400
        patch["is_visible"] = data.get("is_visible")

    if "is_draft" in data:
        if not isinstance(data.get("is_draft"), bool):
            return jsonify({"error": "invalid is_draft", "expected": "boolean"}), 400
        patch["is_draft"] = data.get("is_draft")

    if "notes" in data:
        patch["notes"] = _s(data.get("notes")) or None

    device = patch_device(device_id, patch)
    return jsonify({"message": "updated", "device": device})


@devices_bp.patch("/<int:device_id>/contact-owner")
@require_roles("staff", "admin")
def contact_owner(device_id: int):
    data = request.get_json(silent=True) or {}

    if "owner_contacted" not in data or not isinstance(data.get("owner_contacted"), bool):
        return jsonify({"error": "invalid owner_contacted", "expected": "boolean"}), 400

    contact_notes_supplied = "contact_notes" in data
    contact_notes = None
    if "contact_notes" in data:
        raw_contact_notes = data.get("contact_notes")
        if raw_contact_notes is not None and not isinstance(raw_contact_notes, str):
            return jsonify({"error": "invalid contact_notes", "expected": "string"}), 400
        contact_notes = _s(raw_contact_notes) or None

    if contact_notes_supplied:
        device = update_device_owner_contact(device_id, data["owner_contacted"], contact_notes)
    else:
        device = update_device_owner_contact(device_id, data["owner_contacted"])
    if not device:
        return jsonify({"error": "not found"}), 404

    return jsonify({"message": "updated", "device": device})


@devices_bp.patch("/<int:device_id>")
@require_roles("staff", "admin")
def staff_patch_device(device_id: int):
    existing = bridge_get_device(device_id)
    if not existing:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    patch = {}

    if "name" in data or "item_name" in data:
        name = _s(data.get("name") or data.get("item_name"))
        if not name:
            return jsonify({"error": "invalid name"}), 400
        patch["name"] = name

    if "device_type" in data or "category" in data:
        dt = _sl(data.get("device_type") or data.get("category"))
        if dt not in ALLOWED_TYPES:
            return jsonify({"error": "invalid device_type", "allowed": sorted(list(ALLOWED_TYPES))}), 400
        patch["device_type"] = dt

    if "condition" in data:
        c = _sl(data.get("condition"))
        if c not in ALLOWED_CONDITIONS:
            return jsonify({"error": "invalid condition", "allowed": sorted(list(ALLOWED_CONDITIONS))}), 400
        patch["condition"] = c

    age_years = existing.get("age_years")
    age_years_changed = False
    if "age_years" in data:
        parsed_age_years = _parse_age_years(data.get("age_years"))
        if parsed_age_years == (None, False):
            return jsonify({"error": "invalid age_years"}), 400
        age_years, _ = parsed_age_years
        patch["age_years"] = age_years
        age_years_changed = True

    demand = existing.get("demand")
    demand_changed = False
    if "demand" in data:
        d = _sl(data.get("demand"))
        if d == "":
            demand = None
            patch["demand"] = None
            demand_changed = True
        else:
            if d not in ALLOWED_DEMAND:
                return jsonify({"error": "invalid demand", "allowed": sorted(list(ALLOWED_DEMAND))}), 400
            demand = d
            patch["demand"] = d
            demand_changed = True

    if "workflow_status" in data or "processing_status" in data:
        new_status = _sl(data.get("workflow_status") or data.get("processing_status"))
        if new_status not in ALLOWED_WORKFLOW:
            return jsonify({"error": "invalid workflow_status", "allowed": sorted(list(ALLOWED_WORKFLOW))}), 400
        patch["workflow_status"] = new_status

    if "classification" in data:
        new_cls = _sl(data.get("classification"))
        if new_cls not in ALLOWED_CLASSIFICATION:
            return jsonify({"error": "invalid classification", "allowed": sorted(list(ALLOWED_CLASSIFICATION))}), 400
        patch["classification"] = new_cls
    elif age_years_changed or demand_changed:
        patch["classification"] = _auto_classify(age_years, demand)

    if "notes" in data:
        patch["notes"] = _s(data.get("notes")) or None

    if "is_visible" in data:
        if not isinstance(data.get("is_visible"), bool):
            return jsonify({"error": "invalid is_visible", "expected": "boolean"}), 400
        patch["is_visible"] = data.get("is_visible")

    if "is_draft" in data:
        if not isinstance(data.get("is_draft"), bool):
            return jsonify({"error": "invalid is_draft", "expected": "boolean"}), 400
        patch["is_draft"] = data.get("is_draft")

    if "owner_contacted" in data:
        if not isinstance(data.get("owner_contacted"), bool):
            return jsonify({"error": "invalid owner_contacted", "expected": "boolean"}), 400
        patch["owner_contacted"] = data.get("owner_contacted")
        patch["owner_contacted_at"] = datetime.utcnow() if data.get("owner_contacted") else None

    if "contact_notes" in data:
        raw_contact_notes = data.get("contact_notes")
        if raw_contact_notes is not None and not isinstance(raw_contact_notes, str):
            return jsonify({"error": "invalid contact_notes", "expected": "string"}), 400
        if "notes" not in patch:
            patch["notes"] = _s(raw_contact_notes) or None

    device = patch_device(device_id, patch)
    return jsonify({"message": "updated", "device": device})


@devices_bp.patch("/<int:device_id>/mine")
@jwt_required()
def owner_patch_device(device_id: int):
    user_id = int(get_jwt_identity())
    device = bridge_get_device(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    if device["owner_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    if (device.get("workflow_status") or "").lower() != "pending":
        return jsonify({"error": "locked", "message": "device can only be edited while pending"}), 409

    data = request.get_json(silent=True) or {}
    patch = {}

    if "name" in data:
        name = _s(data.get("name"))
        if not name:
            return jsonify({"error": "invalid name"}), 400
        patch["name"] = name

    if "device_type" in data:
        dt = _sl(data.get("device_type"))
        if dt not in ALLOWED_TYPES:
            return jsonify({"error": "invalid device_type", "allowed": sorted(list(ALLOWED_TYPES))}), 400
        patch["device_type"] = dt

    if "condition" in data:
        c = _sl(data.get("condition"))
        if c not in ALLOWED_CONDITIONS:
            return jsonify({"error": "invalid condition", "allowed": sorted(list(ALLOWED_CONDITIONS))}), 400
        patch["condition"] = c

    age_years = device.get("age_years")
    if "age_years" in data:
        ay = data.get("age_years")
        if ay is None or ay == "":
            age_years = None
            patch["age_years"] = None
        else:
            try:
                ay = int(ay)
                if ay < 0 or ay > 100:
                    return jsonify({"error": "invalid age_years"}), 400
                age_years = ay
                patch["age_years"] = ay
            except Exception:
                return jsonify({"error": "invalid age_years"}), 400

    demand = device.get("demand")
    if "demand" in data:
        d = _sl(data.get("demand"))
        if d == "":
            demand = None
            patch["demand"] = None
        else:
            if d not in ALLOWED_DEMAND:
                return jsonify({"error": "invalid demand", "allowed": sorted(list(ALLOWED_DEMAND))}), 400
            demand = d
            patch["demand"] = d

    patch["classification"] = _auto_classify(age_years, demand)

    device = patch_device(device_id, patch)
    return jsonify({"message": "updated", "device": device})


@devices_bp.delete("/<int:device_id>")
@jwt_required()
def owner_delete_device(device_id: int):
    user_id = int(get_jwt_identity())
    device = bridge_get_device(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    if device["owner_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    if (device.get("workflow_status") or "").lower() != "pending":
        return jsonify({"error": "locked", "message": "device can only be deleted while pending"}), 409

    bridge_delete_device(device_id)
    return jsonify({"message": "deleted", "device_id": device_id})


@devices_bp.get("/wipe-jobs")
@require_roles("staff", "admin")
def wipe_jobs_index():
    device_id = request.args.get("device_id")
    request_id = request.args.get("request_id")
    assigned_staff_id = request.args.get("assigned_staff_id")
    status = _sl(request.args.get("status")) or None
    verification_status = _sl(request.args.get("verification_status")) or None

    try:
        device_id = int(device_id) if device_id not in (None, "") else None
        request_id = int(request_id) if request_id not in (None, "") else None
        assigned_staff_id = int(assigned_staff_id) if assigned_staff_id not in (None, "") else None
    except Exception:
        return jsonify({"error": "invalid wipe job filter"}), 400

    if status and status not in ALLOWED_WIPE_STATUS:
        return jsonify({"error": "invalid status", "allowed": sorted(ALLOWED_WIPE_STATUS)}), 400
    if verification_status and verification_status not in ALLOWED_WIPE_VERIFICATION_STATUS:
        return jsonify(
            {"error": "invalid verification_status", "allowed": sorted(ALLOWED_WIPE_VERIFICATION_STATUS)}
        ), 400

    jobs = list_wipe_jobs(
        device_id=device_id,
        request_id=request_id,
        status=status,
        assigned_staff_id=assigned_staff_id,
        verification_status=verification_status,
    )
    return jsonify({"wipe_jobs": jobs})


@devices_bp.post("/<int:device_id>/wipe-jobs")
@require_roles("staff", "admin")
def create_device_wipe_job(device_id: int):
    data = request.get_json(silent=True) or {}
    if bridge_get_device(device_id) is None:
        return jsonify({"error": "device not found"}), 404

    wipe_type = _sl(data.get("wipe_type")) or "standard"
    if wipe_type not in ALLOWED_WIPE_TYPES:
        return jsonify({"error": "invalid wipe_type", "allowed": sorted(ALLOWED_WIPE_TYPES)}), 400

    status = _sl(data.get("status")) or "queued"
    if status not in ALLOWED_WIPE_STATUS:
        return jsonify({"error": "invalid status", "allowed": sorted(ALLOWED_WIPE_STATUS)}), 400

    verification_status = _sl(data.get("verification_status")) or "pending"
    if verification_status not in ALLOWED_WIPE_VERIFICATION_STATUS:
        return jsonify(
            {"error": "invalid verification_status", "allowed": sorted(ALLOWED_WIPE_VERIFICATION_STATUS)}
        ), 400

    request_id = data.get("request_id")
    if request_id not in (None, ""):
        try:
            request_id = int(request_id)
        except Exception:
            return jsonify({"error": "invalid request_id"}), 400
    else:
        request_id = None

    consumer_id = data.get("consumer_id")
    if consumer_id not in (None, ""):
        try:
            consumer_id = int(consumer_id)
        except Exception:
            return jsonify({"error": "invalid consumer_id"}), 400
    else:
        consumer_id = None

    assigned_staff_id = data.get("assigned_staff_id")
    if assigned_staff_id not in (None, ""):
        try:
            assigned_staff_id = int(assigned_staff_id)
        except Exception:
            return jsonify({"error": "invalid assigned_staff_id"}), 400
    else:
        assigned_staff_id = int(get_jwt_identity())

    try:
        wipe_job = create_wipe_job(
            device_id=device_id,
            request_id=request_id,
            consumer_id=consumer_id,
            assigned_staff_id=assigned_staff_id,
            wipe_type=wipe_type,
            status=status,
            verification_status=verification_status,
            notes=_s(data.get("notes")) or None,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if wipe_job is None:
        return jsonify({"error": "device not found"}), 404
    return jsonify({"message": "created", "wipe_job": wipe_job}), 201


@devices_bp.get("/wipe-jobs/<int:wipe_job_id>")
@require_roles("staff", "admin")
def wipe_job_detail(wipe_job_id: int):
    wipe_job = get_wipe_job(wipe_job_id)
    if wipe_job is None:
        return jsonify({"error": "wipe job not found"}), 404
    return jsonify({"wipe_job": wipe_job})


@devices_bp.patch("/wipe-jobs/<int:wipe_job_id>")
@require_roles("staff", "admin")
def patch_wipe_job(wipe_job_id: int):
    data = request.get_json(silent=True) or {}
    patch = {}

    if "assigned_staff_id" in data:
        assigned_staff_id = data.get("assigned_staff_id")
        if assigned_staff_id in (None, ""):
            patch["assigned_staff_id"] = None
        else:
            try:
                patch["assigned_staff_id"] = int(assigned_staff_id)
            except Exception:
                return jsonify({"error": "invalid assigned_staff_id"}), 400

    if "request_id" in data:
        request_id = data.get("request_id")
        if request_id in (None, ""):
            patch["request_id"] = None
        else:
            try:
                patch["request_id"] = int(request_id)
            except Exception:
                return jsonify({"error": "invalid request_id"}), 400

    if "consumer_id" in data:
        consumer_id = data.get("consumer_id")
        if consumer_id in (None, ""):
            patch["consumer_id"] = None
        else:
            try:
                patch["consumer_id"] = int(consumer_id)
            except Exception:
                return jsonify({"error": "invalid consumer_id"}), 400

    if "wipe_type" in data:
        wipe_type = _sl(data.get("wipe_type"))
        if wipe_type not in ALLOWED_WIPE_TYPES:
            return jsonify({"error": "invalid wipe_type", "allowed": sorted(ALLOWED_WIPE_TYPES)}), 400
        patch["wipe_type"] = wipe_type

    if "status" in data:
        status = _sl(data.get("status"))
        if status not in ALLOWED_WIPE_STATUS:
            return jsonify({"error": "invalid status", "allowed": sorted(ALLOWED_WIPE_STATUS)}), 400
        patch["status"] = status

    if "verification_status" in data:
        verification_status = _sl(data.get("verification_status"))
        if verification_status not in ALLOWED_WIPE_VERIFICATION_STATUS:
            return jsonify(
                {"error": "invalid verification_status", "allowed": sorted(ALLOWED_WIPE_VERIFICATION_STATUS)}
            ), 400
        patch["verification_status"] = verification_status

    if "notes" in data:
        patch["notes"] = _s(data.get("notes")) or None

    wipe_job = update_wipe_job(wipe_job_id, patch)
    if wipe_job is None:
        return jsonify({"error": "wipe job not found"}), 404
    return jsonify({"message": "updated", "wipe_job": wipe_job})


@devices_bp.get("/wipe-jobs/<int:wipe_job_id>/certificates")
@require_roles("staff", "admin")
def wipe_job_certificates(wipe_job_id: int):
    wipe_job = get_wipe_job(wipe_job_id)
    if wipe_job is None:
        return jsonify({"error": "wipe job not found"}), 404
    return jsonify({"wipe_certificates": list_wipe_certificates(wipe_job_id)})


@devices_bp.post("/wipe-jobs/<int:wipe_job_id>/certificates")
@require_roles("staff", "admin")
def create_wipe_job_certificate(wipe_job_id: int):
    data = request.get_json(silent=True) or {}
    certificate = create_wipe_certificate(
        wipe_job_id=wipe_job_id,
        certificate_reference=_s(data.get("certificate_reference")) or None,
        certificate_url=_s(data.get("certificate_url")) or None,
        storage_key=_s(data.get("storage_key")) or None,
        issued_at=data.get("issued_at"),
        expires_at=data.get("expires_at"),
    )
    if certificate is None:
        return jsonify({"error": "wipe job not found"}), 404
    return jsonify({"message": "created", "wipe_certificate": certificate}), 201
