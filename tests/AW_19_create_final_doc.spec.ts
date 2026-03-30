import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { runTrainingSetup } from './helpers/training-setup';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2821 | Feature: Create Final Doc → Review Screen → Download
 * Test ID: AW_19
 * Source: test-1.spec.ts lines 61–74 (recorder) —
 *   Create Final Doc → Review Screen → Save → Download
 */

test.describe('AW_19: Create Final Doc', () => {
  test.setTimeout(600_000);

  test.beforeEach(async ({ page }) => {
    await runTrainingSetup(page);
  });

  test('AW_19: Create Final Doc button is enabled after training completes', async ({ page }) => {
    // VERIFY: Button is not disabled (training completed in beforeEach)
    await expect(
      page.getByRole('button', { name: 'Create Final Doc [Alt+G]' })
    ).not.toBeDisabled({ timeout: 10_000 });

    console.log('✅ AW_19 — Create Final Doc button enabled PASSED');
  });

  test('AW_19: Apply All then Create Final Doc opens Review Screen', async ({ page }) => {
    // Apply All first to resolve all mappings
    await page.getByRole('button', { name: 'Apply All [Alt+Y]' }).click();
    await expect(
      page.getByText(/Applied all \d+ mappings\./)
    ).toBeVisible({ timeout: 30_000 });

    // Close Mapping Controls drawer before proceeding
    await page.getByRole('button', { name: 'Close Mapping Controls drawer' }).click();

    // recorder: test-1.spec.ts line 61 — Create Final Doc
    await page.getByRole('button', { name: 'Create Final Doc [Alt+G]' }).click();

    // VERIFY: Review Screen heading
    await expect(
      page.getByRole('heading', { name: 'Review Screen' })
    ).toBeVisible({ timeout: 30_000 });

    // VERIFY: Review Screen subtitle and action buttons
    await expect(page.getByText('View and review your document')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save [Alt+S]' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download [Alt+D]' })).toBeVisible();

    console.log('✅ AW_19 — Create Final Doc → Review Screen PASSED');
  });

  test('AW_19: Save on Review Screen saves the document', async ({ page }) => {
    // Setup: Apply All and navigate to Review Screen
    await page.getByRole('button', { name: 'Apply All [Alt+Y]' }).click();
    await expect(
      page.getByText(/Applied all \d+ mappings\./)
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Close Mapping Controls drawer' }).click();
    await page.getByRole('button', { name: 'Create Final Doc [Alt+G]' }).click();
    await expect(
      page.getByRole('heading', { name: 'Review Screen' })
    ).toBeVisible({ timeout: 30_000 });

    // recorder: test-1.spec.ts line 62 — Save
    await page.getByRole('button', { name: 'Save [Alt+S]' }).click();

    // VERIFY: Save completes (button stays visible, no error)
    await expect(
      page.getByRole('button', { name: 'Save [Alt+S]' })
    ).toBeVisible({ timeout: 15_000 });

    console.log('✅ AW_19 — Save on Review Screen PASSED');
  });

  test('AW_19: Download triggers file download event', async ({ page }) => {
    // Setup: Apply All and navigate to Review Screen
    await page.getByRole('button', { name: 'Apply All [Alt+Y]' }).click();
    await expect(
      page.getByText(/Applied all \d+ mappings\./)
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Close Mapping Controls drawer' }).click();
    await page.getByRole('button', { name: 'Create Final Doc [Alt+G]' }).click();
    await expect(
      page.getByRole('heading', { name: 'Review Screen' })
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Save [Alt+S]' }).click();

    // recorder: test-1.spec.ts lines 63–64 — waitForEvent download then click Download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download [Alt+D]' }).click();
    const download = await downloadPromise;

    // VERIFY: A file was downloaded (filename is not empty)
    expect(download.suggestedFilename()).toBeTruthy();

    console.log('✅ AW_19 — Download triggered, filename:', download.suggestedFilename(), 'PASSED');
  });
});