# Agile Writer Playwright Handbook

## 1. What this handbook is for

This handbook explains the architecture of the Agile Writer Playwright test suite. It breaks down:
- The new consolidated test file structures
- How the granular `trackStep` telemetry and Word report generation work
- How to run specific Health validation scripts
- What `.env` properties manage dynamic files from SharePoint
- Important Helper logic

This serves as a beginner-friendly reference for new QA team members running the suite.

---

## 2. Project Goal

Automate the core Agile Writer validation workflows (AW_00 to AW_20) cleanly, outputting visual telemetry and highly structured Microsoft Word Document Health Reports for management so that stable QA pipeline checks can execute without repetitive manual testing.

---

## 3. Main File Architecture

Important files and folders:

- **`playwright.config.js`**
  Controls the Playwright test runners, browser setups, timeout thresholds, and GitHub Actions CI fallbacks.
- **`tests/AW_00_10_consolidated_flow.spec.ts`**
  Unified validation suite executing Authentication, Dashboard checks, and Setup workflows in `serial` mode to prevent duplicate training operations.
- **`tests/AW_11_to_20.spec.ts`**
  The central heavy-lifting file covering Document Generation, Color mapping, Stage matching, Apply All, and final download capabilities. Uses granular internal wrappers.
- **`tests/health_ICF_trimmed.spec.ts` (and variants)**
  Templatized health reports that can run validation on a specific business document natively against `.env` without modifying code.
- **`tests/helpers/step-tracker.ts`**
  Captures real-time granular telemetrics, screenshots, duration timestamps, and color validation outputs and streams it to JSON structure.
- **`generate-word-report.js`**
  Consumes tracking dumps and compiles a fully branded QA validation `.docx` artifact.
- **`.env`**
  The heart of configuration. Manages URL bindings, MS Auth, placeholder Regex defaults, and SharePoint document names.

---

## 4. `trackStep` and `trackSoftStep` Explained

To move away from Playwright's native reporting (which is too technical for clients), we built a wrapper called `trackStep()`.

### Example
```typescript
await trackStep(page, 'AW_11_to_20', 'AW12B Stage Monitoring', 'All 3 stages complete', async () => {
    // Expect locators and UI assertions here
    await expect(page.locator(COMPLETED_SELECTOR)).toHaveCount(3);
});
```

### Why this exists:
1. **Readable Reporting:** Outputs a clear block in the log showing the Task Name, Expectation, Duration, and a Screenshot exactly where it completed or failed.
2. **Soft Verification (`trackSoftStep`):** Allows non-critical validations (like checking placeholder color distributions `GREEN_PATTERN`) to fail safely without terminating the entire test pipeline. This mimics human subjective evaluation gracefully.

---

## 5. The Health Report Configuration Structure (`.env`)

File selection in Agile Writer utilizes dynamic SharePoint folders ("QA Testing" etc). Finding these requires search interaction. Instead of hardcoding document names inside tests, the setup is controlled natively through your `.env` configuration.

```env
# Health Report Configuration
HEALTH_TEMPLATE=ICF_SET0_TRIMMED.docx
HEALTH_TEMPLATE_FOLDER=QA Testing
HEALTH_SOURCES=Protocol Example (28Sep2023).docx
HEALTH_SOURCE_FOLDER=QA Testing
HEALTH_OUTPUT_PREFIX=ICF_Trimmed
```
- If a document is updated by the client, you just change the `.env` value.
- No TypeScript or test recompilation is needed to validate the latest data.

---

## 6. How To Execute

### Running Full Pipeline
```bash
npx playwright test tests/AW_00_10_consolidated_flow.spec.ts tests/AW_11_to_20.spec.ts
```

### Running Specific Health Checking Scripts
To run an isolated mapping test against specific files:
```bash
npx playwright test tests/health_ICF_trimmed.spec.ts
```

### Generating The Word Report
After execution, results are stored in `reports/step-results.json`. To package them up:
```bash
npm run report
```
This triggers `generate-word-report.js` to create the Final QA output.

---

## 7. Key Best Practices for Maintenance
- **Never Add Brittle Waits:** Replace `page.waitForTimeout(5000)` with `await expect(...).toBeVisible({ timeout: ... })` utilizing the `UI_TIMEOUT` vs `TRAINING_TIMEOUT` paradigms seamlessly.
- **Verify Toast Life-cycles:** Use `waitForApplyAllToast()` hooks which properly handle transition and race condition scopes without failing prematurely on React DOM repaints.
- **Use the Helpers:** Keep files clean. Delegate repetitive logic into `app-navigation.ts` and `health-report-runner.ts` so future updates only need to be fixed in one core location.
