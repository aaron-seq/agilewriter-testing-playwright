/**
 * health_CSR.spec.ts - Health Report for CSR Documents
 *
 * WHAT IT DOES:
 *   Runs a complete health check for CSR document generation.
 *   Training time: ~20 minutes
 *   Expected output: 4 documents (Raw QA, Raw, Clean, Normal)
 *
 * HOW TO RUN:
 *   npx playwright test tests/health_CSR.spec.ts --headed
 *
 * HOW TO CONFIGURE (edit .env):
 *   HEALTH_TEMPLATE_CSR=CSR_Template_20FEB2026.docx
 *   HEALTH_TEMPLATE_FOLDER_CSR=CSR
 *   HEALTH_SOURCES_CSR=Mock_CSR _Tables_30Oct25.rtf,Mock_CSR_Protocol.docx,Mock_CSR Key messages_with_heading.docx
 *   HEALTH_SOURCE_FOLDER_CSR=CSR
 *   HEALTH_OUTPUT_PREFIX_CSR=CSR_Test
 *
 * SOURCE DOCUMENTS:
 *   - Mock_CSR _Tables_30Oct25.rtf
 *   - Mock_CSR_Protocol.docx
 *   - Mock_CSR Key messages_with_heading.docx
 */

import { test } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';
import { validateHealthEnv } from './helpers/validateHealthEnv';

test.describe('Health Report: CSR', () => {
  // 20 min training x 2 buffer + overhead = ~45 min
  test.describe.configure({ timeout: 2_700_000 });

  test.beforeAll(() => {
    initTracker();
    validateHealthEnv('csr');
  });

  test.afterAll(() => {
    saveResults();
  });

  test('CSR - Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = runtimeConfig.health.csr;

    await runHealthReport(page, config);
  });
});
