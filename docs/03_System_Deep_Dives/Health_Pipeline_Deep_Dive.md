# Health Pipeline Deep Dive

## 1. Why This Exists

Imagine you need to verify that AgileWriter can still generate a CSR (Clinical Study Report) document after a morning deployment. You could open the browser, log in manually, upload test files, click "Generate", wait 20 minutes, and check the output. 

The **Health Pipeline** automates that exact process. It answers one fundamental question: *"Does the end-to-end document generation process finish without crashing?"* 

It does not score the *accuracy* of the AI's output—that is the job of the Accuracy Pipeline. The Health Pipeline simply verifies that the system is alive and capable of completing its workflows.

## 2. Mental Model

Think of a Health Pipeline run as a robot executing a script:
1. **Safety Check (Init)**: The robot checks if you gave it all the keys and addresses it needs (Environment Variables). If anything is missing, it refuses to start.
2. **Setup**: The robot opens Chromium, logs in to AgileWriter via Microsoft SSO, and navigates to the correct SharePoint folder.
3. **Execution**: The robot uploads the template, clicks "Generate", and waits (sometimes up to 30 minutes) for the AI training and generation to finish.
4. **Teardown**: The robot closes the browser and saves a log of what happened.

## 3. Real Example: A Health Spec

Here is what the actual code looks like for the CSR health check (`tests/health_CSR.spec.ts`). Notice how it matches the mental model above:

```typescript
import { test } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';
import { validateHealthEnv } from '../utils/validateHealthEnv';

test.describe('Health Report: CSR', () => {
  // CSR generation takes a long time, so we set a 45-minute timeout (2,700,000 ms)
  test.describe.configure({ timeout: 2_700_000 });

  test.beforeAll(() => {
    initTracker();
    // 1. Safety Check: Aborts immediately if CSR env vars are missing
    validateHealthEnv('csr');  
  });

  test.afterAll(() => {
    // 4. Teardown: Save the results
    saveResults();
  });

  test('CSR - Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = runtimeConfig.health.csr;
    // 2 & 3. Setup and Execution
    await runHealthReport(page, config);
  });
});
```

## 4. Step-by-Step Workflow

When you run a health test, here is exactly what happens under the hood:

### Step 1: Environment Validation (`validateHealthEnv.ts`)
Before launching a browser, the framework checks your `.env` file. For example, if you run the CSR health check, `validateHealthEnv('csr')` ensures that `HEALTH_TEMPLATE_CSR` and `HEALTH_SOURCE_FOLDER_CSR` are present. If they aren't, the test fails instantly (in milliseconds, saving you a 20-minute wait).

### Step 2: Browser Launch & Auth (`global-setup.js`)
Playwright launches a Chromium instance. If you run multiple tests, they share authentication state (`playwright/.auth/user.json`) so they don't have to log in repeatedly.

### Step 3: Execution (`helpers/health-report-runner.ts`)
The script navigates to AgileWriter, inputs the configuration, and triggers generation.

### Step 4: The Waiting Game (`helpers/training-setup.ts`)
The script polls the UI, waiting for the AI training indicator to disappear. **This is where the pipeline spends 90% of its time.** 

Typical execution times:
* **ICF Trimmed**: ~5 minutes
* **ICF Full**: ~15 minutes
* **CSR**: ~20 minutes
* **M264**: ~25 minutes
* **Ideaya**: ~30 minutes

*(Note: There is a special `health_Ideaya_preflight.spec.ts` that stops right before training to validate configuration without spending AI training credits. It takes about 2 minutes.)*

## 5. Common Mistakes

* **Missing Environment Variables**: Forgetting to add the specific folder paths for a document type to your `.env` file.
* **Panicking During Training**: The terminal might sit silently on `Waiting for training completion...` for 15 minutes. This is normal. Do not cancel the run.
* **Running Tests in Parallel**: The health tests are configured to run sequentially (`workers: 1` in `playwright.config.js`). Forcing parallel execution will cause browser context collisions.

## 6. Troubleshooting

**Symptom**: The test fails immediately in 0.5 seconds.
* **Diagnosis**: The `validateHealthEnv` guard tripped.
* **Error to look for**: `[validateHealthEnv] Missing required env vars for 'csr': HEALTH_TEMPLATE_CSR`
* **Fix**: Check your `.env` file and ensure the listed variables are populated.

**Symptom**: The test hangs on "Waiting for training completion" and eventually times out.
* **Diagnosis**: Either AgileWriter is genuinely slow today, or the UI changed and Playwright is waiting for an element that no longer exists.
* **Fix**: Run the test locally with `headless: false` (so you can see the browser) and watch what happens. Check if the training spinner has disappeared but the test is still waiting.

## 7. Key Takeaways

* Health tests verify **completion**, not accuracy.
* They are protected by `validateHealthEnv` to fail fast on bad configuration.
* They are slow by design because AgileWriter document generation is slow. Patience is required.

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
