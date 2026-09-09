from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import CollectionRequest, User
from ..permissions import require_roles

requests_bp = Blueprint("requests", __name__, url_prefix="/api/requests")


@requests_bp.post("")
@jwt_required()
def create_request():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json(silent=True) or {}
    item_name = (data.get("item_name") or "").strip()
    category = (data.get("category") or "").strip()
    condition = (data.get("condition") or "").strip()
    preferred_method = (data.get("preferred_method") or "").strip()

    if not item_name or not category or not condition or not preferred_method:
        return jsonify({
            "error": "missing fields",
            "required": ["item_name", "category", "condition", "preferred_method"]
        }), 400

    cr = CollectionRequest(
        consumer_id=user_id,
        item_name=item_name,
        category=category,
        condition=condition,
        preferred_method=preferred_method,
        status="submitted",
    )
    db.session.add(cr)
    db.session.commit()

    return jsonify({"message": "created", "request": cr.to_dict()}), 201


@requests_bp.get("/mine")
@jwt_required()
def list_my_requests():
    user_id = int(get_jwt_identity())
    items = (CollectionRequest.query
             .filter_by(consumer_id=user_id)
             .order_by(CollectionRequest.created_at.desc())
             .all())
    return jsonify({"requests": [x.to_dict() for x in items]})


@requests_bp.get("")
@require_roles("staff", "admin")
def list_all_requests():
    # 可选：支持 query param 过滤，比如 ?status=submitted
    status = (request.args.get("status") or "").strip()
    q = CollectionRequest.query

    if status:
        q = q.filter_by(status=status)

    items = q.order_by(CollectionRequest.created_at.desc()).all()
    return jsonify({"requests": [x.to_dict() for x in items]})

@requests_bp.get("/<int:req_id>")
@jwt_required()
def get_request(req_id: int):
    user_id = int(get_jwt_identity())
    cr = CollectionRequest.query.get(req_id)
    if not cr:
        return jsonify({"error": "not found"}), 404

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    if cr.consumer_id != user_id and user.role not in ("staff", "admin"):
        return jsonify({"error": "forbidden"}), 403

    return jsonify({"request": cr.to_dict()})

@requests_bp.patch("/<int:req_id>/status")
@require_roles("staff", "admin")
def update_status(req_id: int):
    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip()

    allowed = {"submitted", "approved", "rejected", "completed"}
    if new_status not in allowed:
        return jsonify({"error": "invalid status", "allowed": sorted(list(allowed))}), 400

    cr = CollectionRequest.query.get(req_id)
    if not cr:
        return jsonify({"error": "not found"}), 404

    cr.status = new_status
    db.session.commit()

    return jsonify({"message": "updated", "request": cr.to_dict()})