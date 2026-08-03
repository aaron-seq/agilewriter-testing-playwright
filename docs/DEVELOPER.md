# How it works

Reference for people changing this repo. For setup see the
[README](../README.md); to add a test see [Adding tests](ADDING_TESTS.md).

---

## Layout

```
tests/            Playwright specs
  helpers/        shared logic — navigation, step tracking, scoring
  helpers/__tests__/  unit tests for those helpers
  infrastructure/ tests for deploy.sh / develop.sh
  integration/    Docker-dependent tests
  diagnostics/    one-off debugging scripts, no assertions
  fixtures/       frozen .xlsx inputs for unit tests
utils/            validateHealthEnv, GCS uploader (+ __tests__)
server/           Express web runner (+ __tests__)
ui/               static dashboard served at /ui
scripts/          manual smoke script for the accuracy routes
reference_files/  expected-value workbooks for accuracy scoring
raw_qa_files/     app-produced QA workbooks to score
runtime-config.ts env → typed config for health suites
generate-word-report.js  step results → DOCX
```

Generated at runtime and gitignored: `reports/`, `sessions/`, `test-results/`,
`playwright-report/`, `playwright/.auth/`.

---

## Test projects

`playwright.config.js` defines seven projects. The split exists so that a test
which doesn't need a browser never triggers the login flow.

| Project | Matches | Depends on `setup` |
|---|---|---|
| `setup` | `AW_00_10_consolidated_flow.spec.ts` | — |
| `unit` | any `__tests__/*.spec.ts` | no |
| `api` | `tests/api/` | no |
| `infrastructure` | `tests/infrastructure/` | no |
| `standalone` | `accuracy.spec.ts`, `integration/` | no |
| `health` | `health_*.spec.ts` | no |
| `diagnostics` | `tests/diagnostics/` | no |
| `smarter-tests` | everything else | **yes** |

Only `smarter-tests` declares `dependencies: ['setup']`. Everything excluded
from it is listed once in the `NON_E2E` regex at the top of the config — add a
category there and to a project, not in several places.

Two failure modes this prevents, both of which have happened:

- Health specs used to match `smarter-tests`, so every health run first
  executed the 9-test login flow — 10–20 minutes of overhead. Worse, if that
  flow failed after retries, Playwright silently *skipped* all health suites
  via the dependency mechanism, with no actionable error.
- `utils/__tests__/gcs-uploader.spec.ts` fell through to `smarter-tests` for
  the same reason, so eight assertions about environment variables were
  launching a browser and logging into the app.

`tests/helpers/__tests__/projectIsolation.spec.ts` and `healthIsolation.spec.ts`
guard this by shelling out to `npx playwright test --list` and asserting what
lands where. They run in `npm test`.

---

## Soft steps and UI state

`trackStep()` fails the test. `trackSoftStep()` records the failure and lets
the test continue. The rule in its docstring is "if this fails, can the NEXT
step still run?"

That rule is about the *test function* continuing — it says nothing about the
*page*. A soft step that throws half-way through opening a drawer leaves that
drawer open on top of the dashboard. The next line clicks a tab the drawer is
covering, times out after 30 s, and reports a hard failure with a locator error
that has nothing to do with the real cause. One soft failure, one confusing
hard failure, several lines apart.

`withDashboardReset()` in `AW_00_10_consolidated_flow.spec.ts` wraps
dashboard-scoped blocks in a `try/finally` that always returns home, so the
soft failure stays soft.

**It is deliberately not built into `trackSoftStep()`.** Soft steps are also
used inside the training workspace — `health-report-runner.ts` colour counts,
and the Apply All / stage-monitoring steps in `AW_11_to_20_*`. Navigating home
from there abandons a 20–45 minute training run. Recovery has to stay opt-in,
applied only where the block starts and ends on the dashboard.

---

## Authentication

The `setup` project logs in through Microsoft SSO once and saves the session to
`playwright/.auth/user.json` (gitignored). `smarter-tests` and `diagnostics`
load it via `storageState`.

Health suites deliberately don't depend on `setup`. They call `openDashboard()`
in `tests/helpers/app-navigation.ts`, which detects a dead session and recovers
it in place.

> Never commit an auth state file. It contains live `login.microsoftonline.com`
> session cookies — anyone with the file is logged in as you. One was
> previously committed at `tests/playwright/.auth/user.json`; it has been
> removed, and the credential it held should be treated as compromised.

---

## A health run

`health_*.spec.ts` → `runHealthReport()` in `tests/helpers/health-report-runner.ts`.

1. `validateHealthEnv('<key>')` fails fast, listing every missing variable, so
   a 45-minute run doesn't die 20 minutes in on a typo.
2. `initTracker()` starts a step log.
3. The runner drives the app: pick template → pick sources → train → wait for
   placeholder replacement → generate documents.
4. Each step goes through `trackStep()` / `trackSoftStep()`, which record
   status, duration and screenshots. Soft steps record a failure without
   aborting the run.
5. `saveResults()` writes `sessions/<id>/step-results.json`.
6. `generate-word-report.js` turns that into a DOCX, and uploads to GCS if
   `GCS_BUCKET` and `GOOGLE_APPLICATION_CREDENTIALS` are set.

`summarizeSteps()` returns `FAIL` for an empty step array — zero steps means
the run crashed before recording anything, which is not a pass.

Report generation is written to survive its own failures: DOCX and manifest are
written to `.tmp` then renamed, a failed rename is reported as
`partial_output_present` rather than lost, and an unwritable session directory
falls back to `os.tmpdir()/agility-reports`.

---

## Accuracy scoring

Separate from health. Compares what the app produced against a hand-checked
reference workbook.

`raw_qa_files/*.xlsx` (app output) + `reference_files/*.xlsx` (expected)
→ `loadReferenceFile()` → `scoreAll()` → `generateReport()`
→ `reports/accuracy-report-<timestamp>.{xlsx,json}`

Placeholders score as Match / Partial Match / No Match / Skipped / Missing
Reference, broken down by type (KeyValue, Paragraph, List, Table, Unknown).

Run it with `npx playwright test tests/accuracy.spec.ts`. Override the inputs
with `ACCURACY_RAW_QA_PATH`, `ACCURACY_REF_PATH` and `ACCURACY_OUTPUT_DIR`.

If most rows come back "Missing Reference", you've almost certainly paired a
raw file and a reference file for different document types — the test warns
about this on stderr before it scores.

---

## Web runner

`server/test-runner-server.js` (Express) serves `ui/` at `/ui` and spawns
Playwright as a child process.

| Route | Purpose |
|---|---|
| `GET /list-tests` | health suites available to the dropdown |
| `POST /run-test` | validate env, then spawn a run |
| `GET /stream` | server-sent events for live output |
| `GET /download-report` | the generated DOCX |
| `GET /api/env-status` | which suites are configured (used by health checks) |
| `POST /api/accuracy/score` | score a raw file against a reference |
| `GET /api/accuracy/{reference-files,raw-qa-files,results,watch}` | accuracy file management |

`POST /run-test` calls `getMissingHealthEnvVars()` first and returns `400`
before spawning anything, so a misconfigured suite fails in a second instead of
starting a 45-minute run that can't succeed.

These routes are covered by `tests/api/server-routes.spec.ts`, which starts its
own server on port 3399 and exercises the read-only routes plus the validation
paths. See [Adding tests](ADDING_TESTS.md#3-api-tests) — in particular the rule
about never letting a test reach a route that starts real work.

`npm run smoke:accuracy` exercises the accuracy routes against a running
server. It needs `npm run server` in another terminal.

### The config-merge trap

The server writes the UI's whole POST body to `sessions/<id>/runtime-config.json`,
and `runtime-config.ts` does `{ ...defaults, ...overrides }`. **Any key the UI
sends wins over `.env` — including empty strings and stale hardcoded values.**

Two live bugs came from exactly this, both fixed:

- The UI hardcoded `baseUrl` to the QA host on every request, so it beat
  whatever the Environment dropdown said. Picking Dev/Sandbox/Prod ran against
  QA anyway. The server compounded it by exporting the override as `BASEURL`,
  which nothing reads — `playwright.config.js` and `runtime-config.ts` both
  read `BASE_URL`.
- The empty Email/Password fields sent `''`, overriding `MS_EMAIL` and
  `MS_PASSWORD` from `.env` with nothing.

The rule: **the UI must omit a key entirely rather than send a blank or assumed
value for it.** `runTest()` in `ui/script.js` spreads keys in conditionally for
this reason. Do the same for anything you add.

---

## Benchmarking automation

`benchmarking_automation/` is a self-contained Python project: parse a `.docx`
into a canonical tree, classify placeholders, resolve replacements, and report
accuracy. It shares no code with the Playwright suite.

```
doc_parser/              docx XML → canonical tree
classification/          placeholder type rules (structural + syntax)
placeholders/            detection and context extraction
replacement_resolution/  match placeholders to source content
replacement_extraction/  build replacement fragments
reporting/               xlsx + json output
app/                     pipeline entry points
main.py                  classification pipeline runner
```

Setup and run are in [Adding tests](ADDING_TESTS.md#5-adding-a-benchmarking-test);
`npm run test:py` is the shortcut once the venv exists. 100 tests, ~5 seconds.

`requirements.txt` pins direct dependencies only — `lxml`, `openpyxl`,
`python-docx`, `pytest`. It used to be a `pip freeze` dump in UTF-16, which pip
cannot read, and it was missing `python-docx` entirely, so one test failed on a
clean install.

Generated output (`output/`, `final_outputs/`,
`tests/output/generated_document_tree.json`) is gitignored — it was ~3 MB of
committed build artifacts. Regenerate with `python main.py` and
`python tests/doc_parser/generate_document_tree_json.py`.

`tests/ICF_docx/` is 2.6 MB of source documents used only by the manual
`run_document_replacement_pipeline.py` and `compare_accuracy*.py` scripts, not
by any test. It's kept because those inputs can't be regenerated — delete it
only if you're also retiring those scripts.

---

## Deployment

```bash
./develop.sh up|down|status          # local stack, docker-compose.local.yml
./deploy.sh validate|deploy|rollback # production, docker-compose.production.yml
```

`deploy.sh validate` fails closed: missing compose file, missing production env
values, invalid nginx proxy config, or absent Docker all abort before anything
changes. `rollback` refuses to run when no known-good state was recorded.

The two compose files are deliberately separate — `deploy.sh` will not accept
the local one. `tests/infrastructure/deploy.spec.ts` asserts that.

---

## Maintenance

### Repository size — done, and the part that isn't

History was rewritten with `git filter-repo` to strip `test-results/` (409 MB
of committed Playwright `trace.zip`, largest single blob 70 MB),
`playwright-report/` (19 MB), and two committed Microsoft SSO cookie jars
(`playwright/.auth/user.json` and `tests/playwright/.auth/user.json`).

**Result: a fresh clone is 5 MB, down from 377 MB. All 222 commits kept.**

What a rewrite does *not* do is shrink the number Bitbucket displays. Bitbucket
retains the now-unreachable objects until its own GC runs, which a force-push
doesn't trigger — it still reports ~800 MB. Nothing is left to purge on the
client; verify with:

```bash
git clone --mirror <repo-url> /tmp/size-check && du -sh /tmp/size-check
```

If that comes back ~5 MB, the repository is clean and the server-side figure is
storage accounting, not something anyone downloads. Reclaiming it needs either
an Atlassian support ticket asking them to GC the repo, or deleting and
recreating it — which permanently destroys every pull request, review comment,
branch permission and webhook. Back up first:

```bash
git clone --mirror <repo-url> ../avt-clean-backup.git   # restore with: git push --mirror <new-url>
```

Rotate the Microsoft account credentials that were in the committed auth files.
Removing a cookie from history does not invalidate a session already handed out.

### The AW_11_to_20 variants

Two remain, and they differ only in where the documents come from:

- `AW_11_to_20_QA_folder.spec.ts` — everything in the QA folder
  (`runtimeConfig.folder`, default `QA Testing`). Covers AW_11–AW_20.
- `AW_11_to_20_manual_input.spec.ts` — the specific template, folder, tab and
  sources named in `runtime-config.json`. Covers AW_11–AW_20 and writes a
  `health_<Name>.spec.ts` afterwards.

A third, `AW_11_to_20.spec.ts`, was deleted. Despite the name it stopped at
AW_12B, used none of the shared helpers (no step tracking, so it produced no
report), and re-implemented the Microsoft login instead of reusing the saved
`storageState` — the one file that would have broken if the auth pattern
changed. `AW_11_to_20_QA_folder.spec.ts` is a strict superset of what it did.

The two survivors still share substantially copied bodies. Merging them needs
credentials and a live environment to verify, so it hasn't been attempted.
Don't add a third variant — parameterise one of these instead.
