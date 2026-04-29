# AgileWriter Automation Handbook

This handbook is designed for anyone who needs to run or understand the AgileWriter test suite, even if you have zero prior experience with Playwright or coding.

## ── SECTION 1: What Is This Suite? ───────────────────────

The AgileWriter automation suite is a collection of scripts that automatically control a web browser. 

It does the following completely automatically:
- Logs into AgileWriter using saved credentials.
- Searches for and selects document templates from SharePoint.
- Searches for and selects source documents from SharePoint.
- Runs the AgileWriter training process (Indexing, Matching, Populating).
- Verifies that the AI successfully populated the document placeholders by checking their colours.
- Generates a final Word document report.

**No manual clicking is required once the script is running.** The suite is designed for both recurring weekly health checks (to ensure AgileWriter is working correctly) and for one-off testing of new document formats.

## ── SECTION 2: Installation Guide ────────────────────────

If you are setting this up on a brand new machine, follow these steps in order:

1. **Install Node.js** (v18 or higher) — download from [https://nodejs.org](https://nodejs.org)
2. **Clone the repository:**
   Open a terminal and run:
   ```bash
   git clone [repo URL]
   cd "Agile Writer Test"
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Install Playwright browsers:**
   ```bash
   npx playwright install --with-deps
   ```
5. **Set up credentials:**
   - Copy the `.env.example` file and rename the copy to `.env`
   - Open the `.env` file and fill in your details: `BASE_URL`, `EMAIL`, and `PASSWORD`.
6. **Verify setup:**
   Run the following command to check that everything is correctly installed:
   ```bash
   npx tsc --noEmit
   ```
   *This should show 0 errors. If it does, you're ready to go!*

## ── SECTION 3: How Playwright Works (Simple English) ─────

Playwright is a tool that controls a real web browser automatically.

- It can click buttons, type text into boxes, wait for screens to load, and check that the right content appears on the screen.
- We use it to simulate a real human user going through AgileWriter step by step. It moves much faster than a human, but performs the exact same actions.
- Tests are written in code files called TypeScript (they end in `.spec.ts`).
- When a test finishes, the results are saved automatically as JSON logs and easy-to-read Word reports.

## ── SECTION 4: The 6 Test Scripts — What Each One Does ──

We have 6 main scripts in the suite. Here is what they do and when you should run them:

| Script | What it does | When to run |
|--------|-------------|-------------|
| `AW_00_10_consolidated_flow.spec.ts` | Tests login, navigation, file picker, and pre-training UI | Before any major release |
| `AW_11_to_20_QA_folder.spec.ts` | Full training run using the QA Testing folder — automatic file selection | Regular smoke testing |
| `AW_11_to_20_manual_input.spec.ts` | Full training run where you specify your own files — generates a reusable script at the end | New document formats |
| `health_ICF_trimmed.spec.ts` | Health check for ICF Trimmed format — fully automatic | Weekly health check |
| `health_ICF_full.spec.ts` | Health check for ICF Full format — fully automatic | Weekly health check |
| `health_CSR.spec.ts` | Health check for CSR format — fully automatic | Weekly health check |
| `health_M264.spec.ts` | Health check for M264 format (Non-Clinical tab) — fully automatic | Weekly health check |

## ── SECTION 5: How to Run the Scripts ────────────────────

To run the scripts, open your terminal (in the Agile Writer Test folder) and copy/paste these commands:

**Run a single health script:**
```bash
npx playwright test tests/health_ICF_trimmed.spec.ts --headed
```
*(The `--headed` flag makes the browser visible so you can watch the automation run).*

**Run all health scripts together:**
```bash
npx playwright test tests/health_ICF_trimmed.spec.ts \
  tests/health_ICF_full.spec.ts \
  tests/health_CSR.spec.ts \
  tests/health_M264.spec.ts --headed
```

**Run the QA folder dynamic test:**
```bash
npx playwright test tests/AW_11_to_20_QA_folder.spec.ts --headed
```

**Run the manual input test (edit runtime-config.json first):**
```bash
npx playwright test tests/AW_11_to_20_manual_input.spec.ts --headed
```

**Run pre-training UI checks:**
```bash
npx playwright test tests/AW_00_10_consolidated_flow.spec.ts --headed
```

## ── SECTION 6: How Health Scripts Work ───────────────────

When you run a health script, it follows this exact automated flow:

1. **Login:** The script logs in using your saved credentials from the `.env` file.
2. **Setup:** It opens AgileMapping and enters a timestamped output filename so the document is unique.
3. **Template:** It searches for the specific template file by name, expands the right folder, and selects it.
4. **Sources:** It searches for all the required source documents, expands the folder, and selects them.
5. **Training:** It clicks "Start Training" and patiently waits for all 3 backend stages to complete:
   *Indexing Sources → Finding Placeholder Matches → Populating Placeholders*.
6. **Verification:** It counts the placeholder colours on the screen: green means a successful match, red means not matched.
7. **Finalize:** It clicks "Create Final Doc" and waits for the final Word document to generate and download.
8. **Reporting:** It saves a detailed Word report with all screenshots and results to your `reports/` folder.

## ── SECTION 7: The 4 Hardcoded Health Scripts ────────────

The 4 health check scripts always use the same specific files and folders to ensure consistent testing. Here are their exact configurations:

| Script | Template File | Template Folder | Tab | Source Files | Source Folder |
|--------|--------------|-----------------|-----|-------------|---------------|
| `health_ICF_trimmed` | ICF_SET0_TRIMMED.docx | QA Testing | Clinical | Protocol Example (28Sep2023)_trimmed.docx | Protocol |
| `health_ICF_full` | ICF_SET0.docx | Informed Consent Form | Clinical | Protocol Example (28Sep2023).docx | Protocol |
| `health_CSR` | CSR_Template_20FEB2026.docx | CSR | Clinical | Mock_CSR files (confirm with team) | TBC |
| `health_M264` | 2.6.4 Template_Test.docx | M264 | Non-Clinical | 7 source files | Module264 |

## ── SECTION 8: New Document Formats — Step by Step ───────

If you have a brand new document format that you want to test, you don't need to write any code. Just follow these steps:

1. **Upload:** Upload your new template file and source files to SharePoint.
2. **Configure:** Open the `runtime-config.json` file in your code editor. Update the filenames, folder paths, and tabs to match your newly uploaded files.
3. **Run:** In your terminal, run: 
   `npx playwright test tests/AW_11_to_20_manual_input.spec.ts --headed`
4. **Automagic Script Generation:** Watch the test run. After it finishes successfully, a brand new health script is automatically generated for you inside the `tests/` folder (for example, `tests/health_MyFormat.spec.ts`).
5. **Future Runs:** You never have to manually configure those files again. Next week, just run your generated script!

## ── SECTION 9: Reports and Results ───────────────────────

After every single test run, the automation creates permanent records so you can review what happened:

- **`reports/step-results.json`** — A highly detailed log of every single action the script took, how long it took, and whether it passed or failed.
- **`reports/[scriptname]-report.docx`** — A generated Word report containing visual screenshots of the test and human-readable results.
- **`reports/last-run-config.json`** — A backup of the configuration from your last manual input run, so you never lose track of what you tested.
- **Screenshots** — If a test ever fails or gets stuck, the script automatically takes a screenshot at the exact moment of failure so you can see what went wrong.

## ── SECTION 10: Troubleshooting Common Issues ────────────

If a test fails, don't panic! Check this list for the most common problems and their fixes:

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| **"No files match [filename]"** | File not in SharePoint or wrong folder | Open SharePoint in your own browser and check the file exists in the exact folder. |
| **"Timeout waiting for Expand [folder]"** | Folder name mismatch | The name in the config doesn't match the SharePoint picker. Confirm the exact folder name. |
| **Stuck on "Populating Placeholders"** | Backend performance issue | This is not a script bug! The server is hanging. Report this to the dev/infrastructure team. |
| **Login popup does not appear** | Credentials not set in `.env` | Open your `.env` file and make sure `EMAIL` and `PASSWORD` are filled out correctly. |
| **TypeScript errors** | Dependency mismatch | Run `npm install` and then `npx tsc --noEmit` to fix missing packages. |

## ── SECTION 11: Automation UI Guide ────────────

## Overview
The automation UI provides a web interface to configure and trigger automated test runs locally. It acts as a bridge between the user and the Playwright test environment.

---

## Core File Details

### 1. `ui/index.html` (Interface Structure)
- **Role**: Serves as the application's entry point and structural layout.
- **Initialization**: Loads the design system via `styles.css` and the interaction logic via `script.js`.
- **Key Components**:
  - **Input Grid**: Captures environment details (Tester name, Microsoft credentials, Folder/Template names).
  - **Dynamic List**: A `<select>` element that is populated at runtime with available test scripts.
  - **Action Buttons**: Triggers the execution and allows report downloads.
  - **Log Terminal**: A hidden `div` that becomes visible during execution to display real-time terminal output.

### 2. `ui/script.js` (Frontend Logic)
- **Initialization**: Listens for the `DOMContentLoaded` event. Once triggered, it calls `GET /list-tests` from the server to dynamically fill the script selection dropdown.
- **Core Functions**:
  - **`runTest()`**: 
    1. Collects all form values into a JSON object.
    2. Initializes a front-end timer and clears the log terminal.
    3. Establishes a **Server-Sent Events (SSE)** connection to `/stream` to receive live logs.
    4. Makes an asynchronous `POST /run-test` request to start the backend process.
  - **`EventSource.onmessage`**: Listens for server updates. It parses incoming JSON to determine log type (e.g., `info`, `error`, `phase`) and applies CSS styles, timestamps, and icons before appending them to the UI terminal.
  - **`addSourceInput()`**: Manages the dynamic UI state by appending or removing source file input fields as needed.

### 3. `server/test-runner-server.js` (Backend Orchestration)
- **Initialization**: Starts an Express server on port 3000 and prepares an array to manage active SSE clients.
- **API Endpoints**:
  - **`GET /list-tests`**: Uses the `fs` module to scan the `./tests` directory for any file ending in `.spec.ts`.
  - **`GET /stream`**: Keeps a persistent HTTP connection open with the UI. It includes a `broadcastLog` helper that redacts sensitive information (paths/emails) before sending data to the browser.
  - **`POST /run-test`**: 
    1. Writes the received configuration to an ephemeral `runtime-config.json`.
    2. Uses `child_process.spawn` to trigger `npx playwright test`. 
    3. Bridges the process's `stdout` and `stderr` to the `broadcastLog` function to stream logs in real-time.
    4. On completion, it triggers the `generate-word-report.js` script.
    5. **Cleanup**: Automatically deletes `runtime-config.json` once the cycle ends to ensure security.

---

## Execution Flow
1. **User Input**: The user configures their parameters and clicks "Start".
2. **Data Submission**: The UI sends the config to the server and opens a log stream.
3. **Test Execution**: The server saves the config and spawns the Playwright process.
4. **Live Logging**: Output from the test runner is sanitized and streamed back to the UI terminal.
5. **Report & Cleanup**: A Word report is generated, the config is deleted, and the UI notifies the user of completion.
6. **Download**: The user retrieves the report via the "Download" button.
