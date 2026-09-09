# eWaste Hub · COM6103 Team 1

谢菲尔德大学团队项目：帮助用户提交闲置电子设备，并让工作人员完成设备分类、审核、提取申请和回收处理。此私有仓库保存 **Blackboard 正式最终报告、团队 GitLab 的两个完整文件快照，以及原有 3 月后端提交历史**。

A full-stack electronic-waste management prototype built by COM6103 Team 1. Owners submit devices; staff process them; administrators manage users and reports. This archive retains the official final report and recovered React/Flask source with team attribution.

[正式报告 / Final report](reports/COM6103_Team1_eWaste_Final_Report.pdf) · [来源与版本 / Provenance](docs/FINAL_SUBMISSION.md) · [运行说明 / Setup](SETUP_AND_DEPLOYMENT.md) · [验证记录 / Validation](docs/VALIDATION.md)

## Preserved versions / 保存版本

| Version | Meaning |
|---|---|
| Original March history | Original GitHub backend commits remain ancestors of `main`; the implementation was at `12909c9` on 3 March 2026. |
| `archive/gitlab-report-dc62413f` | Archival tag containing all 216 files from the report-added GitLab snapshot, dated 7 May 2026, 01:15:33 UTC+8. |
| `archive/gitlab-latest-d503d6b7` | Archival tag containing all 226 files from latest recovered GitLab `main`, dated 13 May 2026, 20:07:42 UTC+8. |
| Current `main` | Latest recovered source, canonical Blackboard report, and updated archive documentation. |

Blackboard 的正式提交时间为 **2026 年 5 月 7 日 01:13（UTC+8）**，附件只有 PDF。报告相关 GitLab 快照比页面提交时间晚约两分钟，不能将其称为“提交瞬间的精确源码”。最新源码来自 5 月 13 日。

The GitHub archival commits were created on the recovery date. The original **249-commit GitLab history has not been imported**; source ZIPs contain no `.git`. The tags identify archival imports, not original GitLab commit objects.

## Recovered prototype / 已恢复的原型

- **Owners:** email/password authentication, device submission and classification, request tracking, pending-device editing, retrieval and vault pages.
- **Staff:** device records, unknown-device review, collection and retrieval requests, wipe-job records, referrals and reports.
- **Administrators:** user and role management, payment/referral reports and system checks.
- **Supporting source:** models and migrations, Google/GitHub integration code, notifications and email delivery, frontend routes/API clients, launchers, tests, meeting records and sprint documents.

React 19、TypeScript、Vite 与 Tailwind CSS 构成前端；Flask、SQLAlchemy、JWT 和数据库迁移支持后端。本地默认使用 SQLite，可通过 `DATABASE_URL` 配置数据库地址。

Payment checkout is explicitly a **demo sandbox**; cloud archives contain **synthetic demo files**. Wipe-job records do not establish physical device erasure. OAuth and SMTP require external configuration; Facebook/Instagram buttons are presentation flows. These integrations were not verified against live services.

## Run locally / 本地运行

Archive verification used **Python 3.12.14, Node.js 22.23.0 and npm 10.9.8**. From the repository root:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r launcher/requirements.txt
cd backend
python -m flask --app wsgi run --host 127.0.0.1 --port 5050
```

In another terminal:

```bash
cd frontend
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`. Application startup creates the default local SQLite schema. Register an owner account, or follow [setup](SETUP_AND_DEPLOYMENT.md) to seed staff/admin demo accounts. That guide also includes Windows commands and configuration.

## Verification / 整理时验证

On **9 September 2026**, the latest source passed **102 backend unittest tests**, the TypeScript/Vite build and ESLint. Backend tests used an isolated copy, temporary SQLite databases and blocked external connections. The build reported a large JavaScript chunk warning. Browser end-to-end journeys and live services were not tested.

正式报告记载的是当时 **95 项测试**；本次 102 项是对 5 月 13 日源码重新运行的结果。两者时间与版本不同，详见 [验证记录](docs/VALIDATION.md)。

## Team / 团队

Roles follow the official report. This is shared team work, not a claim of sole authorship.

| Member | Reported contribution |
|---|---|
| Dibing Bai | Documentation, report and part of the backend |
| Ziwen Li | Database design, setup and implementation |
| Yongjiang Liu | Frontend development |
| Yaqun Ma | Frontend development and UI design |
| Xuhao Zhou | Backend, APIs and integration |

Blackboard confirms **Yongjiang Liu** as a member of `1 eWaste`. The original PDF spells this frontend member **Yongqiang Liu** on its cover and in §6.1. The PDF remains unchanged; the spelling discrepancy is recorded here.

## Repository guide

| Path | Contents |
|---|---|
| `frontend/` | React pages, components, API clients and npm lockfile |
| `backend/ewastehub/`, `backend/tests/` | Current Flask application and recovered unittest suite |
| `DBupdate/`, `project_database.py` | Database bridge, schema helpers and shared database configuration |
| `launcher/` | Original local/demo scripts and Python dependency list |
| `reports/` | Canonical Blackboard report and submission receipt |
| `docs/provenance/`, `docs/validation/` | Snapshot hashes, differences and validation evidence |
| `docs/history/` | Historical March API reference |
| `docs/meeting record/`, `docs/class record/`, `docs/sprint/` | Original team process documents |

Original `backend/ewastehub_backup/`, `E_waste_project.pdf` and the course brief are retained as received. [The historical API guide](docs/history/MARCH_BACKEND_API.md) describes the March backend only; current routes are in `backend/ewastehub/modules/` and `routes.py`.

This repository remains private because it includes shared team and course materials. No new redistribution license is asserted.
