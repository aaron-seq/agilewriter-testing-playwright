/**
 * health_ICF_trimmed.spec.ts - Health Report for ICF Trimmed Documents
 *
 * WHAT IT DOES:
 *   Runs a complete health check for ICF trimmed document generation.
 *   Training time: ~5 minutes
 *   Expected output: 4 documents (Raw QA, Raw, Clean, Normal)
 *
 * HOW TO RUN:
 *   npx playwright test tests/health_ICF_trimmed.spec.ts --headed
 *
 * HOW TO CONFIGURE:
 *   Edit .env file with the document names:
 *     HEALTH_TEMPLATE_ICF_TRIMMED=ICF_SET0_TRIMMED.docx
 *     HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED=QA Testing
 *     HEALTH_SOURCES_ICF_TRIMMED=Protocol Example (28Sep2023)_trimmed.docx
 *     HEALTH_SOURCE_FOLDER_ICF_TRIMMED=Protocol
 *     HEALTH_OUTPUT_PREFIX_ICF_TRIMMED=ICF_Trimmed
 *
 * WHAT THE REPORT SHOWS:
 *   - Step-by-step test results with timestamps
 *   - Placeholder color counts (green = populated, red = failed)
 *   - Screenshots at each step
 *   - Pass/fail status for each step
 */

import { test } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';
import { validateHealthEnv } from '../utils/validateHealthEnv';

test.describe('Health Report: ICF Trimmed', () => {
  // Generous timeout: 5 min training x 2 buffer + overhead = ~15 min
  test.describe.configure({ timeout: 900_000 });

  test.beforeAll(() => {
    initTracker();
    validateHealthEnv('icfTrimmed');
  });

  test.afterAll(() => {
    saveResults();
  });

  test('ICF Trimmed - Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = runtimeConfig.health.icfTrimmed;

    await runHealthReport(page, config);
  });
});
