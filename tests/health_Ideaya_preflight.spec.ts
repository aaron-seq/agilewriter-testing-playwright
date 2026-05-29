/**
 * health_Ideaya_preflight.spec.ts - Safe Ideaya PRODTEST pre-training validation.
 *
 * This script validates the IDE196-009 template/source picker configuration and
 * exits before training starts. It is intentionally separate from the full
 * Ideaya health run so engineers can verify SharePoint selection without
 * spending training credits.
 */

import { expect, test } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';

test.describe('Health Report: Ideaya PRODTEST Preflight', () => {
  test.describe.configure({ timeout: 900_000 });

  test.beforeAll(() => {
    initTracker();
  });

  test.afterAll(() => {
    saveResults();
  });

  test('Ideaya - preflight stops before training', async ({ page }) => {
    const config: HealthReportConfig = runtimeConfig.health.ideayaPreflight;

    expect(config.stopBeforeTraining).toBe(true);
    expect(config.sourceFolders).toContain('Tables_Test_EP');
    expect(config.sourceParentFolder).toBe('IDE196-009 TFLs');

    await runHealthReport(page, config);

    await expect(page.getByRole('button', { name: /Start Training/i })).toBeVisible();
    await expect(page.getByText(/Connecting to SharePoint/i)).toBeHidden();
  });
});
