/**
 * step-tracker.ts — Enhanced Step Tracking for Custom Reports
 *
 * WHAT IT DOES:
 *   Wraps each test step in a tracking function that records:
 *   - Step name and validation description
 *   - Pass/fail status
 *   - Duration in milliseconds
 *   - ISO timestamp (exact wall-clock time the step ran)
 *   - Screenshot of the browser at step completion
 *   - Optional placeholder color counts (green/grey/blue/red/yellow)
 *
 * WHY WE BUILT THIS (instead of Playwright's built-in test.step):
 *   - Playwright's test.step only shows data in its HTML report
 *   - We need data in JSON format to feed our PDF report generator
 *   - We need custom fields (color counts, timestamps) not supported by test.step
 *   - We need real-time persistence (writes to disk after each step, survives crashes)
 *
 * HOW IT WORKS:
 *   1. initTracker() — called in test.beforeAll, creates /reports/ directories
 *   2. trackStep(page, testName, stepName, validation, fn) — wraps a test step
 *      - Records start time
 *      - Executes the step function
 *      - Records pass/fail, duration, takes screenshot
 *      - Appends to reports/step-results.json immediately
 *   3. saveResults() — no-op (results saved in real-time for crash safety)
 *
 * CONSEQUENCES:
 *   - Pro: Data persists even if test crashes mid-run
 *   - Pro: Screenshots give stakeholders visual evidence
 *   - Con: Screenshot capture adds ~500ms per step (acceptable)
 *   - Con: JSON file grows with each step (cleared by global-setup.js before each run)
 *
 * BASED ON: Inayat's feature/custom_report branch (commit b4c5a7f)
 * ENHANCED WITH: ISO timestamps, color count support, stage timing
 */

import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const EXPECT_POLL_INTERVALS = [2000, 3000, 5000];

const REPORT_DIR = 'reports';
const FILE_PATH = path.join(REPORT_DIR, 'step-results.json');

/**
 * Placeholder color counts — used after training to show how many
 * placeholders are in each state.
 *
 * Color meanings:
 *   green  = Replacement Done (populated successfully)
 *   grey   = Not matched (no source content found)
 *   blue   = Match Found (source matched but not yet applied)
 *   red    = Replacement Not Found (matching failed)
 *   yellow = Matching pending (still processing)
 *   other  = Unexpected color (should be 0 in normal operation)
 */
export type ColorCounts = {
  green: number;
  grey: number;
  blue: number;
  red: number;
  yellow: number;
  other: number;
};

/**
 * A single tracked step — this is what gets saved to step-results.json
 * and later read by generate-word-report.js to create the Word report.
 */
export type Step = {
  testName: string;       // e.g., "AW_11: Training Initialization"
  stepName: string;       // e.g., "Start training process"
  validation: string;     // e.g., "System starts training successfully"
  status: 'PASS' | 'FAIL';
  critical: boolean;      // true = expect() (stops test), false = expect.soft() (continues)
  duration: number;       // milliseconds
  timestamp: string;      // ISO 8601 string — exact wall-clock time
  screenshot: string;     // file path to screenshot image
  colorCounts?: ColorCounts; // optional — only set after training stages
  error?: string;         // error message if status is FAIL
};

let steps: Step[] = [];

/**
 * Initialize the tracker — call this in test.beforeAll().
 *
 * Creates the reports/ and reports/screenshots/ directories if they
 * don't exist. Resets the in-memory steps array.
 *
 * WHY we reset in-memory but NOT the JSON file:
 *   The JSON file may contain steps from previously-run test files
 *   in the same session. global-setup.js handles the full cleanup
 *   before the entire test suite starts.
 */
export function initTracker(): void {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  steps = [];
}

/**
 * Append a single step to the JSON file on disk.
 *
 * WHY append instead of overwrite:
 *   - If the test crashes, all previously-completed steps are preserved
 *   - Multiple test files can contribute to the same report
 *
 * HOW it works:
 *   1. Read existing file (or start empty array)
 *   2. Push new step
 *   3. Write entire array back (small file, fast operation)
 */
function appendToResults(newStep: Step): void {
  let allSteps: Step[] = [];
  if (fs.existsSync(FILE_PATH)) {
    try {
      const content = fs.readFileSync(FILE_PATH, 'utf-8');
      if (content.trim()) {
        allSteps = JSON.parse(content);
      }
    } catch {
      // If the file is corrupted, start fresh
    }
  }
  allSteps.push(newStep);
  fs.writeFileSync(FILE_PATH, JSON.stringify(allSteps, null, 2));
}

/**
 * Track a single test step — the core function.
 *
 * USAGE:
 *   await trackStep(page, 'AW_11: Training', 'Start training',
 *     'System starts training successfully', async () => {
 *       await startManualTraining(page);
 *     });
 *
 * WHAT HAPPENS:
 *   1. Records the current timestamp (ISO 8601)
 *   2. Records the start time (for duration calculation)
 *   3. Executes your function (fn)
 *   4. If fn throws, marks status as FAIL and captures the error
 *   5. Takes a screenshot of the current browser state
 *   6. Saves everything to JSON immediately
 *   7. If fn threw, re-throws the error so the test still fails normally
 *
 * @param page       - Playwright Page object (for screenshots)
 * @param testName   - The test case name (e.g., "AW_11: Training Initialization")
 * @param stepName   - Short description of this step
 * @param validation - What this step validates (shown in the report)
 * @param fn         - The async function containing the actual test logic
 * @param colorCounts - Optional color counts to attach to this step
 */
export async function trackStep(
  page: Page,
  testName: string,
  stepName: string,
  validation: string,
  fn: () => Promise<void>,
  colorCounts?: ColorCounts
): Promise<void> {
  const timestamp = new Date().toISOString();
  const start = Date.now();
  let status: 'PASS' | 'FAIL' = 'PASS';
  let screenshot = '';
  let errorMessage: string | undefined;
  let caughtError: unknown = null;

  try {
    await fn();
  } catch (e) {
    status = 'FAIL';
    caughtError = e;
    errorMessage = e instanceof Error ? e.message : String(e);
  } finally {
    const duration = Date.now() - start;

    // Take screenshot — creates the screenshots directory if needed
    const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    // Filename: timestamp-step_name.png (sanitized for filesystem)
    const sanitizedStepName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
    screenshot = path.join(
      SCREENSHOT_DIR,
      `${Date.now()}-${sanitizedStepName}.png`
    );

    try {
      await page.screenshot({ path: screenshot });
    } catch (err) {
      console.warn('⚠️ Screenshot capture failed:', err);
      screenshot = '';
    }

    const currentStep: Step = {
      testName,
      stepName,
      validation,
      status,
      critical: true,  // trackStep = critical check (stops test on failure)
      duration,
      timestamp,
      screenshot,
      ...(colorCounts ? { colorCounts } : {}),
      ...(errorMessage ? { error: errorMessage } : {}),
    };

    steps.push(currentStep);
    appendToResults(currentStep);

    // Console output for real-time visibility
    const icon = status === 'PASS' ? '✔' : '✖';
    console.log(`  ${icon} [CRITICAL][${status}] ${stepName} (${(duration / 1000).toFixed(1)}s) @ ${timestamp}`);
  }

  // Re-throw so the test still fails normally in Playwright
  if (caughtError) {
    throw caughtError;
  }
}

/**
 * Track a NON-CRITICAL test step — the soft assertion version.
 *
 * WHAT'S DIFFERENT FROM trackStep():
 *   - If the step FAILS, the error is recorded but NOT re-thrown
 *   - The test continues executing the next steps
 *   - The step is still recorded as FAIL in step-results.json
 *   - The final test status will still be FAILED (Playwright marks tests
 *     with soft failures as failed)
 *
 * WHEN TO USE THIS:
 *   - Veeva integration checks (nice-to-know, not blocking)
 *   - Preview rendering checks (informational)
 *   - Placeholder color verification (logging, not blocking)
 *   - UI label/text checks that don't affect functionality
 *
 * WHEN NOT TO USE THIS:
 *   - Login/authentication (nothing works without it)
 *   - SharePoint connection (core dependency)
 *   - Training pipeline stages (must complete)
 *   - Document generation/download (the whole point of the test)
 *
 * SIMPLE RULE:
 *   Ask: "If this check fails, can the NEXT step still run?"
 *   YES → trackSoftStep()    NO → trackStep()
 */
export async function trackSoftStep(
  page: Page,
  testName: string,
  stepName: string,
  validation: string,
  fn: () => Promise<void>,
  colorCounts?: ColorCounts
): Promise<void> {
  const timestamp = new Date().toISOString();
  const start = Date.now();
  let status: 'PASS' | 'FAIL' = 'PASS';
  let screenshot = '';
  let errorMessage: string | undefined;

  try {
    await fn();
  } catch (e) {
    status = 'FAIL';
    errorMessage = e instanceof Error ? e.message : String(e);
    // NOTE: We do NOT store the error to re-throw — this is the key difference
  } finally {
    const duration = Date.now() - start;

    const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const sanitizedStepName = stepName.replace(/[^a-zA-Z0-9_-]/g, '_');
    screenshot = path.join(
      SCREENSHOT_DIR,
      `${Date.now()}-${sanitizedStepName}.png`
    );

    try {
      await page.screenshot({ path: screenshot });
    } catch (err) {
      console.warn('⚠️ Screenshot capture failed:', err);
      screenshot = '';
    }

    const currentStep: Step = {
      testName,
      stepName,
      validation,
      status,
      critical: false,  // trackSoftStep = non-critical (test continues on failure)
      duration,
      timestamp,
      screenshot,
      ...(colorCounts ? { colorCounts } : {}),
      ...(errorMessage ? { error: errorMessage } : {}),
    };

    steps.push(currentStep);
    appendToResults(currentStep);

    const icon = status === 'PASS' ? '✔' : '⚠';
    console.log(`  ${icon} [SOFT][${status}] ${stepName} (${(duration / 1000).toFixed(1)}s) @ ${timestamp}`);
    if (status === 'FAIL') {
      console.log(`    ↳ Non-critical failure: ${errorMessage}`);
    }
  }

  // NOTE: We do NOT re-throw the error — test continues
}

/**
 * Count placeholder colors in the current browser page.
 *
 * WHAT IT DOES:
 *   Uses Playwright's evaluateAll() to run JavaScript inside the browser.
 *   This processes ALL .doc-placeholder elements in a single call (fast).
 *
 * WHY evaluateAll instead of individual toHaveCSS checks:
 *   - evaluateAll: ~100ms for 50+ elements (one browser roundtrip)
 *   - Individual toHaveCSS: ~50+ seconds (one assertion per element, each with timeout)
 *
 * RETURNS: ColorCounts object with counts per color category
 */
export async function countPlaceholderColors(page: Page): Promise<ColorCounts> {
  const counts = await page.locator('.doc-placeholder').evaluateAll((elements) => {
    const result = { green: 0, grey: 0, blue: 0, red: 0, yellow: 0, other: 0 };
    elements.forEach((el) => {
      const bg = window.getComputedStyle(el).backgroundColor;
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) {
        result.other++;
        return;
      }
      const [, rMatch, gMatch, bMatch] = match;
      const r = Number.parseInt(rMatch, 10);
      const g = Number.parseInt(gMatch, 10);
      const b = Number.parseInt(bMatch, 10);

      if (r === 16 && g === 185 && b === 129) result.green++;
      else if (r === 156 && g === 163 && b === 175) result.grey++;
      else if (r === 59 && g === 130 && b === 246) result.blue++;
      else if (r === 239 && g === 68 && b === 68) result.red++;
      else if (r === 246 && g === 234 && b === 59) result.yellow++;
      else result.other++;
    });
    return result;
  });

  const total = counts.green + counts.grey + counts.blue + counts.red + counts.yellow + counts.other;
  console.log(`  📊 Placeholder Colors: Green=${counts.green} Grey=${counts.grey} Blue=${counts.blue} Red=${counts.red} Yellow=${counts.yellow} Other=${counts.other} (Total=${total})`);

  return counts;
}

/**
 * Save results — no-op because results are already saved in real-time.
 *
 * WHY this exists: For API compatibility with Inayat's original design.
 * Called in test.afterAll() but does nothing because appendToResults()
 * already writes to disk after every step.
 */
export function saveResults(): void {
  // Results are already saved in real-time within trackStep
}
