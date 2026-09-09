from datetime import datetime, timedelta
from secrets import token_urlsafe
from urllib.parse import urlencode

import requests
from flask import Blueprint, request, jsonify, current_app, redirect, session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from DBupdate.db_bridge import create_user, get_user_by_email
from ..extensions import db
from ..models import PasswordResetToken, User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
DEFAULT_FRONTEND_URL = "http://127.0.0.1:5173"
DEFAULT_GITHUB_REDIRECT_URI = "http://127.0.0.1:5050/api/auth/github/callback"
DEFAULT_APP_REDIRECT = "/app/new-request"
DEFAULT_PASSWORD_RESET_PATH = "/reset-password"
PASSWORD_RESET_EXPIRY_MINUTES = 30
LOCAL_AUTH_PROVIDER = "local"
GOOGLE_AUTH_PROVIDER = "google"
GITHUB_STATE_SESSION_KEY = "github_oauth_state"
GITHUB_NEXT_SESSION_KEY = "github_oauth_next"
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"


def _get_json():
    data = request.get_json(silent=True)
    return data or {}


def _build_auth_payload(user):
    return {
        "access_token": create_access_token(identity=str(user.id), additional_claims={"role": user.role}),
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": getattr(user, "full_name", None),
            "auth_provider": getattr(user, "auth_provider", LOCAL_AUTH_PROVIDER),
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
    }


def _issue_auth_response(user):
    return jsonify(_build_auth_payload(user))


def _build_registered_user_payload(user):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _get_frontend_url():
    return (current_app.config.get("FRONTEND_URL") or DEFAULT_FRONTEND_URL).rstrip("/")


def _sanitize_next_path(next_path):
    candidate = (next_path or "").strip()
    if not candidate or not candidate.startswith("/") or candidate.startswith("//"):
        return DEFAULT_APP_REDIRECT
    return candidate


def _redirect_to_frontend(path, *, query=None, fragment=None):
    target = f"{_get_frontend_url()}{path}"
    if query:
        target = f"{target}?{urlencode(query)}"
    if fragment:
        target = f"{target}#{urlencode(fragment)}"
    return redirect(target)


def _redirect_to_login_error(message):
    return _redirect_to_frontend("/auth/login", query={"oauth_error": message})


def _build_password_reset_link(token):
    return f"{_get_frontend_url()}{DEFAULT_PASSWORD_RESET_PATH}?token={token}"


def _forgot_password_success_response(reset_token=None):
    payload = {
        "message": "If the email is registered, password reset instructions will be sent.",
    }
    return jsonify(payload)


def _reset_password_error(message, status_code=400):
    return jsonify({"error": message}), status_code


def _auth_conflict(message):
    return jsonify({"error": message}), 409


def _change_password_error(message, status_code=400):
    return jsonify({"error": message}), status_code


def _get_github_config():
    client_id = (current_app.config.get("GITHUB_CLIENT_ID") or "").strip()
    client_secret = (current_app.config.get("GITHUB_CLIENT_SECRET") or "").strip()
    redirect_uri = (current_app.config.get("GITHUB_REDIRECT_URI") or DEFAULT_GITHUB_REDIRECT_URI).strip()

    if not client_id or not client_secret:
        raise RuntimeError("GitHub sign-in is not configured yet.")

    return client_id, client_secret, redirect_uri


def _github_api_headers(access_token):
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {access_token}",
        "User-Agent": "eWasteHub-Auth",
    }


def _get_verified_github_email(access_token):
    response = requests.get(
        GITHUB_EMAILS_URL,
        headers=_github_api_headers(access_token),
        timeout=10,
    )
    response.raise_for_status()
    emails = response.json()

    verified_emails = [
        entry.get("email", "").strip().lower()
        for entry in emails
        if entry.get("verified") and entry.get("email")
    ]
    primary_verified = next(
        (
            entry.get("email", "").strip().lower()
            for entry in emails
            if entry.get("verified") and entry.get("primary") and entry.get("email")
        ),
        "",
    )

    if primary_verified:
        return primary_verified
    if verified_emails:
        return verified_emails[0]
    return ""


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


@auth_bp.get("/github/login")
def github_login():
    try:
        client_id, _, redirect_uri = _get_github_config()
    except RuntimeError as exc:
        return _redirect_to_login_error(str(exc))

    next_path = _sanitize_next_path(request.args.get("next"))
    state = token_urlsafe(32)
    session[GITHUB_STATE_SESSION_KEY] = state
    session[GITHUB_NEXT_SESSION_KEY] = next_path

    return redirect(
        f"{GITHUB_AUTHORIZE_URL}?{urlencode({
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'scope': 'read:user user:email',
            'state': state,
            'allow_signup': 'true',
        })}"
    )


@auth_bp.get("/github/callback")
def github_callback():
    next_path = _sanitize_next_path(session.pop(GITHUB_NEXT_SESSION_KEY, DEFAULT_APP_REDIRECT))
    expected_state = session.pop(GITHUB_STATE_SESSION_KEY, "")
    state = (request.args.get("state") or "").strip()
    code = (request.args.get("code") or "").strip()
    github_error = (request.args.get("error") or "").strip()
    github_error_description = (request.args.get("error_description") or "").strip()

    if github_error:
        message = github_error_description or "GitHub sign-in was cancelled or denied."
        return _redirect_to_login_error(message)

    if not expected_state or not state or state != expected_state:
        return _redirect_to_login_error("GitHub sign-in session expired. Please try again.")

    if not code:
        return _redirect_to_login_error("GitHub sign-in did not return an authorization code.")

    try:
        client_id, client_secret, redirect_uri = _get_github_config()
        token_response = requests.post(
            GITHUB_TOKEN_URL,
            headers={
                "Accept": "application/json",
                "User-Agent": "eWasteHub-Auth",
            },
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            timeout=10,
        )
        token_response.raise_for_status()
        token_payload = token_response.json()
        if token_payload.get("error"):
            raise ValueError(token_payload.get("error_description") or "GitHub token exchange failed.")

        github_access_token = (token_payload.get("access_token") or "").strip()
        if not github_access_token:
            raise RuntimeError("GitHub token exchange failed.")

        profile_response = requests.get(
            GITHUB_USER_URL,
            headers=_github_api_headers(github_access_token),
            timeout=10,
        )
        profile_response.raise_for_status()
        github_profile = profile_response.json()
        email = _get_verified_github_email(github_access_token)
    except ValueError as exc:
        return _redirect_to_login_error(str(exc))
    except requests.RequestException as exc:
        current_app.logger.exception("GitHub OAuth request failed")
        return _redirect_to_login_error("GitHub sign-in is temporarily unavailable. Please try again.")
    except RuntimeError as exc:
        return _redirect_to_login_error(str(exc))

    if not email:
        return _redirect_to_login_error("GitHub account email is unavailable or not verified.")

    user = get_user_by_email(email)
    if not user:
        create_user(
            email=email,
            password_hash=generate_password_hash(f"github-oauth:{github_profile.get('id', email)}"),
            role="consumer",
        )
        user = get_user_by_email(email)

    if not user:
        return _redirect_to_login_error("Unable to complete GitHub sign-in.")

    payload = _build_auth_payload(user)
    return _redirect_to_frontend(
        "/auth/oauth-callback",
        fragment={
            "access_token": payload["access_token"],
            "next": next_path,
        },
    )


@auth_bp.post("/register")
def register():
    data = _get_json()
    full_name = (data.get("full_name") or "").strip() or None
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    existing_user = db.session.query(User).filter_by(email=email).one_or_none()
    if existing_user:
        if existing_user.auth_provider == GOOGLE_AUTH_PROVIDER:
            return _auth_conflict("email is already registered with Google sign-in")
        return jsonify({"error": "email already registered"}), 409

    user = User(
        email=email,
        auth_provider=LOCAL_AUTH_PROVIDER,
        full_name=full_name,
        password_hash=generate_password_hash(password),
        role="consumer",
    )
    db.session.add(user)
    db.session.commit()
    db.session.refresh(user)
    return jsonify({"message": "registered", "user": _build_registered_user_payload(user)}), 201


@auth_bp.post("/login")
def login():
    data = _get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = db.session.query(User).filter_by(email=email).one_or_none()
    if (
        not user
        or user.auth_provider != LOCAL_AUTH_PROVIDER
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({"error": "invalid credentials"}), 401

    return _issue_auth_response(user)


@auth_bp.post("/forgot-password")
def forgot_password():
    data = _get_json()
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "email is required"}), 400

    user = db.session.query(User).filter_by(email=email).one_or_none()
    if user is None:
        return _forgot_password_success_response()

    now = datetime.utcnow()
    reset_token = token_urlsafe(32)
    reset_link = _build_password_reset_link(reset_token)
    token_record = PasswordResetToken(
        user_id=user.id,
        token=reset_token,
        created_at=now,
        expires_at=now + timedelta(minutes=PASSWORD_RESET_EXPIRY_MINUTES),
        used=False,
    )
    db.session.add(token_record)
    db.session.commit()

    if current_app.debug or current_app.testing:
        current_app.logger.info("Password reset link for %s: %s", email, reset_link)

    return _forgot_password_success_response()


@auth_bp.post("/reset-password")
def reset_password():
    data = _get_json()
    token = (data.get("token") or "").strip()
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not token:
        return _reset_password_error("token is required")
    if not new_password:
        return _reset_password_error("new_password is required")
    if not confirm_password:
        return _reset_password_error("confirm_password is required")
    if new_password != confirm_password:
        return _reset_password_error("passwords do not match")

    token_record = db.session.query(PasswordResetToken).filter_by(token=token).one_or_none()
    if token_record is None:
        return _reset_password_error("invalid token")
    if token_record.used:
        return _reset_password_error("token has already been used", 409)
    if token_record.is_expired:
        return _reset_password_error("token has expired")

    user = db.session.query(User).filter_by(id=token_record.user_id).one_or_none()
    if user is None:
        return _reset_password_error("invalid token")

    user.password_hash = generate_password_hash(new_password)
    token_record.used = True
    db.session.commit()

    return jsonify({"message": "password reset successful"})


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    data = _get_json()
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not current_password:
        return _change_password_error("current_password is required")
    if not new_password:
        return _change_password_error("new_password is required")
    if len(new_password) < 8:
        return _change_password_error("new_password must be at least 8 characters")
    if not confirm_password:
        return _change_password_error("confirm_password is required")
    if new_password != confirm_password:
        return _change_password_error("passwords do not match")

    user_id = get_jwt_identity()
    user = db.session.query(User).filter_by(id=int(user_id)).one_or_none()
    if user is None:
        return _change_password_error("user not found", 404)
    if user.auth_provider != LOCAL_AUTH_PROVIDER:
        return _change_password_error(
            "Password change is only available for email/password accounts.",
            409,
        )
    if not check_password_hash(user.password_hash, current_password):
        return _change_password_error("current password is incorrect", 401)
    if current_password == new_password:
        return _change_password_error("new password must be different from the current password", 409)

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"message": "password changed successfully"})


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
    google_sub = (payload.get("sub") or "").strip()
    if not google_sub:
        return jsonify({"error": "Google account ID is unavailable"}), 401

    user = db.session.query(User).filter_by(google_sub=google_sub).one_or_none()
    if user:
        if user.auth_provider != GOOGLE_AUTH_PROVIDER or user.email != email:
            return _auth_conflict("Google account is already linked to a different user")
        return _issue_auth_response(user)

    existing_email_user = db.session.query(User).filter_by(email=email).one_or_none()
    if existing_email_user:
        if existing_email_user.auth_provider == LOCAL_AUTH_PROVIDER:
            return _auth_conflict("email is already registered with email/password sign-in")
        return _auth_conflict("Google account is already linked differently")

    user = User(
        email=email,
        auth_provider=GOOGLE_AUTH_PROVIDER,
        google_sub=google_sub,
        full_name=(payload.get("name") or "").strip() or None,
        password_hash=generate_password_hash(f"google-oauth:{google_sub}"),
        role="consumer",
    )
    db.session.add(user)
    db.session.commit()
    db.session.refresh(user)
    return _issue_auth_response(user)
