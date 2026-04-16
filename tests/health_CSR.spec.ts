/**
 * health_CSR.spec.ts — Health Report for CSR Documents
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
 *   HEALTH_TEMPLATE=CSR_Template_20FEB2026.docx
 *   HEALTH_TEMPLATE_FOLDER=CSR
 *   HEALTH_SOURCES=Mock_CSR_list.docx,Mock_CSR_Protocol.docx,Mock_CSR Key messages_with_heading.docx
 *   HEALTH_SOURCE_FOLDER=CSR
 *   HEALTH_OUTPUT_PREFIX=CSR_Test
 *
 * SOURCE DOCUMENTS (from user's health report spec):
 *   - Mock_CSR_Tables_30Oct25.rtf
 *   - Mock_CSR_Protocol.docx
 *   - Mock_CSR Key messages_with_heading.docx
 */

import { test } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';

test.describe('Health Report: CSR', () => {
  // 20 min training × 2 buffer + overhead = ~45 min
  test.describe.configure({ timeout: 2_700_000 });

  test.beforeAll(() => {
    initTracker();
  });

  test.afterAll(() => {
    saveResults();
  });

  test('CSR — Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = {
      reportName: 'CSR',
      templateName: runtimeConfig.template || 'CSR_Template_20FEB2026.docx',
      templateFolder: runtimeConfig.folder || 'CSR',
      sourceNames: (
        runtimeConfig.source ||
        'Mock_CSR _Tables_30Oct25.rtf,Mock_CSR_Protocol.docx,Mock_CSR Key messages_with_heading.docx'
      )
        .split(',')
        .map((s) => s.trim()),
      sourceFolder: runtimeConfig.folder || 'CSR',
      outputPrefix: 'CSR_Test',
      expectedTrainingMinutes: 20,
    };

    await runHealthReport(page, config);
  });
});
