from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from ..extensions import db
from ..models import Device, User
from ..permissions import require_roles

devices_bp = Blueprint("devices", __name__, url_prefix="/api/devices")


# ---------- helpers ----------
def _s(v) -> str:
    return (v or "").strip()


def _sl(v) -> str:
    return (v or "").strip().lower()


def _auto_classify(age_years: int | None, demand: str | None) -> str:
    """
    Very simple MVP rules (can be refined later).
    """
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


# ---------- routes ----------
@devices_bp.post("")
@jwt_required()
def create_device():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json(silent=True) or {}
    name = _s(data.get("name"))
    device_type = _sl(data.get("device_type"))
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

    device = Device(
        owner_id=user_id,
        name=name,
        device_type=device_type,
        condition=condition,
        age_years=age_years,
        demand=demand,
        classification=classification,
        workflow_status="pending",
    )
    db.session.add(device)
    db.session.commit()

    return jsonify({"message": "created", "device": device.to_dict()}), 201


@devices_bp.get("/mine")
@jwt_required()
def list_my_devices():
    user_id = int(get_jwt_identity())
    items = (Device.query
             .filter_by(owner_id=user_id)
             .order_by(Device.created_at.desc())
             .all())
    return jsonify({"devices": [x.to_dict() for x in items]})


@devices_bp.get("/<int:device_id>")
@jwt_required()
def get_device(device_id: int):
    user_id = int(get_jwt_identity())
    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    # owner can see their own; staff/admin can see all
    if device.owner_id != user_id:
        role = _sl(get_jwt().get("role"))
        if role not in {"staff", "admin"}:
            return jsonify({"error": "forbidden"}), 403

    return jsonify({"device": device.to_dict()})


@devices_bp.get("")
@require_roles("staff", "admin")
def list_all_devices():
    # optional filters:
    status = _sl(request.args.get("status"))
    classification = _sl(request.args.get("classification"))
    device_type = _sl(request.args.get("device_type"))

    q = Device.query
    if status:
        q = q.filter_by(workflow_status=status)
    if classification:
        q = q.filter_by(classification=classification)
    if device_type:
        q = q.filter_by(device_type=device_type)

    items = q.order_by(Device.created_at.desc()).all()
    return jsonify({"devices": [x.to_dict() for x in items]})


@devices_bp.patch("/<int:device_id>/status")
@require_roles("staff", "admin")
def update_workflow_status(device_id: int):
    data = request.get_json(silent=True) or {}
    new_status = _sl(data.get("workflow_status"))

    if new_status not in ALLOWED_WORKFLOW:
        return jsonify({"error": "invalid workflow_status", "allowed": sorted(list(ALLOWED_WORKFLOW))}), 400

    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    device.workflow_status = new_status
    db.session.commit()
    return jsonify({"message": "updated", "device": device.to_dict()})


@devices_bp.patch("/<int:device_id>/classification")
@require_roles("staff", "admin")
def update_classification(device_id: int):
    data = request.get_json(silent=True) or {}
    new_cls = _sl(data.get("classification"))

    if new_cls not in ALLOWED_CLASSIFICATION:
        return jsonify({"error": "invalid classification", "allowed": sorted(list(ALLOWED_CLASSIFICATION))}), 400

    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    device.classification = new_cls
    db.session.commit()
    return jsonify({"message": "updated", "device": device.to_dict()})


# ✅ 推荐新增：staff/admin 一次 PATCH 多字段（更方便前端/测试）
@devices_bp.patch("/<int:device_id>")
@require_roles("staff", "admin")
def staff_patch_device(device_id: int):
    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}

    # workflow_status
    if "workflow_status" in data:
        new_status = _sl(data.get("workflow_status"))
        if new_status not in ALLOWED_WORKFLOW:
            return jsonify({"error": "invalid workflow_status", "allowed": sorted(list(ALLOWED_WORKFLOW))}), 400
        device.workflow_status = new_status

    # classification
    if "classification" in data:
        new_cls = _sl(data.get("classification"))
        if new_cls not in ALLOWED_CLASSIFICATION:
            return jsonify({"error": "invalid classification", "allowed": sorted(list(ALLOWED_CLASSIFICATION))}), 400
        device.classification = new_cls

    if "notes" in data:
        if hasattr(device, "notes"):
            device.notes = _s(data.get("notes")) or None

    db.session.commit()
    return jsonify({"message": "updated", "device": device.to_dict()})


@devices_bp.patch("/<int:device_id>/mine")
@jwt_required()
def owner_patch_device(device_id: int):
    user_id = int(get_jwt_identity())
    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    if device.owner_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    # Only allow edits while pending
    if (device.workflow_status or "").lower() != "pending":
        return jsonify({"error": "locked", "message": "device can only be edited while pending"}), 409

    data = request.get_json(silent=True) or {}

    # editable fields
    if "name" in data:
        device.name = _s(data.get("name"))
        if not device.name:
            return jsonify({"error": "invalid name"}), 400

    if "device_type" in data:
        dt = _sl(data.get("device_type"))
        if dt not in ALLOWED_TYPES:
            return jsonify({"error": "invalid device_type", "allowed": sorted(list(ALLOWED_TYPES))}), 400
        device.device_type = dt

    if "condition" in data:
        c = _sl(data.get("condition"))
        if c not in ALLOWED_CONDITIONS:
            return jsonify({"error": "invalid condition", "allowed": sorted(list(ALLOWED_CONDITIONS))}), 400
        device.condition = c

    if "age_years" in data:
        ay = data.get("age_years")
        if ay is None or ay == "":
            device.age_years = None
        else:
            try:
                ay = int(ay)
                if ay < 0 or ay > 100:
                    return jsonify({"error": "invalid age_years"}), 400
                device.age_years = ay
            except Exception:
                return jsonify({"error": "invalid age_years"}), 400

    if "demand" in data:
        d = _sl(data.get("demand"))
        if d == "":
            device.demand = None
        else:
            if d not in ALLOWED_DEMAND:
                return jsonify({"error": "invalid demand", "allowed": sorted(list(ALLOWED_DEMAND))}), 400
            device.demand = d

    # re-auto-classify after owner changes inputs
    device.classification = _auto_classify(device.age_years, device.demand)

    db.session.commit()
    return jsonify({"message": "updated", "device": device.to_dict()})


@devices_bp.delete("/<int:device_id>")
@jwt_required()
def owner_delete_device(device_id: int):
    user_id = int(get_jwt_identity())
    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "not found"}), 404

    if device.owner_id != user_id:
        return jsonify({"error": "forbidden"}), 403

    if (device.workflow_status or "").lower() != "pending":
        return jsonify({"error": "locked", "message": "device can only be deleted while pending"}), 409

    db.session.delete(device)
    db.session.commit()
    return jsonify({"message": "deleted", "device_id": device_id})