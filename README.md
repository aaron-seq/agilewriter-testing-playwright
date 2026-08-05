# Automation Validation Tests

Playwright test suite for Agile Writer, plus a placeholder extractor for templates.

**Docs:** this file (setup & running) · [Adding tests](docs/ADDING_TESTS.md) · [How it works](docs/DEVELOPER.md)

---

## Setup — once

Node.js 18+ and Git.

```bash
npm install
npx playwright install
```

Copy `.env.example` to `.env` and fill in at least:

```env
MS_EMAIL=your-email@smarter.codes
MS_PASSWORD=your-password
BASE_URL=https://app-v2-rc1-aw.smarter.codes
```

That's enough for everything except health suites, which need their own
variables — see [Health suites](#health-suites).

---

## Running just one thing

**This is the section you want.** Nothing here runs the whole suite.

```bash
# One file
npx playwright test tests/template-format-health-reports/health_CSR.spec.ts

# One test inside a file, by name
npx playwright test -g "AW_03"

# One group
npx playwright test --project=unit

# See what WOULD run, without running it
npx playwright test tests/template-format-health-reports/health_CSR.spec.ts --list

# Watch it happen in a real browser
npx playwright test tests/template-format-health-reports/health_CSR.spec.ts --headed
```

### The flag that saves you 20 minutes

Browser tests depend on the `setup` project, which logs in by running all nine
AW_01–AW_10 tests first. When you already have a valid session and just want
your one test, skip it:

```bash
npx playwright test tests/components/admin_console.spec.ts --no-deps
```

`--no-deps` is safe once `playwright/.auth/user.json` exists. If it doesn't
exist yet, run `npx playwright test --project=setup` once to create it.

Groups that never need `--no-deps`, because they don't depend on login at all:
`unit`, `api`, `infrastructure`, `standalone`, `health`.

### Everything at once

```bash
npm test            # unit + api + infrastructure — ~1 min, no credentials
npm run test:py     # placeholder extractor — ~1 s
npm run test:e2e    # browser E2E — slow, needs .env and the live app
npm run test:health # all 7 health suites — hours
```

---

## The workflow

The order things actually happen in, and where each piece fits.

```
1. npm test                      Fast checks. Run this constantly.
                                 No browser, no login, no credentials.

2. npx playwright test            Logs in once, saves the session to
     --project=setup              playwright/.auth/user.json.
                                 Covers AW_01 to AW_10.

3. npx playwright test <file>     Your actual browser test. Reuses the
     --no-deps                    session from step 2.

4. npm run test:health            Full document generation against a live
                                  environment. Writes a DOCX report to
                                  sessions/<id>/.

5. npx playwright show-report     Open the last HTML report — screenshots,
                                  traces, timings.
```

Steps 1 and 2 are the loop you live in. Step 4 is what you run before a
release, or when someone asks "is the app healthy?".

---

## What the AW numbers mean

The AW numbers come from `AW HealthCheckUp features test case report.xlsx`
(sheet **HealthCheck Test**) and are the same numbers used in the test names.

| AW | Feature | Covered by |
|---|---|---|
| AW_01–02 | Login & Microsoft SSO authentication | `AW_00_10_consolidated_flow` |
| AW_03 | Client selection & SharePoint integration | `AW_00_10_consolidated_flow` |
| AW_04 | Agile Mapping access — Train Document page | `AW_00_10_consolidated_flow` |
| AW_05 | Generated file name validation | `AW_00_10_consolidated_flow` |
| AW_06–07 | Destination template pick & confirm | `AW_00_10_consolidated_flow` |
| AW_08–10 | Source selection, confirm, full preview | `AW_00_10_consolidated_flow` |
| AW_11 | Start Training → Generate Document page | `AW_11_to_20_*` |
| AW_12 | Sources tab & document preview | `AW_11_to_20_*` |
| AW_12B | Generation stages: Indexing → Finding Matches → Populating | `AW_11_to_20_*` |
| AW_13 | Mapping control panel opens | `AW_11_to_20_*` |
| AW_14 | Delete source from a placeholder | `AW_11_to_20_*` |
| AW_15 | Add source, select content, save | `AW_11_to_20_*` |
| AW_16 | Transform source content | `AW_11_to_20_*` |
| AW_17 | Update writing instruction | `AW_11_to_20_*` |
| AW_18 | Reset placeholder to original | `AW_11_to_20_*` |
| AW_19 | Create Final Doc + QA sheet | `AW_11_to_20_*` |
| AW_20 | Save & download | `AW_11_to_20_*` |

> The `Testing_data` sheet in that workbook numbers things differently
> (AW_13 = Apply All, AW_23 = Reset, up to AW_26). The **HealthCheck Test**
> sheet is the one the code follows. If you renumber, renumber the tests too.

---

## Which spec does what

Four specs cover overlapping ground on purpose — they differ in *where the
documents come from*.

| Spec | Covers | Picks its documents from |
|---|---|---|
| `AW_00_10_consolidated_flow.spec.ts` | AW_01–AW_10 | Nothing — it's login and navigation. Also writes the saved session every other browser test reuses. |
| `AW_11_to_20_manual_input.spec.ts` | AW_11–AW_20 | Whatever you name in `runtime-config.json` — a specific template, folder, tab, and source list. This is the UI path where a user types or picks the files. |
| `AW_11_to_20_QA_folder.spec.ts` | AW_11–AW_20 | Everything sitting in the QA folder (`runtimeConfig.folder`, default `QA Testing`) — both destination template and source documents. |
| `health_*.spec.ts` | A full generation run per format | `.env`, one suite per format (CSR, ICF Full, ICF Trimmed, Ideaya, M264). Writes a DOCX report. |

**Which do I run?**

- Testing a *specific* document combination → `AW_11_to_20_manual_input`
- Testing *whatever QA dropped in the folder* → `AW_11_to_20_QA_folder`
- Checking a format still works end to end → the matching `health_*`
- Changed login or navigation → `--project=setup`

`AW_11_to_20_manual_input` also writes a `health_<Name>.spec.ts` for you after
a successful run, with your choices hardcoded — that's how new health suites
get created.

### Configuring the manual-input run

Edit `runtime-config.json`:

```json
{
  "manualTemplateName":   "MyTemplate.docx",
  "manualTemplateFolder": "Folder/SubFolder",
  "manualTemplateTab":    "Clinical",
  "manualSourceFiles":    [{ "name": "Source1.docx", "folder": "Protocol" }],
  "useQaFolderForSources": false,
  "generatedScriptName":  "MyFormat"
}
```

Nested folder paths and Clinical / Non-Clinical tabs are both supported.

---

## Health suites

One full document-generation run per format, ending in a DOCX report.

```bash
npx playwright test --project=health --list   # what's available
npx playwright test tests/template-format-health-reports/health_CSR.spec.ts  # just one
```

Each needs its own `.env` variables. A missing one fails in about a second,
naming exactly what's absent:

```
[validateHealthEnv] Missing required env vars for 'csr': HEALTH_TEMPLATE_CSR, ...
```

| Suite | Variable prefix |
|---|---|
| CSR | `HEALTH_*_CSR` |
| ICF Full | `HEALTH_*_ICF_FULL` |
| ICF Trimmed | `HEALTH_*_ICF_TRIMMED` |
| Ideaya | `HEALTH_*_IDEAYA` |
| Ideaya Preflight | `HEALTH_*_IDEAYA_PREFLIGHT` |
| Ideaya PRODTEST CSR | `HEALTH_*_IDEAYA_PRODTEST_CSR` |
| M264 | `HEALTH_*_M264` |

`.env.example` lists every variable with its exact name.

### Reading the report

Written to `sessions/<sessionId>/` as a DOCX. It opens with the verdict, then
run details, then every failure with its screenshot name, then the full step
timeline.

| Verdict | Means |
|---|---|
| **PASSED** | Every step passed. |
| **COMPLETED WITH WARNINGS** | All critical steps passed — the flow works. Some non-blocking checks failed. |
| **FAILED** | A critical step failed. The result can't be trusted. |

**Playwright's `N passed` and the report can disagree, and that's correct.**
Playwright counts *tests*; the report counts *steps*. A run where nine soft
steps failed still prints `10 passed`, because no test threw. The console also
prints a step-level summary at the end of every run naming each failure — read
that, not just the Playwright line.

Zero steps recorded means it crashed before starting, which reports `FAILED`.

| Colour | Placeholder meaning |
|---|---|
| 🟢 Green | Replacement applied |
| 🔵 Blue | Match found, not applied |
| 🟡 Yellow | Still matching |
| ⬜ Grey | No match found |
| 🔴 Red | Replacement failed |

---

## Web runner

Run health checks from a browser instead of the CLI:

```bash
npm run server     # http://localhost:3000/ui
```

A four-step form: pick a script, pick an environment, name yourself, and — for
the manual-input run only — choose the documents. Each script shows what it
does, roughly how long it takes, and what it needs before you start it.

Leave **Environment** on *Default* to use `BASE_URL` from `.env`, and leave the
credentials section closed to use `MS_EMAIL` / `MS_PASSWORD` from `.env`. Both
only need touching when you want to override them.

A hosted instance exists too; ask your team lead for the URL.

---

## Checking AgileWriter's accuracy

Two files go into scoring, and they are not the same thing:

| | What it is | Where it comes from |
|---|---|---|
| **Reference file** | What the document *should* say | QA writes it |
| **Raw QA file** | What AgileWriter actually produced | AgileWriter's Excel export |

The Accuracy Scorer panel (`npm run server`) walks the whole job:

1. **Start a reference file from a template** - pulls every placeholder out of a
   `.docx` in `templates/`, expected text blank
2. **Fill in the expected text** - an editable grid; this is the answer key
3. **Check AgileWriter's document for gaps** - drop its final `.docx` into
   `generated_documents/` to find placeholders it never replaced
4. **Run Accuracy Score** - AgileWriter's Excel against your reference file

Step 3 is worth doing every time: a document can be marked *Final* and still
contain unreplaced placeholders.

```bash
npm run placeholders -- "templates/My Template.docx" --reference   # CLI
npm run test:py                                                    # 20 tests
```

See [placeholder_inventory/README.md](placeholder_inventory/README.md).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing required env vars for '<suite>'` | Add the named variables to `.env`. |
| `ENOENT: playwright/.auth/user.json` | Run `npx playwright test --project=setup` once. |
| Your one test drags in 9 login tests | Add `--no-deps`. |
| Login fails | Check `MS_EMAIL`, `MS_PASSWORD`, `BASE_URL`, and account access. |
| Browser won't launch | `npx playwright install` |
| `Health spec not found in validation map` | Register it — see [Adding tests](docs/ADDING_TESTS.md#4-adding-a-health-suite). |
| Health suite count changed | `npx playwright test tests/helpers/__tests__/healthIsolation.spec.ts` names the culprit. |

A test failing on a locator right after an unrelated soft step failed usually
means the app was left in a bad state, not that your test is wrong — see
`withDashboardReset` in `AW_00_10_consolidated_flow.spec.ts`.

When reporting a problem, include the suite name, environment, error message,
and the HTML report or trace.
