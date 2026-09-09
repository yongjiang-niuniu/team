# Local setup and prototype limits

These instructions describe the recovered **13 May 2026** source. Archive verification used Python 3.12.14, Node.js 22.23.0 and npm 10.9.8. The original Python requirements are unpinned; [recorded installed packages](docs/validation/python-environment.txt) describe the September validation environment, not the historical May environment. The frontend includes an npm lockfile.

## Manual local setup

On macOS/Linux, from the repository root:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r launcher/requirements.txt
cd backend
python -m flask --app wsgi run --host 127.0.0.1 --port 5050
```

On Windows PowerShell:

```powershell
py -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r launcher/requirements.txt
cd backend
./.venv/Scripts/python.exe -m flask --app wsgi run --host 127.0.0.1 --port 5050
```

In a second terminal, from the repository root:

```bash
cd frontend
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend: `http://127.0.0.1:5173`. Backend: `http://127.0.0.1:5050`. Application startup bootstraps SQLite at `backend/instance/ewastehub_dev.sqlite3`.

## Accounts and original launchers

Register in the interface for an owner account. With the virtual environment active, run from the repository root to create the explicit local demo accounts:

```bash
python backend/seed_demo_accounts.py
```

[demo_accounts.txt](demo_accounts.txt) contains demonstration accounts and their shared password; these are seed data, not real user credentials.

Original convenience launchers remain available: `sh launcher/run.sh` on macOS/Linux or `launcher\run.bat` on Windows. They install dependencies, prepare the database, seed accounts and start services. They were inspected but not executed during archive verification.

The original ngrok scripts in `launcher/` start a public tunnel and may stop existing tunnel processes. They were not executed; this archive has not been publicly deployed.

## Configuration

Use [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example) as templates. Actual `.env` files are ignored by Git.

| Setting | Purpose |
|---|---|
| `DATABASE_URL` | Shared database URL; local SQLite by default. `DBUPDATE_DATABASE_URL` is a legacy fallback. |
| `SECRET_KEY`, `JWT_SECRET_KEY` | Application/token secrets. Development generates ephemeral values if absent. |
| `VITE_API_BASE_URL` | Frontend API address; local API at port 5050. |
| `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Provider configuration. Public client IDs are preserved in source; live access is not guaranteed. |
| `GITHUB_REDIRECT_URI`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` | Callback, frontend and allowed origin settings. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_DEFAULT_SENDER` | Email delivery settings. Without SMTP, local development logs reset links. |

Google/GitHub need valid provider registrations and callbacks. Facebook/Instagram controls are presentation flows. Live OAuth and SMTP were not verified.

## Checks

With the Python environment active, from the repository root:

```bash
python -m unittest discover -s backend/tests -v
```

From `frontend/`:

```bash
npm run build
npm run lint
```

Source tests use temporary SQLite and mocked provider responses. Archive verification applied additional environment, network and database guards in an isolated copy; see [validation](docs/VALIDATION.md).

## Production scope

这是课程原型。付款 checkout 仍标记 `demo_sandbox`，云端文件包使用演示数据；填写付款密钥不会使当前代码自动成为真实付款系统。擦除记录不能证明物理设备已完成安全擦除。

Production configuration checks exist in source, but real payment processing, real cloud delivery, physical erasure, live provider operation and production deployment have not been established. Development launchers and seeded accounts are intended for local demonstrations.

Original README and setup bytes remain at the [`archive/gitlab-latest-d503d6b7` tag](https://github.com/yongjiang-niuniu/team/tree/archive/gitlab-latest-d503d6b7). Application source and dependencies were preserved without implementation changes.
