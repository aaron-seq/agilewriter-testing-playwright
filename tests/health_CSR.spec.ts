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
 *   HEALTH_TEMPLATE_CSR=CSR_Template_20FEB2026.docx
 *   HEALTH_TEMPLATE_FOLDER_CSR=CSR
 *   HEALTH_SOURCES_CSR=Mock_CSR _Tables_30Oct25.rtf,Mock_CSR_Protocol.docx,Mock_CSR Key messages_with_heading.docx
 *   HEALTH_SOURCE_FOLDER_CSR=CSR
 *   HEALTH_OUTPUT_PREFIX_CSR=CSR_Test
 *
 * SOURCE DOCUMENTS (from user's health report spec):
 *   - Mock_CSR _Tables_30Oct25.rtf
 *   - Mock_CSR_Protocol.docx
 *   - Mock_CSR Key messages_with_heading.docx
 */

import { test } from '@playwright/test';
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
      templateName: process.env.HEALTH_TEMPLATE_CSR || 'CSR_Template_20FEB2026.docx',
      templateFolder: process.env.HEALTH_TEMPLATE_FOLDER_CSR || 'CSR',
      // Source filenames confirmed April 27, 2026.
      // Note: "Mock_CSR _Tables_30Oct25.rtf" has a space between CSR and _Tables.
      sourceNames: (
        process.env.HEALTH_SOURCES_CSR ||
        'Mock_CSR _Tables_30Oct25.rtf,Mock_CSR_Protocol.docx,Mock_CSR Key messages_with_heading.docx'
      )
        .split(',')
        .map((s) => s.trim()),
      sourceFolder: process.env.HEALTH_SOURCE_FOLDER_CSR || 'CSR',
      outputPrefix: process.env.HEALTH_OUTPUT_PREFIX_CSR || 'CSR_Test',
      expectedTrainingMinutes: 20,
    };

    await runHealthReport(page, config);
  });
});
