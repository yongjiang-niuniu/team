from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_SQLITE_PATH = PROJECT_ROOT / "backend" / "instance" / "ewastehub_dev.sqlite3"


def default_database_url() -> str:
    return f"sqlite:///{DEFAULT_SQLITE_PATH}"


def resolve_database_url() -> str:
    """Return the single project database URL used by Flask and DBupdate."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return database_url

    # Kept only for older scripts/tests. DATABASE_URL is the canonical setting.
    bridge_database_url = os.getenv("DBUPDATE_DATABASE_URL", "").strip()
    if bridge_database_url:
        return bridge_database_url

    return default_database_url()
