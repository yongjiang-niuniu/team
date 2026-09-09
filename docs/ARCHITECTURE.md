# Architecture and workflow map

These notes describe the recovered 13 May 2026 source. They explain where the prototype's responsibilities live; they do not introduce a new architecture or change its behavior.

## Application layers

| Layer | Source | Responsibility |
| --- | --- | --- |
| Browser interface | [frontend/src/app/](../frontend/src/app/) | Owner, staff and administrator pages, layouts, components and typed API helpers |
| Flask application | [backend/wsgi.py](../backend/wsgi.py), [application factory](../backend/ewastehub/__init__.py) | Load configuration, initialise extensions, register API modules and bootstrap local SQLite |
| Authentication and roles | [auth.py](../backend/ewastehub/modules/auth.py), [permissions.py](../backend/ewastehub/permissions.py) | Account/provider flows, JWT identity and server-side role checks |
| Device workflow | [devices.py](../backend/ewastehub/modules/devices.py), [requests.py](../backend/ewastehub/modules/requests.py) | Device submission/classification, processing, collection requests and wipe-job records |
| Retrieval and related services | [vault.py](../backend/ewastehub/modules/vault.py), [rewards.py](../backend/ewastehub/modules/rewards.py) | Retrieval requests, vault downloads, demonstration checkout and referral/reward operations |
| Reporting and communication | [reports.py](../backend/ewastehub/modules/reports.py), [notifications.py](../backend/ewastehub/modules/notifications.py), [email_delivery.py](../backend/ewastehub/email_delivery.py) | Reports, notifications and configurable email delivery |
| Persistence | [models.py](../backend/ewastehub/models.py), [DBupdate/](../DBupdate/), [project_database.py](../project_database.py) | Flask models and a database bridge sharing one database URL |

## A typical device journey

1. An owner signs in and submits a device. The API validates fields such as device type, condition, age and demand.
2. Initial classification applies age/demand rules to identify `current`, `rare`, `recycle` or `unknown` devices. Staff can review unknown items and revise classification.
3. Owners and staff use the relevant collection and processing workflows. Backend permission checks control access; a page being visible is not the permission boundary.
4. Retrieval, vault and wipe-job operations record the prototype's later workflow. Demonstration payment or archive responses are not evidence that a real payment, cloud export or physical wipe occurred.

Classification and processing are separate concepts in the source. Classification describes the device category; workflow states include `pending`, `processing`, `done` and `rejected`. Wipe jobs have their own state set. See the module definitions for validation and allowed values rather than assuming one state machine controls every operation.

## Database and startup

[project_database.py](../project_database.py) resolves `DATABASE_URL`, then the legacy `DBUPDATE_DATABASE_URL` fallback, then a local SQLite database at `backend/instance/ewastehub_dev.sqlite3`. Flask and `DBupdate` share this resolver.

The app factory initialises Flask-owned tables and the bridge schema for local startup; migration files are retained in [backend/migrations/](../backend/migrations/). The code contains both SQLAlchemy models and bridge operations, so contributors should inspect the responsible module before changing a schema or query. This documentation refresh did not consolidate those implementations.

The browser stores authentication state in its existing client helper and sends requests to the API. Server-side JWT/role checks remain the authority for protected operations. Local server addresses, provider callbacks and email configuration are covered in [setup](../SETUP_AND_DEPLOYMENT.md).

## Reading changes and evidence

The latest source adds and changes workflows relative to the report-added snapshot. Use [the snapshot comparison](provenance/snapshot-diff.json) and [version guide](FINAL_SUBMISSION.md) to distinguish those states. Current modules are the source reference; the [March API guide](history/MARCH_BACKEND_API.md) is historical.

The recorded 102-test run and frontend build/lint results apply to the latest recovered source. Live integrations and browser journeys were excluded, as detailed in [validation](VALIDATION.md).
