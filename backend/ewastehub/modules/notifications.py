from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from DBupdate.db_bridge import (
    list_user_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@notifications_bp.get("/mine")
@jwt_required()
def list_mine():
    user_id = int(get_jwt_identity())
    try:
        limit = int(request.args.get("limit", 20))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid limit"}), 400
    if limit < 1 or limit > 100:
        return jsonify({"error": "invalid limit"}), 400

    return jsonify(list_user_notifications(user_id, limit=limit))


@notifications_bp.patch("/<int:notification_id>/read")
@jwt_required()
def read_one(notification_id: int):
    user_id = int(get_jwt_identity())
    notification = mark_notification_read(user_id, notification_id)
    if notification is None:
        return jsonify({"error": "notification not found"}), 404
    return jsonify({"notification": notification})


@notifications_bp.patch("/read-all")
@jwt_required()
def read_all():
    user_id = int(get_jwt_identity())
    return jsonify(mark_all_notifications_read(user_id))
