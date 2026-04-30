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
│   │   └── app-navigation.ts         openAgileMapping, dismissModalOverlay, etc.
├── reports/
│   ├── step-results.json             Written during test — one entry per step
│   ├── AgileWriter_Validation_Report.docx   Generated after test
│   └── screenshots/                  One screenshot per step
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
- **Fix:** Only run one health script at a time. The step tracker writes to a single shared file.

# Contacts and Ownership

If you need help or have questions, reach out to the right person:

- **Aaron Sequeira:** Health scripts, `.env` configuration, this documentation, and the accuracy scorer.
- **Inayathulla:** The browser UI (`ui/index.html`), the Node server, Playwright infrastructure, and the `generate-word-report.js` code.
- **Anil:** Expected placeholder values, QA sign-off, and reference file contents.
