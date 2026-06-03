/**
 * health_Ideaya_PRODTEST_CSR.spec.ts - Health Report for Ideaya PRODTEST CSR
 *
 * Required env vars:
 * HEALTH_TEMPLATE_IDEAYA_PRODTEST_CSR
 * HEALTH_TEMPLATE_FOLDER_IDEAYA_PRODTEST_CSR
 * HEALTH_TEMPLATE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR
 * HEALTH_SOURCES_IDEAYA_PRODTEST_CSR
 * HEALTH_SOURCE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR
 */

import { test } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';
import { validateHealthEnv } from './helpers/validateHealthEnv';

test.describe('Health Report: Ideaya PRODTEST CSR', () => {
  // Timeout: 30 min training x 2 buffer + 5 min overhead = 65 min = 3,900,000 ms
  test.describe.configure({ timeout: 3_900_000 });

  test.beforeAll(() => {
    validateHealthEnv('ideayaProdtestCsr');
    initTracker();
  });

  test.afterAll(() => {
    saveResults();
  });

  test('Ideaya PRODTEST CSR - Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = runtimeConfig.health.ideayaProdtestCsr;

    await runHealthReport(page, config);
  });
});
