# Official final submission and recovered source

## Blackboard final / 正式提交

| Field | Verified record |
|---|---|
| Course / assessment | COM6103 / Team Project |
| Group / attempt | 1 eWaste / Attempt 1 |
| Submission time displayed | 7 May 2026, 01:13 UTC+8 |
| Original attachment | `1 eWaste.pdf` |
| Canonical archived file | [COM6103_Team1_eWaste_Final_Report.pdf](../reports/COM6103_Team1_eWaste_Final_Report.pdf) |
| Size | 6,588,326 bytes |
| SHA-256 | `1cded5fef40262c3e30cb883781ca83a682f3e64c261ccac4e75fd23e37cdc37` |
| Requirement | Final report in PDF format |
| Source attachment | None; this Blackboard submission contained only the PDF |

Downloaded from the submitted attempt's attachment menu at the [Blackboard assessment](https://vle.shef.ac.uk/ultra/courses/_123515_1/assessment/_9028411_1/overview). The [receipt](../reports/submission_record.json) excludes grades and feedback. The original report is unchanged: 16 physical PDF pages, with two-up content containing a cover and numbered pages 1–31.

## Source recovery / 源码恢复

完整文件快照已从团队私有 [GitLab 项目](https://git.shefcompsci.org.uk/com6103-2025-26/team01/project) 恢复，项目 ID 为 `12500`。前端、扩展后端、数据库、测试和启动器已取得；先前“只有 3 月后端”的缺口已经解决。

| Source snapshot | Source time (UTC+8) | Files | GitHub archival commit |
|---|---|---:|---|
| `dc62413f5a9b04827b15a0be506c3301d00129e7` | 7 May 2026, 01:15:33 | 216 | `2a3d18f70fd8c23e32ded1ad5f0cfce02d88c717` |
| `d503d6b7c96f1a4e050c4d3e02f528a892d2ab45` | 13 May 2026, 20:07:42 | 226 | `04492c406f457bb52d21aed5b7c450be61a1c856` |

The first is the **report-added snapshot**. Its GitLab commit only added `E_waste_project.pdf` to parent `eb4bc8659e7cceebe2c79a7660b0678ef1a390c4`. Its time is after Blackboard's displayed 01:13 submission. It provides source near the report, but is not asserted to be the exact code at submission. The second is latest recovered `main`, six days later.

The imports are tagged `archive/gitlab-report-dc62413f` and `archive/gitlab-latest-d503d6b7`. They preserve all source bytes at original relative paths alongside existing Blackboard reports and archive documentation. [Report manifest](provenance/gitlab-report-dc62413f.json) and [latest manifest](provenance/gitlab-latest-d503d6b7.json) contain per-file SHA-256 values.

Archive ZIP SHA-256:

```text
report-added: a3df5612b3e981c16440422e51866b209472fb44eab704ad314337baefe96f8e
latest main: 6cdc2a671bf894129395898d55f5acb79f3a978def8e51669b89504812220354
```

The ZIPs contain no `.git`. GitLab showed **249 commits, 6 branches and 0 tags**, but a normal authenticated Git history clone was unavailable. That history, original branches, merge requests and Git authorship objects have **not** been imported. These are two genuine new archival commits with current timestamps, not reconstructed development commits. Original March GitHub commits remain ancestors of `main`.

## Recovered versions and remaining limits

Comparison found **180 unchanged, 10 added, 36 modified and 0 removed** files. The [complete comparison](provenance/snapshot-diff.json) records paths and hashes. Additions include email delivery/notifications, a notification migration, referral QR/credential helpers, a payment demo page and staff reports. Authentication, requests, retrieval/vault, database and frontend workflows also changed. Later additions are not claimed as verified at submission time.

| Earlier recovery gap | Recovered evidence | Remaining limit |
|---|---|---|
| React frontend | Pages, routes, components and npm lockfile | Build/lint passed; browser journeys not independently tested |
| Expanded backend/classification | Workflow modules, models, database bridge and migrations | External integration limits remain |
| Authentication/admin | Provider code, user/role pages and tests | Live OAuth not tested |
| Retrieval/payment/referral/wiping | Corresponding modules and frontend pages | Payments/cloud files are demos; physical erasure not verified |
| Tests | Latest source passes 102 backend tests | Historical report's 95-test run is separate evidence |
| Launchers/configuration | Original launchers and `.env.example` files | Inspected but not executed |
| Team process materials | 8 team meetings, 8 client/TA records and 3 sprint documents | Shared coursework remains private |
| Original GitLab history | Project and two commit identifiers known | Full history and merge-request records not recovered |

## Report copies and attribution

Both source snapshots include `E_waste_project.pdf` with SHA-256 `a926aa40b2be2c5714091c17b20e126dc771cdf2108b05732bb57c60cee0cfc9`. It differs from the canonical Blackboard file by 132 bytes, with a 42-second creation metadata difference. Normalized text and all pages rendered at 70 dpi are identical. Both original files are retained; the Blackboard attachment remains canonical. The earlier local `1+eWaste.pdf` was not used to replace it.

Blackboard confirms **Yongjiang Liu** in `1 eWaste`; the PDF prints **Yongqiang Liu** on its cover and in §6.1. This spelling discrepancy is recorded without editing the PDF. Reported contributions: Dibing Bai (documentation and part backend), Ziwen Li (database), Yongjiang Liu (frontend), Yaqun Ma (frontend/UI), Xuhao Zhou (backend/API/integration). Recovered code is shared team work; no sole-authorship or new redistribution license is claimed.

## Archive documentation edits

After the byte-preserving imports, the README and `SETUP_AND_DEPLOYMENT.md` were updated for recovered versions and verified behavior. Original source bytes remain at both tags. This provenance guide was updated, the earlier API guide moved to [the March historical reference](history/MARCH_BACKEND_API.md), and validation evidence was added. Application source, dependencies, team documents and original PDFs were not rewritten.

The latest source's 102 tests, frontend build and lint passed; [validation details](VALIDATION.md) distinguish these from the report's historical 95 tests. The report describes unfinished production integrations and frontend testing/mobile limitations. Recovery alone does not establish real payment/cloud services, physical erasure, complete browser testing or production deployment.
