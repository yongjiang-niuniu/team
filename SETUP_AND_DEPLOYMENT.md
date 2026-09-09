# eWaste Hub Setup and Deployment Notes

This document explains what a new teammate needs before running the project and what is required for a public demo link.

## Fresh Clone on a New Computer

### Required local software

- Python 3.11 or newer, available as `py`, `python`, or `python3`
- Node.js 20 or newer, including `npm`
- Git, if the teammate is cloning or pulling the repository

The launcher installs project dependencies automatically, but it cannot install Python or Node.js for the user.

### Windows quick start

1. Clone or pull the repository.
2. Double-click `launcher\run.bat`.
3. Wait while the launcher creates `backend\.venv`, installs Python packages, installs frontend npm packages, creates the local SQLite schema, and seeds demo accounts.
4. The browser opens `http://127.0.0.1:5173`.

### macOS / Linux quick start

Run:

```sh
sh launcher/run.sh
```

If the script is made executable, it can also be run as:

```sh
./launcher/run.sh
```

### What the launcher creates locally

- `backend\.venv` or `backend/.venv`
- `frontend/node_modules`
- `backend/instance/ewastehub_dev.sqlite3`
- `launcher/.logs`

These files are intentionally ignored by Git. The database schema and reproducible demo users are tracked through code, migrations, runtime schema bootstrap, and `backend/seed_demo_accounts.py`.

## Demo Accounts

The normal launcher runs `backend/seed_demo_accounts.py` every time the backend starts. This means a fresh clone can use the shared accounts in `demo_accounts.txt`.

Shared password:

```text
EwasteDemo!2026
```

Examples:

- `user01@ewastehub.demo`
- `staff01@ewastehub.demo`
- `admin01@ewastehub.demo`

New users can also register with email and password through the UI.

## Login Methods

- Email and password works on a fresh local install.
- Google sign-in uses the public client ID included in the repository for local development. Use `http://127.0.0.1:5173`, not a different origin, unless the OAuth console is updated.
- GitHub sign-in needs `GITHUB_CLIENT_SECRET` in `backend/.env`. The secret must not be committed.
- Facebook and Instagram sign-in are demo front-end flows for presentation.

## Public Demo / Intranet Tunnelling

The project now uses ngrok for public demo links instead of Cloudflare Tunnel.

### Required software

- Python and Node.js, as above
- ngrok installed and available in PATH

Windows install example:

```powershell
winget install Ngrok.Ngrok
```

If ngrok asks for authentication, configure the token once:

```powershell
ngrok config add-authtoken <your-token>
```

### Start a public demo

Run:

```bat
launcher\public_demo.bat
```

The launcher:

- starts the backend at `http://127.0.0.1:5050`
- starts a public-demo frontend at `http://127.0.0.1:5174`
- configures Vite to proxy `/api` to the backend
- starts ngrok and prints a temporary `https://*.ngrok...` URL

Keep the public demo window open while teammates use the link. Closing the window stops the ngrok tunnel.

### What works through the public link

- Public pages
- Email/password login and registration
- Demo seeded accounts
- Staff/admin pages after logging in with demo staff/admin accounts
- Facebook/Instagram demo sign-in
- API calls through the same-origin `/api` proxy

### OAuth limitation through ngrok

Google and GitHub OAuth providers validate configured origins and callback URLs. A temporary ngrok domain changes each run, so Google/GitHub login through ngrok may fail unless the OAuth provider console is updated for that exact public domain and the backend environment is configured accordingly.

For public demos, use email/password demo accounts unless the team has configured OAuth for the current ngrok URL.

## Production Deployment Checklist

For a real deployment, do not rely on the development launcher. Use a production server or platform and configure:

- `APP_ENV=production`
- real `SECRET_KEY` and `JWT_SECRET_KEY`
- production `DATABASE_URL`, preferably PostgreSQL
- `FRONTEND_URL` set to the deployed frontend URL
- `CORS_ALLOWED_ORIGINS` set to the deployed frontend origin
- OAuth credentials and callback URLs for the deployed domain
- Stripe/PayPal credentials if real checkout is required
- HTTPS, logging, backups, and database migration process

The local SQLite database under `backend/instance` is only for development and demos.
