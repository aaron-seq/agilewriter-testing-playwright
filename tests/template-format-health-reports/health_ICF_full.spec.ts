/**
 * health_ICF_full.spec.ts - Health Report for ICF Full Documents
 *
 * WHAT IT DOES:
 *   Runs a complete health check for ICF full document generation.
 *   Training time: ~15 minutes
 *   Expected output: 4 documents (Raw QA, Raw, Clean, Normal)
 *
 * HOW TO RUN:
 *   npx playwright test tests/health_ICF_full.spec.ts --headed
 *
 * HOW TO CONFIGURE (edit .env):
 *   HEALTH_TEMPLATE_ICF_FULL=ICF_SET0.docx
 *   HEALTH_TEMPLATE_FOLDER_ICF_FULL=Informed Consent Form
 *   HEALTH_SOURCES_ICF_FULL=Protocol Example (28Sep2023).docx
 *   HEALTH_SOURCE_FOLDER_ICF_FULL=Protocol
 *   HEALTH_OUTPUT_PREFIX_ICF_FULL=ICF_Full
 */

import { test } from '@playwright/test';
import { runtimeConfig } from '../../runtime-config';
import { initTracker, saveResults } from '../helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from '../helpers/health-report-runner';
import { validateHealthEnv } from '../../utils/validateHealthEnv';

test.describe('Health Report: ICF Full', () => {
  // 15 min training x 2 buffer + overhead = ~35 min
  test.describe.configure({ timeout: 2_100_000 });

  test.beforeAll(() => {
    initTracker();
    validateHealthEnv('icfFull');
  });

  test.afterAll(() => {
    saveResults();
  });

  test('ICF Full - Full Health Check', async ({ page }) => {
    // AA-179: ICF Full has 239 placeholders. The "Finding Placeholder Matches" stage
    // takes >30 min by architectural design. test.slow() triples the timeout for this
    // describe block only. This is not a regression. Do not reduce this timeout.
    test.slow();

    const config: HealthReportConfig = runtimeConfig.health.icfFull;

    await runHealthReport(page, config);
  });
});
