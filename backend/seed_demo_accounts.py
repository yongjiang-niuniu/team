from __future__ import annotations

from werkzeug.security import generate_password_hash

from ewastehub import create_app
from ewastehub.extensions import db
from ewastehub.models import User


DEMO_PASSWORD = "EwasteDemo!2026"
DEMO_GROUPS = {
    "consumer": "user",
    "staff": "staff",
    "admin": "admin",
}


def seed_demo_accounts() -> int:
    app = create_app()
    changed = 0

    with app.app_context():
        for role, prefix in DEMO_GROUPS.items():
            for index in range(1, 11):
                email = f"{prefix}{index:02d}@ewastehub.demo"
                full_name = f"Demo {role.title()} {index:02d}"
                user = db.session.query(User).filter_by(email=email).one_or_none()
                if user is None:
                    db.session.add(
                        User(
                            email=email,
                            auth_provider="local",
                            full_name=full_name,
                            password_hash=generate_password_hash(DEMO_PASSWORD),
                            role=role,
                        )
                    )
                    changed += 1
                    continue

                user.auth_provider = "local"
                user.full_name = user.full_name or full_name
                user.password_hash = generate_password_hash(DEMO_PASSWORD)
                user.role = role
                changed += 1

        db.session.commit()

    return changed


if __name__ == "__main__":
    count = seed_demo_accounts()
    print(f"Demo accounts ready ({count} ensured).")
