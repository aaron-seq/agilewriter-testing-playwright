# What is This Document

Welcome to the central hub for the AgileWriter Playwright Automation project.

If you are a new developer setting up the codebase, a product owner wanting a high-level view of our capabilities, or a QA engineer running your first automated test, you are in the right place. This handbook covers the complete test suite from zero to finished report.

# Part 0 — Purpose and Objectives of This Handbook

The AgileWriter automation suite is a collection of scripts that automatically control a real web browser. It simulates a human user logging in, picking files, waiting for the AI to train, and verifying the outputs.

Our core objectives are:

1. **Eliminate Repetitive QA:** Automate the tedious, 25-minute end-to-end testing of document formats so humans don't have to do it manually.
2. **Guarantee Reliability:** Run weekly checks to ensure the backend servers and AI engine never silently degrade.
3. **Automate Grading:** Use mathematical scoring to pre-grade the AI's generated answers, drastically speeding up manual QA review times.

By reading this handbook, you will understand exactly how to install the project, what the code is testing, and how to trigger the different test pipelines.

Because this project is vast, this handbook acts as a high-level map. For deep dives into specific topics, it links out to two highly detailed walkthroughs:

- **[Health Report Walkthrough](Health_Report_Walkthrough.md)** — For a deep dive into how we simulate the user journey and read placeholder colors.
- **[Accuracy Checker Walkthrough](Accuracy_Checker_Walkthrough.md)** — For a deep dive into how we mathematically grade the AI against an answer key.

# Part 1 — Repository Map

The codebase is split into several distinct areas. Here is what every file does and who owns it:

```
Agile Writer Test/
├── tests/
│   ├── AW_00_10_consolidated_flow.spec.ts    AW01–AW10: Tests Login through source selection. (Owner: Aaron)
│   ├── AW_11_to_20_QA_folder.spec.ts         AW11–AW20: Training and doc generation using QA folder defaults. (Owner: Aaron)
│   ├── AW_11_to_20_manual_input.spec.ts      AW11–AW20: Training with manually specified files. (Owner: Aaron)
│   ├── health_ICF_trimmed.spec.ts            Health: Tests ICF Trimmed in 5 min. (Owner: Aaron)
│   ├── health_ICF_full.spec.ts               Health: Tests ICF Full in 15 min. (Owner: Aaron)
│   ├── health_CSR.spec.ts                    Health: Tests CSR in 20 min. (Owner: Aaron)
│   ├── health_M264.spec.ts                   Health: Tests M264 in 25 min. (Owner: Aaron)
│   ├── accuracy.spec.ts                      Entry point for the accuracy mathematical scorer. (Owner: Aaron)
│   └── helpers/
│       ├── app-navigation.ts                 Helper to open AgileMapping and dismiss overlays. (Owner: Aaron)
│       ├── health-report-runner.ts           Shared execution engine for all 4 health scripts. (Owner: Aaron)
│       ├── step-tracker.ts                   Step recording, screenshots, and JSON persistence. (Owner: Aaron)
│       ├── training-setup.ts                 Helper for template and source selection file pickers. (Owner: Aaron)
│       ├── reference-file-loader.ts          Helper that reads reference Excel "answer keys". (Owner: Aaron)
│       ├── accuracy-scorer.ts                Math brain: Dice-coefficient scoring per placeholder type. (Owner: Aaron)
│       └── accuracy-report-writer.ts         Writes the 8-sheet Excel and JSON accuracy outputs. (Owner: Aaron)
├── reference_files/
│   └── ref_ICF_Full.xlsx                     Answer key for ICF Full placeholders (74 rows). (Owner: Anil/Aaron)
├── raw_qa_files/                              Drop your QA Excel output here after each run. (Owner: You)
├── reports/                                  All output lives here (gitignored automatically).
│   ├── step-results.json                     Live tracking of script execution.
│   ├── accuracy/                             Accuracy scoring Excel + JSON reports.
│   ├── AgileWriterValidationReport.docx      Final generated Word report.
│   └── screenshots/                          Failure and state screenshots.
├── sessions/                                  Session-scoped output (one folder per UI-triggered run).
├── ui/
│   └── index.html                            Browser UI for triggering tests and accuracy scoring. (Owner: Inayathulla/Aaron)
├── server/
│   └── test-runner-server.js                 Node server: receives UI requests, spawns Playwright, runs scoring. (Owner: Inayathulla/Aaron)
├── generate-word-report.js                   Converts step-results.json to the final .docx report. (Owner: Inayathulla)
├── global-setup.js                           Logs in, saves cookies, cleans reports/ before tests. (Owner: Inayathulla)
├── bootstrap-reference.js                   Creates blank reference Excel keys from existing QA reports. (Owner: Aaron)
├── playwright.config.js                     Playwright config tying it all together. (Owner: Inayathulla)
├── .env                                     Your local credentials (never commit this!). (Owner: You)
├── .env.example                             Template for the .env file — commit this. (Owner: Aaron)
└── package.json                             Node dependencies (@playwright/test, xlsx, etc). (Owner: Inayathulla)
```

# Part 2 — First-Time Setup

If you are setting this up on a brand new machine, follow these exact steps in order.

**1. Clone the repository and install dependencies:**
Open your terminal and run:

```bash
git clone <repo-url>
cd "Agile Writer Test"
npm install
```

**2. Install Playwright browsers:**
Playwright needs its own clean versions of Chrome, Firefox, and Safari to run headless tests.

```bash
npx playwright install --with-deps
```

**3. Set up your personal credentials:**
We never store passwords in Git. Copy the template configuration file:

```bash
cp .env.example .env
```

Open the newly created `.env` file in your editor and fill in your Microsoft `EMAIL` and `PASSWORD`.

**4. Generate your authentication cookies:**
Instead of logging in on every single test, we log in once and save the session cookie.

```bash
node global-setup.js
```

*Note: If tests start failing at the login screen days later, your session expired. Just run this command again.*

**5. Verify your setup:**
Check that you didn't introduce any TypeScript errors.

```bash
npx tsc --noEmit
```

This command should finish silently with 0 errors. If it does, you are fully set up!

# Part 3 — The Test Suite Overview

Our testing code is divided into three distinct categories. The first category is the **Consolidated Flow (AW00-AW20)**.

Before AgileWriter generates a document, the user has to click through a lot of UI: navigating the sidebar, opening file pickers, searching SharePoint, and clicking checkboxes.

The scripts named `AW_00_10_consolidated_flow.spec.ts` and `AW_11_to_20_...` are highly granular UI tests. They verify that every single button click, folder expansion, and navigation element works exactly as expected. We run these specific scripts before any major release to ensure the core user interface isn't broken.

# Part 4 — Health Report Scripts

The second category of our test suite is the **Health Reports**.

While the consolidated flow tests the UI, the Health Scripts test the *AI Engine*. They execute a full 25-minute document generation run for specific, high-priority document formats (ICF Trimmed, ICF Full, CSR, M264). They then read the colors of the resulting placeholders to prove the AI successfully found the content.

To fully understand how these 13-step scripts work, how to configure their `.env` variables, and how to read their final Word document output, please read the **[Health Report Walkthrough](Health_Report_Walkthrough.md)**.

# Part 5 — Accuracy Scorer

The third category is the **Accuracy Scorer**.

After a Health Script finishes, how do we know the text the AI put into the placeholder is actually medically correct? A human QA engineer checks it.

The Accuracy Scorer is a mathematical tool that automates this human check. It compares the AI's output against a pre-approved "Answer Key" and generates an 8-sheet Excel document grading the AI's accuracy using a formula called the Dice Coefficient.

To understand how the math works, how to create an Answer Key, and how to adjust the passing grades, please read the **[Accuracy Checker Walkthrough](Accuracy_Checker_Walkthrough.md)**.

<!-- ADDED May 2026 -->

## Running the Scorer from the Browser UI

The server UI at `http://localhost:3000/ui/` now includes an **Accuracy Scorer** panel at the bottom of the page. This is the recommended way for non-developers to run accuracy scoring:

1. Drop your reference file into `reference_files/`.
2. Drop your raw QA output into `raw_qa_files/`.
3. Open the UI, expand the Accuracy Scorer section, select your files, and click **Run Accuracy Score**.
4. The result card shows overall accuracy, per-type breakdown, and a download link for the full Excel report.

# Part 6 — The Reporting Pipeline

How do we actually get the nice Word document report after a test runs? It is a two-step pipeline.

**Step 1: The Step Tracker**
While a test is actively running, a helper file called `step-tracker.ts` acts like a flight recorder. Every time a test clicks a button or checks a color, the step tracker immediately writes a timestamped record to `reports/step-results.json`. It does this in real-time so that if the server crashes, we don't lose the logs.

**Step 2: The Report Generator**
After the test is completely finished, you run a secondary script: `node generate-word-report.js`. This script opens `step-results.json`, converts all those JSON records into a beautifully formatted HTML table, and then converts that HTML into a `.docx` file using the `html-to-docx` library.

The final file is saved to `reports/AgileWriterValidationReport.docx`.

# Part 7 — Running Tests

Here are the commands to run the different parts of the test suite from your terminal.

**⚠️ Important:** Never run two Playwright tests simultaneously. It places massive load on the backend servers and will overwrite the `reports/step-results.json` file, destroying both reports. *(Note: When running via the browser UI, session isolation prevents this. See below.)*

<!-- ADDED May 2026 -->

**Session Isolation (May 2026):** When you run tests from the browser UI, each run gets a unique `SESSION_ID`. All output goes to `sessions/<SESSION_ID>/` instead of `reports/`. This means concurrent runs from the UI no longer collide. Terminal runs still use the legacy `reports/` directory.

**Running the UI Checks (Category 1)**

```bash
npx playwright test tests/AW_00_10_consolidated_flow.spec.ts --headed
```

**Running Health Scripts (Category 2)**

```bash
# Run the fastest health check
npx playwright test tests/health_ICF_trimmed.spec.ts --headed

# Always generate the Word report after a health check finishes
node generate-word-report.js
```

**Running the Accuracy Scorer (Category 3)**

```bash
# Runs the scorer using the default ICF Full files
npx playwright test tests/accuracy.spec.ts --reporter=line
```

# Part 8 — Branching and Committing

We use a strict Git workflow.

- **Target Branch:** All Pull Requests merge into the `main` branch.
- **Working Branch:** When doing active development, branch off main (e.g., `enhanced-automation-tests`).
- **Remotes:** We push code to both Bitbucket (`bitbucket`) and GitHub (`github`) to keep the repositories synchronized.

**Commit Conventions**
Every commit message must be properly prefixed:

- `feat: added new accuracy table` (For new features)
- `fix: resolved timeout on CSR script` (For bug fixes)
- `docs: updated handbook` (For documentation)

**The Golden Rule:** Before you commit, you must run `npx tsc --noEmit`. If it shows anything other than `0 errors`, you are not allowed to push your code.

# Part 9 — Contacts and Ownership

If you have questions about specific parts of the project, reach out to the relevant owner:

- **Inayathulla** — The browser UI (`ui/index.html`), the Node test runner server, Playwright configuration, `generate-word-report.js`, and session isolation.
- **Aaron Sequeira** — All test specifications (AW00-20, Health Scripts, Accuracy Scorer), `.env` configuration, accuracy scoring UI panel, and this handbook.
- **Anil** — Expected placeholder values, QA sign-off, reference file contents, and threshold calibration.

<!-- ADDED May 2026 -->

# Part 10 — File Drop Guide

If you are a non-developer who just wants to use the system, here is where to put your files:

| Folder               | What Goes Here                                                                                                   | When                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `reference_files/` | Your Excel "answer key" file. Contains the correct expected text for every placeholder.                          | Once, when Anil approves the reference.     |
| `raw_qa_files/`    | The QA Excel file downloaded after each AgileWriter training run.                                                | After every training run you want to score. |
| `reports/`         | **Do not touch.** Automatically filled by the system with Word reports, screenshots, and accuracy reports. | Never — read only.                         |
| `sessions/`        | **Do not touch.** Automatically filled by the server for each UI-triggered run. Cleaned up after 1 hour.   | Never — read only.                         |

When in doubt, open the server UI at `http://localhost:3000/ui/` and use the dropdowns — they will automatically show all files in the correct folders.

<!-- ADDED May 2026 -->

# Part 10 - File Drop Guide (for Product Users and Product Owners)

This section is for non-developers. No code is required.

**Where to put your files**

- `reference_files\` - your answer key Excel file. One per document type such as ICF, CSR, or M264.
- `raw_qa_files\` - the QA output file downloaded after an AgileWriter training run.
- `reports\` - do not touch. The system writes here automatically.
- `reports\accuracy\` - generated accuracy report Excel files land here after scoring.

**Step-by-step**

1. Ask the test engineer to run the health script for your document type.
2. When the run finishes, get the QA output Excel file from them.
3. Drop it into `raw_qa_files\`.
4. Open `http://localhost:3000/ui/` in your browser.
5. Scroll to the Accuracy Scorer panel.
6. Select your reference file from the left dropdown and the QA file from the right dropdown.
7. Click **Run Accuracy Score**.
8. View results on screen or download the Excel report.

<!-- ADDED May 2026 -->

# Part 11 - Session Isolation (for Developers)

**What:** Each UI-triggered test run writes to `sessions\<SESSION_ID>\` instead of `reports\`.

**Why:** Two engineers can run tests at the same time without overwriting each other's `step-results.json`.

**How to enable**

```env
SESSION_ID=aaron-csr-may05
```

**How to disable:** Leave `SESSION_ID` blank or remove it from `.env` to fall back to the legacy `reports\` path.

<!-- ADDED May 2026 -->

# Part 12 - Updated Repo Map

```text
tests/
  health_ICF_trimmed.spec.ts    - ICF Trimmed health script (Clinical tab)
  health_ICF_full.spec.ts       - ICF Full health script (Clinical tab)
  health_CSR.spec.ts            - CSR health script (Clinical tab, 129 placeholders)
  health_M264.spec.ts           - M264 health script (Non-Clinical tab)
  helpers/
    health-report-runner.ts     - shared runner for all 4 scripts
    app-navigation.ts           - MutationObserver toast fix, navigation helpers
    step-tracker.ts             - trackStep, trackSoftStep, color counting
    training-setup.ts           - training configuration helpers
    accuracy-scorer.ts          - scoring engine (5 placeholder types)
    accuracy-report-writer.ts   - Excel + JSON report generator
    reference-file-loader.ts    - loads reference .xlsx into a Map
server/
  test-runner-server.js         - Express server (health runner + accuracy scorer routes)
ui/
  index.html                    - Web UI (test runner panel + accuracy scorer panel)
  script.js                     - Browser-side logic for runner + scoring UI
reference_files/                - answer key .xlsx files
raw_qa_files/                   - AgileWriter QA output dropped here before scoring
reports/
  step-results.json             - real-time step log (written during test run)
  screenshots/                  - one PNG per step
  accuracy/                     - accuracy Excel + JSON reports
  AgileWriterValidationReport.docx - Word report generated by generate-word-report.js
sessions/
  <SESSION_ID>/                 - per-run isolated output
```

## Known Windows Gotcha: Server Path Separator (Updated May 2026)

<!-- UPDATED May 2026 -->

If you run the server on Windows and trigger a test from the UI and see:

```
Error: No tests found. Make sure that arguments are regular expressions matching test files.
Playwright exited with code: 1
```

This is caused by `path.join()` using backslashes on Windows, which break Playwright's
regex-based file matching. The fix is already applied in `server/test-runner-server.js`
(line 454). If you ever re-encounter this after a merge or rebase, check that line reads:

```js
const testPath = `tests/${testFile}`;
```

NOT:

```js
const testPath = path.join('tests', testFile);
```
