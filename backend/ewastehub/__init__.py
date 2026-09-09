import os
import sys
from pathlib import Path
from secrets import token_urlsafe

from flask import Flask
from dotenv import load_dotenv
from sqlalchemy import inspect, text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from DBupdate.db_new_test import init_db as init_bridge_db
from project_database import resolve_database_url

from .config import Config
from .oauth_public_defaults import PUBLIC_GITHUB_OAUTH_CLIENT_ID, PUBLIC_GOOGLE_OAUTH_CLIENT_ID
from .extensions import db, migrate, jwt, cors
from .routes import api_bp
from . import models

from .modules.auth import auth_bp
from .modules.requests import requests_bp
from .modules.devices import devices_bp
from .modules.reports import reports_bp
from .modules.vault import retrieval_download_bp, retrieval_requests_bp, vault_bp
from .modules.rewards import rewards_bp
from .modules.notifications import notifications_bp


def _ensure_sqlite_schema(app: Flask) -> None:
    database_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if not isinstance(database_uri, str) or not database_uri.startswith("sqlite:///"):
        return

    # Keep local development and launcher startup simple by creating the
    # Flask-owned tables that do not conflict with the bridge schema when the
    # app points at a SQLite database file.
    with app.app_context():
        table_names_to_create = ("users", "devices", "password_reset_tokens")
        tables_to_create = [
            db.metadata.tables[name]
            for name in table_names_to_create
            if name in db.metadata.tables
        ]
        db.metadata.create_all(bind=db.engine, tables=tables_to_create)

        inspector = inspect(db.engine)
        table_names = set(inspector.get_table_names())
        if "users" not in table_names:
            return

        user_columns = {column["name"] for column in inspector.get_columns("users")}
        with db.engine.begin() as conn:
            if "full_name" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(255)"))
            if "auth_provider" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local'"))
                conn.execute(text("UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL OR TRIM(auth_provider) = ''"))
            if "google_sub" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub ON users (google_sub)"))


def _ensure_bridge_schema() -> None:
    init_bridge_db()


def _should_bootstrap_schema() -> bool:
    if os.getenv("FLASK_SKIP_SCHEMA_BOOTSTRAP", "").strip() == "1":
        return False
    return len(sys.argv) <= 1 or sys.argv[1] != "db"


def _is_production_env(app: Flask) -> bool:
    return (app.config.get("APP_ENV") or "").strip().lower() == "production"


def _resolve_secret(app: Flask, env_name: str) -> str:
    configured = (os.getenv(env_name) or app.config.get(env_name) or "").strip()
    if configured:
        return configured

    if _is_production_env(app):
        raise RuntimeError(f"{env_name} must be set when APP_ENV=production")

    generated = token_urlsafe(48)
    app.logger.warning("%s is not set; using an ephemeral development secret.", env_name)
    return generated


def _cors_origins(app: Flask) -> list[str]:
    configured = (app.config.get("CORS_ALLOWED_ORIGINS") or "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    if _is_production_env(app):
        frontend_url = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
        if frontend_url:
            return [frontend_url]
        raise RuntimeError("CORS_ALLOWED_ORIGINS or FRONTEND_URL must be set when APP_ENV=production")

    frontend_url = (app.config.get("FRONTEND_URL") or "").rstrip("/")
    dev_origins = {
        frontend_url,
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    }
    return sorted(origin for origin in dev_origins if origin)


def create_app():
    backend_root = Path(__file__).resolve().parent.parent
    load_dotenv(backend_root / ".env")
    load_dotenv()

    app = Flask(__name__)
    app.config.from_object(Config)
    app.config["APP_ENV"] = (os.getenv("APP_ENV") or app.config.get("APP_ENV") or "development").strip().lower()
    app.config["SECRET_KEY"] = _resolve_secret(app, "SECRET_KEY")
    app.config["JWT_SECRET_KEY"] = _resolve_secret(app, "JWT_SECRET_KEY")
    _google_id = os.getenv("GOOGLE_CLIENT_ID", app.config.get("GOOGLE_CLIENT_ID", "")).strip()
    app.config["GOOGLE_CLIENT_ID"] = _google_id or PUBLIC_GOOGLE_OAUTH_CLIENT_ID
    _github_id = os.getenv("GITHUB_CLIENT_ID", app.config.get("GITHUB_CLIENT_ID", "")).strip()
    app.config["GITHUB_CLIENT_ID"] = _github_id or PUBLIC_GITHUB_OAUTH_CLIENT_ID
    app.config["GITHUB_CLIENT_SECRET"] = os.getenv(
        "GITHUB_CLIENT_SECRET",
        app.config.get("GITHUB_CLIENT_SECRET", ""),
    ).strip()
    app.config["GITHUB_REDIRECT_URI"] = os.getenv(
        "GITHUB_REDIRECT_URI",
        app.config.get("GITHUB_REDIRECT_URI", "http://127.0.0.1:5050/api/auth/github/callback"),
    ).strip()
    app.config["FRONTEND_URL"] = os.getenv(
        "FRONTEND_URL",
        app.config.get("FRONTEND_URL", "http://127.0.0.1:5173"),
    ).rstrip("/")
    for key, default in {
        "SMTP_HOST": "",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "",
        "SMTP_PASSWORD": "",
        "SMTP_USE_TLS": "true",
        "SMTP_USE_SSL": "false",
        "SMTP_TIMEOUT": "10",
        "MAIL_DEFAULT_SENDER": "",
        "MAIL_SENDER_NAME": "eWaste Hub",
        "MAIL_SUPPRESS_SEND": "false",
        "PASSWORD_RESET_EMAIL_SUBJECT": "Reset your eWaste Hub password",
    }.items():
        value = os.getenv(key, app.config.get(key, default))
        app.config[key] = value if key == "SMTP_PASSWORD" else str(value).strip()
    app.config["SQLALCHEMY_DATABASE_URI"] = resolve_database_url()

    db.init_app(app)
    migrate.init_app(app, db, directory=str(backend_root / "migrations"))
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": _cors_origins(app)}})

    app.register_blueprint(api_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(requests_bp)
    app.register_blueprint(devices_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(vault_bp)
    app.register_blueprint(retrieval_requests_bp)
    app.register_blueprint(retrieval_download_bp)
    app.register_blueprint(rewards_bp)
    app.register_blueprint(notifications_bp)
    if _should_bootstrap_schema():
        _ensure_sqlite_schema(app)
        _ensure_bridge_schema()

    return app
