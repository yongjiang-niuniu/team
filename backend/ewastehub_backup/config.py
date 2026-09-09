import os

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///ewastehub_dev.sqlite3")
    SQLALCHEMY_TRACK_MODIFICATIONS = False