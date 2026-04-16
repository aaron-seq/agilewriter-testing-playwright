/**
 * health_M264.spec.ts — Health Report for M264 (Module 2.6.4) Documents
 *
 * WHAT IT DOES:
 *   Runs a complete health check for M264 document generation.
 *   Training time: ~25 minutes (longest of all document types)
 *   Expected output: 4 documents (Raw QA, Raw, Clean, Normal)
 *
 * HOW TO RUN:
 *   npx playwright test tests/health_M264.spec.ts --headed
 *
 * HOW TO CONFIGURE (edit .env):
 *   HEALTH_TEMPLATE=2.6.4 Template_Test.docx
 *   HEALTH_TEMPLATE_FOLDER=M264
 *   HEALTH_SOURCES=Absorption_PK Study in Dog.docx,Metabolism_Report.docx,ABC-123_Summary and Conclusion.docx,DDI_Cyp_Report.docx,ABC-123_Method of Analysis.docx,Distribution_Blood Partitioning.docx,Absorption_PK Study in Rat.docx
 *   HEALTH_SOURCE_FOLDER=M264
 *   HEALTH_OUTPUT_PREFIX=M264_Test
 *
 * NOTE: M264 has the most source documents (7 files).
 */

import { test } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';

test.describe('Health Report: M264', () => {
  // 25 min training × 2 buffer + overhead = ~55 min
  test.describe.configure({ timeout: 3_300_000 });

  test.beforeAll(() => {
    initTracker();
  });

  test.afterAll(() => {
    saveResults();
  });

  test('M264 — Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = {
      reportName: 'M264 (Module 2.6.4)',
      templateName: runtimeConfig.template || '2.6.4 Template_Test.docx',
      templateFolder: runtimeConfig.folder || 'M264',
      sourceNames: (
        runtimeConfig.source ||
        'Absorption_PK Study in Dog.docx,Metabolism_Report.docx,ABC-123_Summary and Conclusion.docx,DDI_Cyp_Report.docx,ABC-123_Method of Analysis.docx,Distribution_Blood Partitioning.docx,Absorption_PK Study in Rat.docx'
      )
        .split(',')
        .map((s) => s.trim()),
      sourceFolder: runtimeConfig.folder || 'M264',
      outputPrefix: 'M264_Test',
      expectedTrainingMinutes: 25,
    };

    await runHealthReport(page, config);
  });
});
