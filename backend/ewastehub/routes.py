from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from DBupdate.db_bridge import get_user_by_id
from .extensions import db
from .models import User
from .permissions import require_roles

api_bp = Blueprint("api", __name__, url_prefix="/api")
ADMIN_MANAGEABLE_ROLES = {"consumer", "staff", "admin"}


def _serialize_admin_user(user: User):
    payload = user.to_public_dict()
    payload["full_name"] = getattr(user, "full_name", None)
    payload["auth_provider"] = getattr(user, "auth_provider", "local")
    return payload

@api_bp.get("/")
def api_root():
    return jsonify({
        "service": "ewaste-hub-api",
        "endpoints": ["/api/health", "/api/me", "/api/admin/ping", "/api/admin/users"]
    })

@api_bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "ewaste-hub-api"})

@api_bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = get_user_by_id(int(user_id))
    if not user:
        return jsonify({"error": "user not found"}), 404
    return jsonify({
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": getattr(user, "full_name", None),
            "auth_provider": getattr(user, "auth_provider", "local"),
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    })

@api_bp.get("/admin/ping")
@require_roles("admin")
def admin_ping():
    return jsonify({"message": "pong", "role_required": "admin"})


@api_bp.get("/admin/users")
@require_roles("admin")
def admin_list_users():
    role = (request.args.get("role") or "").strip().lower()
    search = (request.args.get("q") or "").strip().lower()

    if role and role not in ADMIN_MANAGEABLE_ROLES:
        return jsonify({"error": "invalid role", "allowed_roles": sorted(ADMIN_MANAGEABLE_ROLES)}), 400

    try:
        limit = int(request.args.get("limit", 50))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid limit"}), 400

    try:
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid offset"}), 400

    if limit < 1 or limit > 200:
        return jsonify({"error": "invalid limit"}), 400
    if offset < 0:
        return jsonify({"error": "invalid offset"}), 400

    query = db.session.query(User)
    if role:
        query = query.filter(User.role == role)
    if search:
        query = query.filter(User.email.ilike(f"%{search}%"))

    total = query.count()
    users = (
        query
        .order_by(User.created_at.desc(), User.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return jsonify({
        "users": [_serialize_admin_user(user) for user in users],
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
        },
        "filters": {
            "role": role or None,
            "q": search or None,
        },
    })


@api_bp.patch("/admin/users/<int:user_id>/role")
@require_roles("admin")
def admin_update_user_role(user_id: int):
    data = request.get_json(silent=True) or {}
    role = (data.get("role") or "").strip().lower()

    if role not in ADMIN_MANAGEABLE_ROLES:
        return jsonify({
            "error": "invalid role",
            "allowed_roles": sorted(ADMIN_MANAGEABLE_ROLES),
        }), 400

    user = db.session.query(User).filter_by(id=user_id).one_or_none()
    if user is None:
        return jsonify({"error": "user not found"}), 404

    current_admin_id = int(get_jwt_identity())
    if user.id == current_admin_id and role != "admin":
        return jsonify({"error": "cannot remove your own admin role"}), 409

    user.role = role
    db.session.commit()
    db.session.refresh(user)

    return jsonify({"user": _serialize_admin_user(user)})
