import os

from .oauth_public_defaults import PUBLIC_GITHUB_OAUTH_CLIENT_ID, PUBLIC_GOOGLE_OAUTH_CLIENT_ID
from project_database import resolve_database_url


def _env_or_public(key: str, public_default: str) -> str:
    value = os.getenv(key, "").strip()
    return value if value else public_default


class Config:
    APP_ENV = os.getenv("APP_ENV", os.getenv("FLASK_ENV", "development")).strip().lower() or "development"
    SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
    GOOGLE_CLIENT_ID = _env_or_public("GOOGLE_CLIENT_ID", PUBLIC_GOOGLE_OAUTH_CLIENT_ID)
    GITHUB_CLIENT_ID = _env_or_public("GITHUB_CLIENT_ID", PUBLIC_GITHUB_OAUTH_CLIENT_ID)
    GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
    GITHUB_REDIRECT_URI = os.getenv(
        "GITHUB_REDIRECT_URI",
        "http://127.0.0.1:5050/api/auth/github/callback",
    ).strip()
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
    CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
    SMTP_PORT = os.getenv("SMTP_PORT", "587").strip()
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").strip()
    SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").strip()
    SMTP_TIMEOUT = os.getenv("SMTP_TIMEOUT", "10").strip()
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", "").strip()
    MAIL_SENDER_NAME = os.getenv("MAIL_SENDER_NAME", "eWaste Hub").strip()
    MAIL_SUPPRESS_SEND = os.getenv("MAIL_SUPPRESS_SEND", "false").strip()
    PASSWORD_RESET_EMAIL_SUBJECT = os.getenv(
        "PASSWORD_RESET_EMAIL_SUBJECT",
        "Reset your eWaste Hub password",
    ).strip()
    STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip()
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
    PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "").strip()
    PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "").strip()
    SQLALCHEMY_DATABASE_URI = resolve_database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
