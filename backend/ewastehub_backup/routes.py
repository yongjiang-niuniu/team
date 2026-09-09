from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from .models import User
from .permissions import require_roles

api_bp = Blueprint("api", __name__, url_prefix="/api")

@api_bp.get("/")
def api_root():
    return jsonify({
        "service": "ewaste-hub-api",
        "endpoints": ["/api/health", "/api/me", "/api/admin/ping"]
    })

@api_bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "ewaste-hub-api"})

@api_bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "user not found"}), 404
    return jsonify({"user": user.to_public_dict()})

@api_bp.get("/admin/ping")
@require_roles("admin")
def admin_ping():
    return jsonify({"message": "pong", "role_required": "admin"})