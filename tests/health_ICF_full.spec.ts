/**
 * health_ICF_full.spec.ts — Health Report for ICF Full Documents
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
 *   HEALTH_TEMPLATE=ICF_SET0.docx
 *   HEALTH_TEMPLATE_FOLDER=QA Testing
 *   HEALTH_SOURCES=Protocol Example (28Sep2023).docx
 *   HEALTH_SOURCE_FOLDER=QA Testing
 *   HEALTH_OUTPUT_PREFIX=ICF_Full
 */

import { test } from '@playwright/test';
import dotenv from 'dotenv';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';

dotenv.config();

test.describe('Health Report: ICF Full', () => {
  // 15 min training × 2 buffer + overhead = ~35 min
  test.describe.configure({ timeout: 2_100_000 });

  test.beforeAll(() => {
    initTracker();
  });

  test.afterAll(() => {
    saveResults();
  });

  test('ICF Full — Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = {
      reportName: 'ICF Full',
      templateName: process.env.HEALTH_TEMPLATE || 'ICF_SET0.docx',
      templateFolder: process.env.HEALTH_TEMPLATE_FOLDER || 'QA Testing',
      sourceNames: (process.env.HEALTH_SOURCES || 'Protocol Example (28Sep2023).docx')
        .split(',')
        .map((s) => s.trim()),
      sourceFolder: process.env.HEALTH_SOURCE_FOLDER || 'QA Testing',
      outputPrefix: process.env.HEALTH_OUTPUT_PREFIX || 'ICF_Full',
      expectedTrainingMinutes: 15,
    };

    await runHealthReport(page, config);
  });
});
