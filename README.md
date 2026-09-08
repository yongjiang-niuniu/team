# eWaste Hub — Collection Requests API

A Flask backend for an electronic-waste recycling application, developed for **Team 01, COM6103**. Consumers can register, sign in, and submit items for collection; staff and administrators can review requests and update their status.

This repository contains the backend implementation and database migrations. A frontend and a deployed service are not included.

## What is implemented

- Email/password registration with hashed passwords and JWT login.
- Consumer-owned collection requests with item, category, condition, and preferred collection method.
- Personal request history and permission checks for individual requests.
- Staff/admin request listing, optional status filtering, and status updates.
- SQLAlchemy models, versioned database migrations, and a local administrator promotion script.

## Run locally

Use Python 3 and a virtual environment. The original repository has no dependency lockfile; the package list below is inferred from the imports and does not reproduce a recorded historical environment.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install Flask Flask-SQLAlchemy Flask-Migrate Flask-JWT-Extended Flask-Cors python-dotenv
cd backend
python -m flask --app wsgi:app db upgrade
python wsgi.py
```

The development server listens at `http://127.0.0.1:5050`.

```bash
curl http://127.0.0.1:5050/api/health
```

Expected response fields are `status: "ok"` and `service: "ewaste-hub-api"`.

The default database is SQLite (`sqlite:///ewastehub_dev.sqlite3`, under Flask's instance directory). Configuration supports `DATABASE_URL`, `SECRET_KEY`, and `JWT_SECRET_KEY` through process environment variables. Set these before starting Python when overriding defaults: `Config` reads the environment during import, before `create_app()` calls `load_dotenv()`.

## API and workflow

See [API reference and request examples](docs/API.md) for registration, authentication, request creation, permissions, and administrator setup.

A new request starts as `submitted`. Staff/admin users may set it to `submitted`, `approved`, `rejected`, or `completed`. These values are validated, but a stricter transition order is not enforced.

## Repository map

| Path | Purpose |
| --- | --- |
| `backend/wsgi.py` | Application entry point and development server |
| `backend/ewastehub/__init__.py` | Flask application factory and extension setup |
| `backend/ewastehub/auth.py` | Registration and login |
| `backend/ewastehub/requests.py` | Collection-request endpoints |
| `backend/ewastehub/permissions.py` | JWT role checks |
| `backend/ewastehub/models.py` | User and collection-request models |
| `backend/migrations/` | Alembic database schema history |
| `backend/scripts/make_admin.py` | Promote an existing account to administrator |

## Current scope and limitations

This is a coursework development backend. The entry point enables debug mode, CORS allows all origins on `/api/*`, and configuration contains development-only secret defaults. These settings need explicit configuration before hosting the service.

Request fields are checked for presence; category, condition, and collection method do not currently have enumerated validation. Staff/admin authorization uses JWT role claims on list/status routes, while individual-request access also checks the database role. Sign in again after promoting a user to refresh the token's role claim.

No automated test suite or pinned dependency versions are included. The documentation was checked against the committed source; it does not claim a production deployment or a new end-to-end test run.

## Project context

The original README identifies this as the Team 01 COM6103 eWaste Recycling Project. This repository preserves that team context; it does not attribute every component to one contributor. No project-wide license file is currently included.
