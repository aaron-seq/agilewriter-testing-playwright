import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { runTrainingSetup } from './helpers/training-setup';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2817 | Feature: Add Source
 * Test ID: AW_15
 * Source: test-1.spec.ts lines 33–38 (recorder) —
 *   Add source → checkbox → Save → Accept pending changes
 */

test.describe('AW_15: Add Source', () => {
  test.setTimeout(600_000);

  test.beforeEach(async ({ page }) => {
    await runTrainingSetup(page);
  });

  test('AW_15: Add source button opens source selector dialog', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    // recorder: test-1.spec.ts line 33
    await page.getByRole('button', { name: 'Add source' }).click();

    // VERIFY: Source selector dialog/panel opens
    await expect(
      page.getByRole('dialog', { name: 'Select Source' })
        .or(page.getByRole('heading', { name: 'Select Source' }))
    ).toBeVisible({ timeout: 10_000 });

    // Close it
    await page.getByRole('button', { name: 'Close Select Source' }).click();

    console.log('✅ AW_15 — Add source dialog opens PASSED');
  });

  test('AW_15: Select source via checkbox, Save, and Accept pending changes', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    // ACTION: Open Add Source
    await page.getByRole('button', { name: 'Add source' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Select Source' })
        .or(page.getByRole('heading', { name: 'Select Source' }))
    ).toBeVisible({ timeout: 10_000 });

    // recorder: test-1.spec.ts line 34 — check nth(1) checkbox in the dialog
    await page.getByRole('checkbox').nth(1).check();

    // recorder: test-1.spec.ts line 35 — Save
    await page.getByRole('button', { name: 'Save' }).click();

    // VERIFY: Pending change shown
    await expect(
      page.getByRole('button', { name: 'Accept pending changes' })
    ).toBeVisible({ timeout: 10_000 });

    // ACTION: Accept pending changes (recorder: test-1.spec.ts line 36)
    await page.getByRole('button', { name: 'Accept pending changes' }).click();

    // VERIFY: Success toast
    await expect(page.getByText('Changes saved successfully')).toBeVisible({ timeout: 15_000 });

    console.log('✅ AW_15 — Add source, Save, Accept pending changes PASSED');
  });
});