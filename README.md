# eWaste Hub

eWaste Hub is a full-stack web application for a business-to-consumer electronic waste recycling workflow. It helps device owners submit unwanted electronics, receive classification-based next steps, and track their device status. It also provides staff and administrator workspaces for device processing, retrieval workflows, referral activity, reporting, and user management.

## Key Features

- Owner account registration, login, protected routes, and profile-aware navigation
- Device submission flow with rule-based classification into current, recycle, rare, or unknown outcomes
- Owner dashboard for submitted devices, request status, editable pending devices, and secure vault access
- Staff workspace for collection requests, device inventory, unknown-device review, retrieval requests, wipe jobs, certificates, and referrals
- Admin workspace for user role management, payment reports, referral reports, and system health checks
- Retrieval/payment foundations with local checkout stubs and secure expiring download links
- Referral/reward foundations for partner-based resale and reward tracking
- Local launcher scripts that create the development database and seed demo accounts automatically
- ngrok public demo launcher for sharing a temporary public URL

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Framer Motion |
| Backend | Flask, SQLAlchemy, Flask-JWT-Extended, Flask-Migrate |
| Database | SQLite for local development, configurable `DATABASE_URL` for other relational databases |
| Testing | Python `unittest`, frontend TypeScript build, ESLint |
| Local demo | Launcher scripts, seeded demo accounts, ngrok public tunnel |

## Repository Structure

```text
.
├─ frontend/                 # React/Vite application
├─ backend/                  # Flask API, models, migrations, tests
├─ DBupdate/                 # Database bridge helpers and schema notes
├─ launcher/                 # Local and public-demo startup scripts
├─ docs/                     # Meeting records and sprint documentation
├─ SETUP_AND_DEPLOYMENT.md   # Detailed setup, ngrok, and deployment notes
└─ demo_accounts.txt         # Seeded local demo credentials
```

## Prerequisites

Install these before running the project on a new machine:

- Python 3.11 or newer
- Node.js 20 or newer, including `npm`
- Git
- ngrok, only if you need a public demo link

The launcher installs project-level Python and npm dependencies automatically, but it cannot install Python or Node.js for you.

## Quick Start

### Windows

Double-click:

```bat
launcher\run.bat
```

Or run it from PowerShell:

```powershell
.\launcher\run.bat
```

### macOS / Linux

```sh
sh launcher/run.sh
```

The local app opens at:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:5050`

On first launch, the script creates or updates:

- `backend/.venv`
- `frontend/node_modules`
- `backend/instance/ewastehub_dev.sqlite3`
- seeded demo accounts from `backend/seed_demo_accounts.py`

## Demo Accounts

The launcher automatically seeds demo users into the local SQLite database.

Shared password:

```text
EwasteDemo!2026
```

Example accounts:

| Role | Email |
|---|---|
| Owner | `user01@ewastehub.demo` |
| Staff | `staff01@ewastehub.demo` |
| Admin | `admin01@ewastehub.demo` |

More demo accounts are listed in `demo_accounts.txt`.

## Environment Variables

Environment files are optional for normal local email/password usage.

| File | Purpose |
|---|---|
| `backend/.env` | Backend secrets, OAuth secrets, database URL, CORS, payment credentials |
| `frontend/.env` | Frontend API URL and optional OAuth client ID overrides |

Use the examples as templates:

```text
backend/.env.example
frontend/.env.example
```

Important notes:

- Do not commit real `.env` files.
- Local development can use the default SQLite database without setting `DATABASE_URL`.
- Google login uses the public local-development client ID in the repository.
- GitHub login requires `GITHUB_CLIENT_SECRET` in `backend/.env`.
- Password reset emails require SMTP settings in `backend/.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `MAIL_DEFAULT_SENDER`.
- Facebook and Instagram login are available as demo sign-in flows for presentation.

## OAuth Setup

For local Google login, the OAuth client must allow:

```text
http://127.0.0.1:5173
```

If teammates use `localhost`, also add:

```text
http://localhost:5173
```

For GitHub OAuth, configure the callback URL:

```text
http://127.0.0.1:5050/api/auth/github/callback
```

## Public Demo with ngrok

Public demo links use ngrok.

Install ngrok on Windows:

```powershell
winget install Ngrok.Ngrok
```

Configure an auth token if ngrok requires it:

```powershell
ngrok config add-authtoken <your-token>
```

Start the public demo:

```bat
launcher\public_demo.bat
```

The launcher starts:

- Backend: `http://127.0.0.1:5050`
- Public-demo frontend: `http://127.0.0.1:5174`
- ngrok tunnel: `https://*.ngrok...`

Keep the launcher window open while sharing the generated URL.

Recommended login methods through the public link:

- Email/password registration
- Seeded demo accounts
- Facebook/Instagram demo sign-in

Google/GitHub OAuth may require provider console URLs to be updated for the current ngrok domain.

## Manual Development Commands

The launcher is recommended, but the project can also be run manually.

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ..\launcher\requirements.txt
.\.venv\Scripts\python.exe -m flask --app wsgi run --host 127.0.0.1 --port 5050
```

Frontend:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Testing

Backend tests:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

Frontend lint:

```powershell
cd frontend
npm run lint
```

Frontend build:

```powershell
cd frontend
npm run build
```

Current expected backend result: 95 tests pass.

## Deployment Notes

The development launcher is intended for local demos, not production hosting.

For production or a hosted staging deployment, configure:

- `APP_ENV=production`
- strong `SECRET_KEY` and `JWT_SECRET_KEY`
- production `DATABASE_URL`, preferably PostgreSQL
- `FRONTEND_URL` set to the deployed frontend origin
- `CORS_ALLOWED_ORIGINS` set to approved frontend origins
- Google/GitHub OAuth credentials and callback URLs for the deployed domain
- Stripe/PayPal credentials if real checkout is required
- HTTPS, logging, backups, and a migration strategy

See `SETUP_AND_DEPLOYMENT.md` for the complete setup and deployment checklist.

## Project Status

The project implements the main eWaste Hub workflow and supporting staff/admin foundations. Some external integrations, such as production cloud storage, production email delivery, fully verified payment provider callbacks, and a polished QR resale journey, are intended as future production improvements.

