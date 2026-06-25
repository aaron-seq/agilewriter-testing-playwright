# User Execution Guide

## 1. Why This Exists

This guide is for QA engineers and developers who need to run a health check against AgileWriter. 

Whether you're verifying a new deployment, checking if the environment is stable, or generating a compliance report, you need to know exactly how to trigger the automation, what to expect while it runs, and how to get your results.

## 2. Mental Model

Running a test here is like putting a cake in the oven:
1. **Prep**: You pick your recipe (the test script) from the dashboard.
2. **Bake**: You hit Run. You can watch through the oven window (the terminal logs stream on the screen), but you mostly just have to wait.
3. **Ding**: The timer goes off, the status turns green, and you take your cake out (download the Word report).

## 3. Real Example: Running a CSR Health Check

Let's walk through the exact steps to run `health_CSR.spec.ts`.

### Step 1: Open the Dashboard
Ensure the server is running (`npm run server` or via Docker). Open your browser to:
`http://localhost:3000/ui`

You will see the **Agile Writer | Test Runner** interface.

### Step 2: Configure the Run
1. **Tester Name**: Enter your name (e.g., "Jane Doe"). This gets printed on the final Word report.
2. **Environment**: Select your target (e.g., QA, UAT, PROD).
3. **Test Script**: Click the dropdown. This list is generated dynamically by interrogating the codebase. Select `health_CSR.spec.ts`.

### Step 3: Execute
Click the **Run Test** button.

### Step 4: Watch the Execution
A black terminal window will appear in the UI. You will see Playwright booting up:
```text
Running test: health_CSR.spec.ts
Logging into AgileWriter via Microsoft SSO...
Navigating to SharePoint folder...
Uploading template...
Waiting for training completion...
```

**CRITICAL:** When you see `Waiting for training completion...`, the terminal will stop scrolling. **Do not close the tab. Do not click Run again.** AgileWriter is training its AI model. For a CSR, this takes about **20 minutes**. Just let it sit.

### Step 5: Download the Report
Once the test finishes, the terminal will print `Test execution completed successfully`. 
The **Download Report** button will turn blue. Click it to download your `_Report.docx` file.

## 4. Alternative: Discovering Scripts via CLI

If you don't want to use the UI and prefer the command line, you can list all available health scripts by running:
```bash
npx playwright test --project=health --list
```
This is the canonical way the system discovers what tests exist. You can then run one directly:
```bash
npx playwright test tests/health_CSR.spec.ts --project=health
```

## 5. Common Mistakes

* **Running Multiple Tests at Once**: If you open two tabs and click "Run Test" in both, they will collide. The system shares a single session directory. Run one test, download the report, then run the next.
* **Closing the Browser Tab Too Early**: If you close the `localhost:3000/ui` tab while the test is running, the test *will continue running in the background* on the server, but you will lose your connection to the terminal stream and the download button.
* **Thinking the Test is Broken When It's Just Slow**: `health_Ideaya.spec.ts` takes 30 minutes. Be patient.

## 6. Troubleshooting

**Symptom**: The "Run Test" button doesn't do anything, or the terminal stays completely blank.
* **Diagnosis**: The Node.js server might have crashed.
* **Fix**: Check the terminal window where you ran `npm run server` (or your Docker logs). If it crashed, restart it.

**Symptom**: The test runs for 5 seconds and fails with `Missing required env vars`.
* **Diagnosis**: Your `.env` file is missing the specific folders required for the document type you selected.
* **Fix**: Open `.env` and ensure `HEALTH_TEMPLATE_CSR` (or whichever type you ran) has a valid value.

**Symptom**: You clicked Download Report, but the Word document says "FAIL: Environment or Setup Failure" and shows zero steps.
* **Diagnosis**: Playwright crashed before it could even start tracking steps. This usually means your `BASE_URL` is wrong, or Microsoft SSO blocked the login.

## 7. Key Takeaways

* Use `localhost:3000/ui` to run tests.
* The dropdown list is automatically populated based on files in the repository.
* When the terminal says "Waiting for training", leave it alone for 10-30 minutes.
* Only run one test at a time.

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
