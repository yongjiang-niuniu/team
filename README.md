# eWaste Hub — Final Report and Historical Backend

谢菲尔德大学 **COM6103 Team 1** 团队项目。eWaste Hub 帮助用户提交闲置电子设备，并提供回收、转售、数据提取或人工审核建议，同时支持工作人员和管理员处理设备。

**这里保存正式提交报告，以及一份 2026 年 3 月的早期后端源码。最终全栈系统的源码仍在从团队 GitLab 追索，尚未恢复。**

[阅读正式提交报告](reports/COM6103_Team1_eWaste_Final_Report.pdf) · [提交来源与源码缺口](docs/FINAL_SUBMISSION.md) · [现有后端 API](docs/API.md)

The official final submission report has been recovered from Blackboard. The code currently available is a historical Flask backend snapshot, not the complete final React/Flask application described in the report.

## Formal submission / 正式提交

Blackboard 记录为 **COM6103 / Team Project / 1 eWaste，Attempt 1，2026 年 5 月 7 日 01:13（UTC+8）**。该入口只要求最终 PDF，没有附带源码 ZIP。报告原样保存；文件校验、团队署名和恢复状态见 [提交记录](docs/FINAL_SUBMISSION.md)。

报告描述 React/Vite/TypeScript 前端、扩展 Flask/SQLAlchemy 后端、设备分类与审核、管理员用户管理，以及提取、付款、转介、擦除和报表基础流程。报告同时保留了若干未完成功能。

报告记录 95 项 unittest 测试通过，前端构建和 lint 完成。这些是历史提交文件中的记录；当前快照不含这套测试，本次整理未复跑，也不把报告中的完整功能写成当前代码已实现的功能。

## Available code / 现有源码

The historical backend implements:

- Email/password registration with hashed passwords and JWT login.
- Consumer-owned collection requests with item, category, condition, and preferred collection method.
- Personal request history and permission checks for individual requests.
- Staff/admin request listing, optional status filtering, and status updates.
- `User` and `CollectionRequest` models, database migrations, and a local administrator promotion script.

The snapshot does not contain the final frontend, device classification engine, expanded device/retrieval/payment/referral/wipe/report modules, the reported test suite, or Windows launchers. Its latest original implementation commit is `12909c9cdaa93a7eaf70041547113e5b412b1d7a`, dated 3 March 2026.

## Run the historical backend

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
| `reports/COM6103_Team1_eWaste_Final_Report.pdf` | Official Blackboard final report, preserved without modification |
| `docs/FINAL_SUBMISSION.md` | Submission provenance, team attribution, and final-source recovery gaps |
| `docs/API.md` | Instructions for the historical backend API |
| `backend/wsgi.py` | Application entry point and development server |
| `backend/ewastehub/__init__.py` | Flask application factory and extension setup |
| `backend/ewastehub/auth.py` | Registration and login |
| `backend/ewastehub/requests.py` | Collection-request endpoints |
| `backend/ewastehub/permissions.py` | JWT role checks |
| `backend/ewastehub/models.py` | User and collection-request models |
| `backend/migrations/` | Alembic database schema history |
| `backend/scripts/make_admin.py` | Promote an existing account to administrator |

## Historical backend limitations

This is a coursework development backend. The entry point enables debug mode, CORS allows all origins on `/api/*`, and configuration contains development-only secret defaults. These settings need explicit configuration before hosting the service.

Request fields are checked for presence; category, condition, and collection method do not currently have enumerated validation. Staff/admin authorization uses JWT role claims on list/status routes, while individual-request access also checks the database role. Sign in again after promoting a user to refresh the token's role claim.

No automated test suite or pinned dependency versions are included. The documentation was checked against the committed source; it does not claim a production deployment or a new end-to-end test run.

## Team attribution / 团队署名

| Member | Main responsibility in the final report |
| --- | --- |
| Dibing Bai | Documentation, report preparation and part of backend development |
| Ziwen Li | Database design, setup and implementation |
| Yongjiang Liu | Frontend development; the submitted PDF spells this entry `Yongqiang Liu` |
| Yaqun Ma | Frontend development and user interface implementation |
| Xuhao Zhou | Backend development, API implementation and integration |

Blackboard confirms Yongjiang Liu belongs to group `1 eWaste`. The spelling discrepancy remains unchanged in the original PDF. This is a team project; personal repository ownership does not attribute every component to one contributor. Original commits, authors and any existing third-party notices should be retained when final source is recovered. No new project-wide license is asserted.
