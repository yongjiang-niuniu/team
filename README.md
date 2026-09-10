# eWaste Hub

A web application for managing unwanted electronic devices from owner submission through staff review, collection and retrieval. The project brings those steps into one interface, with separate workspaces for owners, staff and administrators.

中文概述：谢菲尔德大学 COM6103 团队项目，使用 React 和 Flask 实现电子设备登记、分类审核、回收申请和管理流程；保留正式报告、团队源码与验证记录。

[Documentation](docs/README.md) · [Local setup](SETUP_AND_DEPLOYMENT.md) · [Final report](reports/COM6103_Team1_eWaste_Final_Report.pdf)

## Project at a glance

| Item | Details |
| --- | --- |
| Course | COM6103 Team Software Project, University of Sheffield, Team 1 |
| Project type | Full-stack coursework prototype |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Flask, SQLAlchemy, JWT authentication, database migrations |
| Local storage | SQLite by default; shared database configuration for Flask and the database bridge |
| Current source | Recovered team `main` snapshot from 13 May 2026; maintained here with documentation and the official report |
| Status | Backend tests and frontend build/lint verified; external production services and browser journeys remain unverified |

## What it does

| User | Main workflows |
| --- | --- |
| Device owner | Register or sign in, submit devices, view classification and requests, edit pending submissions, and access retrieval/vault pages |
| Staff | Review devices and unknown classifications, process collection and retrieval requests, manage wipe-job records, and work with referrals and reports |
| Administrator | Manage users and roles, inspect payment/referral reports, and run system checks |

The source also includes password-reset email delivery, notifications, Google/GitHub authentication integrations and a demonstration checkout flow. Their operational limits are listed below.

## Repository guide

| Path | Start here for |
| --- | --- |
| [frontend/](frontend/) | React pages, reusable UI components, API clients and the npm lockfile |
| [backend/ewastehub/](backend/ewastehub/) | Flask application factory, authentication and workflow modules |
| [backend/tests/](backend/tests/) | Recovered backend unittest suite |
| [DBupdate/](DBupdate/), [project_database.py](project_database.py) | Database bridge, schema helpers and shared database URL resolution |
| [launcher/](launcher/) | Python dependency list and original development launchers |
| [docs/](docs/README.md) | Architecture, setup links, validation, team process records and version provenance |
| [reports/](reports/) | Official Blackboard final report and submission receipt |

The current application entry point is `backend/wsgi.py`. The older `backend/ewastehub_backup/` directory is preserved source material; [the March API reference](docs/history/MARCH_BACKEND_API.md) describes an earlier backend, not the current route set.

## Getting started

The recorded validation environment used **Python 3.12.14, Node.js 22.23.0 and npm 10.9.8**. Python requirements are unpinned; the frontend includes a lockfile. Use a local development environment and start both services from the repository root.

Backend, on macOS/Linux:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r launcher/requirements.txt
cd backend
python -m flask --app wsgi run --host 127.0.0.1 --port 5050
```

Frontend, in a second terminal:

```bash
cd frontend
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173` and register an owner account. Application startup creates the default local SQLite schema. Follow [the setup guide](SETUP_AND_DEPLOYMENT.md) for Windows commands, staff/admin demo accounts, environment settings and available checks.

## Design

The React client presents role-specific workflows and calls the Flask JSON API. The application factory registers separate modules for authentication, devices, requests, rewards, reports, notifications and retrieval/vault operations. JWT identity and role checks protect backend operations.

Device classification starts with explicit age/demand rules. Staff can review unknown devices and update classifications and processing states. Flask models and the `DBupdate` bridge coexist in the recovered implementation; both use `project_database.py` to resolve the database address. [Architecture notes](docs/ARCHITECTURE.md) map these responsibilities to source files.

## Results and verification

| Evidence | Scope and result |
| --- | --- |
| Official final report | Records 95 tests for an earlier development state; this is historical report evidence |
| 9 September 2026 validation | Latest 13 May source passed 102 backend tests, with temporary SQLite databases and blocked external connections |
| Frontend checks | TypeScript/Vite build and ESLint passed; the build reported a large JavaScript chunk warning |
| Documentation refresh | Source paths, navigation, commands and claims reviewed against the preserved code and existing validation records; application tests were not rerun for documentation edits |

The historical report and later validation concern different versions. [Validation details](docs/VALIDATION.md) include the environment, commands, raw outputs and exclusions. Frontend build/lint results do not establish successful browser end-to-end journeys.

## Limitations

- Checkout is a **demo sandbox**, and generated cloud archives contain synthetic demonstration files. The code does not establish live payment or cloud-delivery operation.
- Wipe-job records and certificates do not establish physical device erasure.
- Google/GitHub authentication and SMTP require external configuration. Live provider flows were not tested; Facebook/Instagram buttons are presentation flows.
- The recorded Python environment was installed later from unpinned requirements. Original launchers and public-tunnel scripts were inspected but not executed during validation.
- This remains a coursework prototype with no verified production deployment or complete browser test coverage.

## Attribution and provenance

Built by **COM6103 Team 1**: Dibing Bai, Ziwen Li, Yongjiang Liu, Yaqun Ma and Xuhao Zhou. The report attributes frontend development to Yongjiang Liu; this repository preserves shared team work and does not claim sole authorship.

The official Blackboard report, two GitLab source snapshots and original March GitHub history are retained. The original **249-commit GitLab history was not imported**. Snapshot dates, original hashes, archival tags, report copies and a name-spelling discrepancy are documented in [Final submission and provenance](docs/FINAL_SUBMISSION.md). Shared team and course materials retain their original attribution; no new redistribution license is asserted.
