# What is This Document

Welcome! If you are reading this, you are likely looking to understand how we automatically verify that AgileWriter is working correctly. 

This walkthrough is designed to be your complete guide to the **Health Report Scripts**. Whether you are a product owner wanting to know what we test, a developer debugging a failure, or a QA engineer running the weekly checks, this document explains the *why*, *how*, and *what* of our health checks. You don't need to know how to code to understand this guide.

# Project Goals

AgileWriter is a powerful AI document generation platform. When a clinical research team uploads a template (like an Informed Consent Form) and source documents (like a Protocol), AgileWriter's AI reads them, finds placeholders (e.g., `<Sponsor's Name>`), and automatically fills them in. This saves hours of manual work.

Our goal with the automation suite is to **guarantee that this core engine never silently breaks.**

We built these health scripts to act like a tireless virtual user. Every week, this user logs in, uploads complex clinical documents, waits for the AI to do its job, and meticulously checks every single placeholder to ensure the AI found the right answers. By doing this automatically, we catch backend performance issues and AI mapping failures before they ever reach our real users.

# Why We Built Health Scripts

Imagine having to manually click through a 25-minute document generation process every single week just to make sure a server update didn't break anything. It is tedious, prone to human error, and expensive.

We built the Health Scripts so that we can run full, end-to-end tests across four distinct document types with zero human intervention. 

| Script | Document Type | Training Time | Template |
|--------|--------------|---------------|---------|
| `health_ICF_trimmed.spec.ts` | ICF Trimmed | ~5 min | `ICF_SET0_TRIMMED.docx` |
| `health_ICF_full.spec.ts` | ICF Full | ~15 min | `ICF_SET0.docx` |
| `health_CSR.spec.ts` | CSR | ~20 min | `CSR_Template_20FEB2026.docx` |
| `health_M264.spec.ts` | M264 | ~25 min | `2.6.4 Template_Test.docx` |

These scripts don't just check if the website is online. They simulate the *complete real user journey*: logging in, picking files, waiting for the AI to read them, checking the colors of the placeholders, and downloading the final Word document.

# How the System Works

To make this automation reliable, we split the code into different files, each with a specific job.

```
Agile Writer Test/
├── tests/
│   ├── health_ICF_trimmed.spec.ts     Entry point for ICF Trimmed health check
│   ├── health_ICF_full.spec.ts        Entry point for ICF Full health check
│   ├── health_CSR.spec.ts             Entry point for CSR health check
│   ├── health_M264.spec.ts            Entry point for M264 health check
│   ├── helpers/
│   │   ├── health-report-runner.ts    Shared engine — runs all 13 steps
│   │   ├── step-tracker.ts            Records every step to JSON in real time
│   │   ├── app-navigation.ts         openAgileMapping, dismissModalOverlay, etc.
│   │   ├── accuracy-scorer.ts         Mathematical scoring brain
│   │   ├── accuracy-report-writer.ts  Writes scored Excel + JSON output
│   │   └── reference-file-loader.ts   Reads reference "answer key" Excel files
├── reference_files/                   Answer key Excel files for accuracy scoring
├── raw_qa_files/                      Raw QA output files from AgileWriter runs
├── reports/
│   ├── step-results.json             Written during test — one entry per step
│   ├── accuracy/                     Accuracy scoring Excel + JSON output
│   ├── AgileWriter_Validation_Report.docx   Generated after test
│   └── screenshots/                  One screenshot per step
├── sessions/                          Session-scoped output (when run via the UI)
├── generate-word-report.js           Reads step-results.json, writes .docx
├── global-setup.js                   Cleans the reports/ folder before each run
├── .env                              Your local config (never committed to git)
├── .env.example                      Template for .env — commit this
└── playwright.config.js              Playwright configuration, globalSetup hook
```

Here is how the pieces fit together:
- The **Entry Point** files (like `health_ICF_full.spec.ts`) are the specific instructions for a single test. They say: *"Run a test using the ICF Full template."*
- The **Shared Engine** (`health-report-runner.ts`) is the muscle. It contains the actual code that knows how to click buttons and wait for screens to load.
- The **Step Tracker** (`step-tracker.ts`) is like a flight recorder on an airplane. As the shared engine clicks through the website, the step tracker immediately writes down what happened in `reports/step-results.json`. If the browser suddenly crashes, we still have a perfect record of everything that happened right up to the crash.

# The 13 Steps Every Health Script Runs

Every single health script executes the exact same 13 steps. Some steps are **Critical** (if they fail, the test stops immediately because it's impossible to continue). Other steps are **Soft** (if they fail, we record the failure, but we keep going to see what else might be broken).

**Step 1: Navigate to AgileMapping**
- **Type:** Critical
- **What it does:** Clicks the menu and opens the Train Document screen.

**Step 2: Enter output filename**
- **Type:** Critical
- **What it does:** Types a unique name for the generated document (e.g., `ICF_Trimmed_1714923456789`).

**Step 3: Select template document**
- **Type:** Critical
- **What it does:** Opens the SharePoint file picker, searches for the template file, checks the box, and clicks Select.

**Step 4: Select source documents**
- **Type:** Critical
- **What it does:** Repeats the file picker process for all required source documents.

**Step 5: Click Start Training**
- **Type:** Critical
- **What it does:** Clicks the big "Start Training" button to hand the files over to the AI.

**Step 6: Wait for the workspace to load**
- **Type:** Critical
- **What it does:** Waits until the "Create Final Doc" button becomes visible, proving the editor screen has loaded.

**Step 7: Wait for placeholders to appear**
- **Type:** Critical
- **What it does:** Looks at the document text and waits until it finds at least one placeholder block.

**Step 8: Wait for all 3 training stages to complete**
- **Type:** Critical
- **What it does:** Patiently waits for the backend to finish: Indexing Sources → Finding Placeholder Matches → Populating Placeholders.

**Step 9: Count placeholder colors BEFORE Apply All**
- **Type:** Soft
- **What it does:** Reads the background color of every placeholder on the screen to see how well the AI did on its first try. If this fails (e.g., a weird UI glitch), we can still continue to the next step.

**Step 10: Click Apply All and wait for the toast confirmation**
- **Type:** Critical
- **What it does:** Accepts the AI's suggestions and waits for the green success message.

**Step 11: Count placeholder colors AFTER Apply All**
- **Type:** Soft
- **What it does:** Reads the colors again. This proves that clicking "Apply All" actually changed the document state.

**Step 12: Click Create Final Document and wait for the review URL**
- **Type:** Critical
- **What it does:** Triggers the final document generation and waits for the download link to appear.

**Step 13: Download the generated document**
- **Type:** Critical
- **What it does:** Clicks the download link and saves the file to the computer.

# The Placeholder Color System

When the AI processes a document, it color-codes every placeholder so humans can quickly see what needs attention. Because our script cannot "read" the document like a human, it uses Playwright's `evaluateAll` feature to instantly scan the CSS background colors of every placeholder on the page.

Here is what the colors mean to the team, and how the automation identifies them:

| Color | CSS Value | Meaning |
|-------|-----------|---------|
| Green | `rgba(16, 185, 129, 0.2)` | **Replacement Done** — AI found and filled the value. |
| Grey | `rgba(156, 163, 175, 0.2)` | **Not Matched** — AI could not find a value. |
| Blue | `rgba(59, 130, 246, 0.18)` | **Match Found** — AI found a match but needs human review. |
| Red | `rgb(239, 68, 68)` | **Replacement Not Found** — matching completely failed. |
| Yellow | `rgba(246, 234, 59, 0.18)` | **Matching Pending** — still processing. |

By counting these colors, the health script provides a mathematical summary of the AI's performance (e.g., "70 Green, 4 Grey, 0 Red").

# Configuring Your Environment

Because every developer's computer is different, we use an `.env` file to store personal settings like your email, password, and the exact names of the files in SharePoint. 

**⚠️ Important:** Never commit your `.env` file to Git! It contains your password. We provide an `.env.example` file that you should copy and rename to `.env`.

Here are the variables required for the health scripts. If you misspell a filename here, the script will fail at Step 3 or Step 4, telling you it couldn't find the file in SharePoint.

```env
# ICF Trimmed
HEALTH_TEMPLATE_ICF_TRIMMED=ICF_SET0_TRIMMED.docx
HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED=Informed Consent Form
HEALTH_SOURCES_ICF_TRIMMED=Protocol Example (28Sep2023).docx
HEALTH_SOURCE_FOLDER_ICF_TRIMMED=Protocol
HEALTH_OUTPUT_PREFIX_ICF_TRIMMED=ICF_Trimmed

# ICF Full
HEALTH_TEMPLATE_ICF_FULL=ICF_SET0.docx
HEALTH_TEMPLATE_FOLDER_ICF_FULL=Informed Consent Form
HEALTH_SOURCES_ICF_FULL=Protocol Example (28Sep2023).docx
HEALTH_SOURCE_FOLDER_ICF_FULL=Protocol
HEALTH_OUTPUT_PREFIX_ICF_FULL=ICF_Full

# CSR
HEALTH_TEMPLATE_CSR=CSR_Template_20FEB2026.docx
HEALTH_TEMPLATE_FOLDER_CSR=CSR
HEALTH_SOURCES_CSR=Mock_CSR_Protocol.docx,Mock_CSR Key messages_with_heading.docx
HEALTH_SOURCE_FOLDER_CSR=CSR
HEALTH_OUTPUT_PREFIX_CSR=CSR_Test

# M264
HEALTH_TEMPLATE_M264=2.6.4 Template_Test.docx
HEALTH_TEMPLATE_FOLDER_M264=M264
HEALTH_SOURCES_M264=Absorption_PK Study in Dog.docx,Metabolism_Report.docx
HEALTH_SOURCE_FOLDER_M264=M264
HEALTH_OUTPUT_PREFIX_M264=M264_Test

# Report metadata
TESTER_NAME=Aaron, Inayathulla
TEST_ENV=QA
APP_URL=https://app-v2-rc1-aw.smarter.codes/signin
```

# Running a Health Script: Three Methods

There are three ways to run these tests, depending on your comfort level.

**Method A — The Browser UI (Easiest)**
This is a custom web interface built by Inayathulla.
1. Open your terminal and run `node server/test-runner-server.js`
2. Open your web browser and go to `http://localhost:3000`
3. The dropdown automatically lists all available scripts. Select `health_ICF_trimmed.spec.ts`.
4. Enter your Microsoft email and password.
5. Click **"Start Automation Run"**.
6. Watch the terminal stream directly in your browser. When it finishes, find the Word report at `reports/AgileWriter_Validation_Report.docx`.
7. **New (May 2026):** After the test completes, expand the **Accuracy Scorer** panel at the bottom of the UI to score the QA output against a reference file — see the section below.

**Method B — The Terminal (For Developers)**
This is the standard Playwright way to run tests.
1. Open your terminal in the `Agile Writer Test` folder.
2. Run the ICF Trimmed test (we recommend starting with this one because it only takes 5 minutes):
   ```bash
   npx playwright test tests/health_ICF_trimmed.spec.ts --headed
   ```
3. To generate the Word report after the run finishes, run:
   ```bash
   node generate-word-report.js
   ```

**⚠️ Important:** Never run two health scripts simultaneously in the terminal! It will crash the server and mix up your reports. Wait for one to finish before starting the next.

**Method C — VS Code Extension (For Debugging)**
1. In VS Code, install the extension named **Playwright Test for VSCode** by Microsoft.
2. Click the test tube icon in the left sidebar.
3. Expand the `tests/` folder and find `health_ICF_trimmed.spec.ts`.
4. Check the "Show browser" box at the bottom of the sidebar.
5. Click the green play button next to the test name to watch it run.
6. If the test fails, you can right-click it and select "Show trace" to open the powerful Trace Viewer.

# Reading the Word Report

After running a test and running `node generate-word-report.js`, you will find `AgileWriter_Validation_Report.docx` in your `reports/` folder. This is a human-readable receipt of the automation run.

Here is what you will find inside:
- **Header:** Shows who ran the test (`TESTER_NAME`), the date, the environment, the overall PASS/FAIL status, and exactly how long the whole suite took.
- **Document Sections:** Each script you ran (e.g., ICF Trimmed, CSR) gets its own section.
- **Step-by-Step Results:** You will see a table listing all 13 steps. Each step shows the exact time it started, how many seconds it took, and whether it Passed or Failed.
- **Critical vs Soft Failures:** If a critical step fails, it is highlighted heavily. Soft failures are noted but don't fail the overall test.
- **Placeholder Snapshots:** A table showing exactly how many Green, Grey, Blue, Red, and Yellow placeholders the AI produced, both before and after clicking "Apply All".

# Common Problems and How to Fix Them

If a test fails, don't panic! Check this list for the most common issues.

**Problem 1: Template file not found**
- **Symptom:** The terminal prints: `Error: Template file ICF_SET0_TRIMMED.docx not found in folder QA Testing.`
- **Root Cause:** The name of the folder in SharePoint changed, or you typed it wrong in the `.env` file. (For example, the UI now says "Informed Consent Form", not "QA Testing").
- **Fix:** Update `HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED` in your `.env` file to exactly match the folder name in SharePoint.

**Problem 2: Auth state expired**
- **Symptom:** The test opens the browser, but gets stuck staring at the Microsoft login page instead of bypassing it.
- **Root Cause:** Microsoft login sessions expire over time. The saved cookies in your `auth-storage/` folder are no longer valid.
- **Fix:** Run `node global-setup.js` in your terminal to log in freshly and save a new set of cookies.

**Problem 3: Stage 3 timeout (Populating Placeholders)**
- **Symptom:** The test fails and says it timed out waiting for the "Populating Placeholders" stage to finish.
- **Root Cause:** The source documents are very large, or the backend server is under heavy load, causing it to take longer than the script's strict timeout limit.
- **Fix:** Open the `.spec.ts` file and increase the `expectedTrainingMinutes` value.

**Problem 4: Mixed up test results**
- **Symptom:** The Word report looks chaotic, or `step-results.json` contains entries from two different test runs jumbled together.
- **Root Cause:** You tried to run two health scripts at the exact same time in different terminal windows.
- **Fix:** Only run one health script at a time. The step tracker writes to a single shared file. *(Note: When running from the browser UI, each run gets its own isolated session — see Session Isolation below.)*

<!-- ADDED May 2026 -->
# Session Isolation

As of May 2026 (Inayat's commit `89a02c7`), when you run a health script from the **browser UI**, each run is completely isolated.

Here is how it works:
- The server generates a unique `SESSION_ID` for each run.
- All output (step-results.json, screenshots, reports) is written to `sessions/<SESSION_ID>/` instead of `reports/`.
- This means you *can* run multiple tests concurrently from the UI without data collisions.
- When running from the **terminal** (without the UI), the old `reports/` behavior is unchanged.

The `SESSION_ID` environment variable is injected automatically by `test-runner-server.js`. You never need to set it manually.

<!-- ADDED May 2026 -->
# Accuracy Scoring — What Comes After a Health Script

A health script tells you whether the AI *ran correctly*. But did the AI *generate the right text?*

That is the job of the **Accuracy Scorer**. After a health script finishes and downloads the QA output, you can score it against a pre-approved answer key.

There are two ways to run the scorer:

**From the Browser UI:**
1. Run a health script from the UI (see Method A above).
2. Copy the downloaded QA Excel file into the `raw_qa_files/` folder.
3. Expand the **Accuracy Scorer** panel at the bottom of the UI.
4. Select your reference file and raw QA file from the dropdowns.
5. Click **Run Accuracy Score**.
6. The result card shows the overall accuracy percentage, per-type breakdown, and a download link for the full Excel report.

**From the Terminal:**
```bash
npx playwright test tests/accuracy.spec.ts --reporter=line
```

For a deep dive into how the scoring math works, how to adjust thresholds, and how to create reference files for new document types, see the **[Accuracy Checker Walkthrough](Accuracy_Checker_Walkthrough.md)**.

<!-- ADDED May 2026 -->
# Input Folders for Accuracy Scoring

Two folders support the accuracy scoring workflow:

| Folder | What Goes Here | Who Fills It |
|--------|---------------|--------------|
| `reference_files/` | Excel "answer keys" (e.g., `ref_ICF_Full.xlsx`). Contains the correct expected text for every placeholder. | Anil / Aaron |
| `raw_qa_files/` | The raw QA Excel output downloaded after an AgileWriter training run. | You (the tester) |

These folders are auto-created by the server on startup if they don't exist.

# Contacts and Ownership

If you need help or have questions, reach out to the right person:

- **Aaron Sequeira:** Health scripts, `.env` configuration, accuracy scorer, reference file loader, and this documentation.
- **Inayathulla:** The browser UI (`ui/index.html`), the Node server (`test-runner-server.js`), Playwright infrastructure, `generate-word-report.js`, and session isolation.
- **Anil:** Expected placeholder values, QA sign-off, reference file contents, and threshold calibration.

<!-- ADDED May 2026 -->
# Workflow A - Run from Terminal

**Prerequisites:** Node.js installed, `npm install` completed, Playwright browsers installed, and `.env` configured.

**Commands**
```bash
cd "C:\Users\Aaron Sequeira\Agile Writer Test"
npx playwright test tests/health_ICF_trimmed.spec.ts --project=smarter-tests
npx playwright test tests/health_ICF_full.spec.ts --project=smarter-tests
npx playwright test tests/health_CSR.spec.ts --project=smarter-tests
npx playwright test tests/health_M264.spec.ts --project=smarter-tests
```

**What you see:** Step-by-step console output, timestamps, and pass/fail per tracked step.

**Where results go:** `reports/step-results.json`, `reports/screenshots\`, and `reports/AgileWriterValidationReport.docx`.

<!-- ADDED May 2026 -->
# Workflow B - Run from VS Code

**Extension:** Playwright Test for VS Code (`ms-playwright.playwright`)

**How to run**
1. Open the **Testing** panel in VS Code.
2. Expand the `smarter-tests` project.
3. Find the health script you want to run.
4. Click the play button beside that script.

**Why teams use it:** You can watch steps highlight live in the editor while the browser is running.

<!-- ADDED May 2026 -->
# Workflow C - Run from the Server UI

**Start the server**
```bash
cd "C:\Users\Aaron Sequeira\Agile Writer Test"
node server/test-runner-server.js
```

**Open the UI**
- Browser URL: `http://localhost:3000/ui/`
- Select the health script from the dropdown.
- Fill in the runtime fields.
- Click **Start Automation Run**.

**Current status:** The health runner UI is live. It triggers Playwright through `child_process` and streams the log output into the browser in real time.

## Windows Path Fix for UI-Triggered Runs (Updated May 2026)
<!-- UPDATED May 2026 -->

When health scripts are triggered via the server UI on Windows, the Playwright command 
is built programmatically in `server/test-runner-server.js`. 

### The Problem
`path.join('tests', testFile)` on Windows produces `tests\health_CSR.spec.ts` with 
backslashes. Playwright treats CLI arguments as **regex patterns** — backslashes are 
regex escape characters, so `\h` and `\C` are invalid sequences. Playwright finds zero 
tests and exits with code 1: `Error: No tests found`.

### The Fix
```js
// Before (broken on Windows):
const testPath = path.join('tests', testFile);
spawn(`npx playwright test "${testPath}"`, ...)

// After (works on all platforms):
const testPath = `tests/${testFile}`;
spawn(`npx playwright test ${testPath}`, ...)
```
Forward slashes work universally in Playwright's path matching, even on Windows.

### Verification
After this fix, triggering `health_CSR.spec.ts` from the UI produces:
```
[Session] xxxx ready for fresh run.
Running Playwright tests: health_CSR.spec.ts...
✔ [CRITICAL][PASS] Navigate to sign-in page
✔ [CRITICAL][PASS] Complete Microsoft SSO login
... (all 10 steps pass)
```
Confirmed live: 18 tests passed, 7.7 minutes, Word report generated successfully.

<!-- ADDED May 2026 -->
# Accuracy Scoring Workflow

1. Run a health script using the terminal, VS Code, or the server UI.
2. Take the AgileWriter QA output Excel file and place it in `raw_qa_files\`.
3. Open `http://localhost:3000/ui/` and scroll to the **Accuracy Scorer** panel.
4. Select the matching reference file from the left dropdown.
5. Select the QA output file from the right dropdown.
6. Click **Run Accuracy Score**.
7. Review the overall accuracy, per-type breakdown, warnings, trend line, and download link.

<!-- ADDED May 2026 -->
# Session Isolation

**What changed:** Session mode writes outputs to `sessions\<SESSION_ID>\` instead of the shared `reports\` directory.

**Why it matters:** Two engineers can run browser-triggered tests at the same time without overwriting each other's `step-results.json` or screenshots.

**How to use it**
```env
SESSION_ID=aaron-icf-run-001
```

Leave `SESSION_ID` blank to keep legacy `reports\` behavior for terminal runs.

<!-- ADDED May 2026 -->
# Contact and Ownership Update

- Inayat Shaik Karaballa - `server\`, `generate-word-report.js`, session isolation, `global-setup.js`
- Aaron Sequeira - health scripts, accuracy scorer, `reference-file-loader.ts`, `step-tracker.ts`, documentation
