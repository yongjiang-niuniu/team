from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token

from ..extensions import db
from ..models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

def _get_json():
    data = request.get_json(silent=True)
    return data or {}

def _issue_auth_response(user):
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return jsonify({
        "access_token": token,
        "user": user.to_public_dict()
    })

def _verify_google_credential(credential):
    client_id = current_app.config.get("GOOGLE_CLIENT_ID", "")
    if not client_id:
        raise RuntimeError("GOOGLE_CLIENT_ID is not configured")

    try:
        from google.auth.transport.requests import Request as GoogleRequest
        from google.oauth2 import id_token
    except ImportError as exc:
        raise RuntimeError("Google login dependencies are not installed correctly") from exc

    try:
        payload = id_token.verify_oauth2_token(
            credential,
            GoogleRequest(),
            audience=client_id,
        )
    except ValueError as exc:
        raise ValueError("invalid Google credential") from exc
    except Exception as exc:
        current_app.logger.exception("Google token verification failed")
        raise RuntimeError("Google token verification is temporarily unavailable") from exc

    if payload.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise ValueError("invalid Google token issuer")

    if not payload.get("email"):
        raise ValueError("Google account email is unavailable")

    if not payload.get("email_verified"):
        raise ValueError("Google account email is not verified")

    return payload

@auth_bp.post("/register")
def register():
    data = _get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already registered"}), 409

    user = User(
        email=email,
        password_hash=generate_password_hash(password),
        role="consumer",
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "registered", "user": user.to_public_dict()}), 201

@auth_bp.post("/login")
def login():
    data = _get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid credentials"}), 401

    return _issue_auth_response(user)

@auth_bp.post("/google")
def google_login():
    data = _get_json()
    credential = (data.get("credential") or data.get("id_token") or "").strip()

    if not credential:
        return jsonify({"error": "Google credential is required"}), 400

    try:
        payload = _verify_google_credential(credential)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 401
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500

    email = payload["email"].strip().lower()
    user = User.query.filter_by(email=email).first()

    if not user:
        # Google-only accounts still need a non-null password hash in the current schema.
        user = User(
            email=email,
            password_hash=generate_password_hash(f"google-oauth:{payload.get('sub', email)}"),
            role="consumer",
        )
        db.session.add(user)
        db.session.commit()

    return _issue_auth_response(user)