import os
from pathlib import Path

from flask import Flask
from dotenv import load_dotenv

from .config import Config
from .extensions import db, migrate, jwt, cors
from .routes import api_bp
from . import models

from .modules.auth import auth_bp
from .modules.requests import requests_bp
from .modules.devices import devices_bp


def _ensure_sqlite_schema(app: Flask) -> None:
    database_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if not isinstance(database_uri, str) or not database_uri.startswith("sqlite:///"):
        return

    # Keep local development and launcher startup simple by creating missing tables
    # when the app points at a SQLite database file.
    with app.app_context():
        db.create_all()


def create_app():
    backend_root = Path(__file__).resolve().parent.parent
    load_dotenv(backend_root / ".env")
    load_dotenv()

    app = Flask(__name__)
    app.config.from_object(Config)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", app.config.get("SECRET_KEY", "dev-secret"))
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", app.config.get("JWT_SECRET_KEY", "dev-jwt-secret"))
    app.config["GOOGLE_CLIENT_ID"] = os.getenv("GOOGLE_CLIENT_ID", app.config.get("GOOGLE_CLIENT_ID", "")).strip()
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        app.config.get("SQLALCHEMY_DATABASE_URI", "sqlite:///ewastehub_dev.sqlite3"),
    )

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})  # dev only

    app.register_blueprint(api_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(requests_bp)
    app.register_blueprint(devices_bp)
    _ensure_sqlite_schema(app)

    return app