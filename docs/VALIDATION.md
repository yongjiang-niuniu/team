# Archive validation — 9 September 2026

The tested tree is latest recovered GitLab snapshot `d503d6b7c96f1a4e050c4d3e02f528a892d2ab45`. Tests ran in an isolated copy without altering original ZIPs, recovered source or archived application code.

| Check | Result |
|---|---|
| Python unittest discovery | **102 passed**, 0 failures/errors/skipped; 16.742 seconds |
| SQLite access | Six connections, all under the isolated temporary test directory |
| Backend network access | Connection guard active; no connection attempts recorded |
| Frontend install | `npm ci --ignore-scripts --no-audit --no-fund` succeeded |
| Production build | `npm run build` succeeded; 2471 modules transformed |
| Lint | `npm run lint` succeeded without diagnostics |
| Build warning | Main minified JavaScript chunk 900.41 kB exceeds the 500 kB warning threshold |

Environment: Python 3.12.14, Node.js 22.23.0 and npm 10.9.8. Python requirements were freshly installed from the original unpinned list; [installed package versions](validation/python-environment.txt) describe this validation environment, not the original May environment. Vite resolved to 8.0.0-beta.16 through the original npm lockfile.

Evidence: [structured results](validation/2026-09-09-results.json), [build output](validation/frontend-build.txt), [lint output](validation/frontend-lint.txt).

## Method and limits

Original tests were discovered with Python `unittest`. The wrapper cleared unrelated environment settings, supplied disposable test secrets/database defaults, disabled dotenv loading, suppressed email delivery and blocked socket connections. SQLite audit checks restricted connections to the temporary test directory. Source tests were unchanged; the tests mocked provider responses.

The report records **95 tests in 9.543 seconds** for an earlier development state. This archive independently ran 102 tests against May 13 source. The report-added May 7 snapshot was preserved but not independently rerun.

No launcher, public tunnel, real OAuth login, SMTP delivery, production database, actual payment or physical erasure was executed. Frontend build and lint are not browser end-to-end tests; no dedicated frontend automated-test script is declared.

## Archive safety review

Both ZIPs were checked for path traversal, unsafe links and size before extraction. Source and environment examples were reviewed using known credential/token patterns. No high-confidence real credential was found. Public OAuth client IDs and explicitly seeded demo passwords remain as source examples.

No actual `.env`, runtime database, virtual environment or `node_modules` was included in the recovered ZIPs. Gitleaks was unavailable, and the complete GitLab history could not be scanned. This is a scoped archive review, not a security certification. Team/course documents retain their original attribution and provenance.
