/**
 * health_Ideaya.spec.ts - Health Report for Ideaya Documents
 *
 * WHAT IT DOES:
 *   Runs a complete health check for Ideaya document generation.
 *   Training time: ~30 minutes
 *
 * HOW TO RUN:
 *   npx playwright test tests/health_Ideaya.spec.ts --headed
 *
 * HOW TO CONFIGURE:
 *   Edit .env file with the document names:
 *     HEALTH_TEMPLATE_IDEAYA=IDE196-001_CSR_Destination Template_18May2026_Final.docx
 *     HEALTH_TEMPLATE_FOLDER_IDEAYA=Template for SC
 *     HEALTH_SOURCE_FILE_IDEAYA=IDE196 Investigators Brochure_v13.pdf
 *     HEALTH_SOURCE_PARENT_FOLDER_IDEAYA=IDE196-001 TFLs
 *     HEALTH_SOURCE_NESTED_FOLDERS_IDEAYA=Efficacy Tables_Test_EP,Safety Tables_Test_EP,Test [From Synterex]
 *     HEALTH_OUTPUT_PREFIX_IDEAYA=Ideaya_CSR
 *     HEALTH_EXPECTED_MINUTES_IDEAYA=30
 */

import { test } from '@playwright/test';
import { runtimeConfig } from '../../runtime-config';
import { initTracker, saveResults } from '../helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from '../helpers/health-report-runner';
import { validateHealthEnv } from '../../utils/validateHealthEnv';

test.describe('Health Report: Ideaya', () => {
  // Timeout: 30 min training x 2 buffer + 5 min overhead = 65 min = 3,900,000 ms
  test.describe.configure({ timeout: 3_900_000 });

  test.beforeAll(() => {
    initTracker();
    validateHealthEnv('ideaya');
  });

  test.afterAll(() => {
    saveResults();
  });

  test('Ideaya - Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = runtimeConfig.health.ideaya;

    await runHealthReport(page, config);
  });
});
