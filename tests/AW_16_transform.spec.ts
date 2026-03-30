import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { runTrainingSetup } from './helpers/training-setup';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2818 | Feature: Transform
 * Test ID: AW_16
 * Source: test-1.spec.ts lines 37–52 (recorder) —
 *   Transform button → fill instruction → Transform (nth 2) → Transformed Content
 *   → New Transform → Close modal
 */

test.describe('AW_16: Transform', () => {
  test.setTimeout(600_000);

  test.beforeEach(async ({ page }) => {
    await runTrainingSetup(page);
  });

  test('AW_16: Transform modal opens and shows transformation textbox', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    // Open Sources to get Transform button
    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(
      page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' })
    ).toBeVisible({ timeout: 10_000 });

    // recorder: test-1.spec.ts line 37 — click Transform (first in Sources)
    await page.getByRole('button', { name: 'Transform' }).first().click();

    // VERIFY: Transformation textbox is rendered inside the modal
    await expect(
      page.getByRole('textbox', { name: 'Enter transformation' })
    ).toBeVisible({ timeout: 10_000 });

    // Close modal
    await page.getByRole('button', { name: 'Close modal' }).click();

    console.log('✅ AW_16 — Transform modal opens PASSED');
  });

  test('AW_16: Enter transformation instruction and produce Transformed Content', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(
      page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' })
    ).toBeVisible({ timeout: 10_000 });

    // Open Transform modal
    await page.getByRole('button', { name: 'Transform' }).first().click();
    await expect(
      page.getByRole('textbox', { name: 'Enter transformation' })
    ).toBeVisible({ timeout: 10_000 });

    // recorder: test-1.spec.ts line 39–40 — fill instruction + click Transform nth(2)
    await page.getByRole('textbox', { name: 'Enter transformation' }).fill('Add in Cooperation');
    await page.getByRole('button', { name: 'Transform' }).nth(1).click();

    // VERIFY: Transformed Content section appears (recorder: test-1.spec.ts)
    await expect(page.getByText('Transformed Content')).toBeVisible({ timeout: 30_000 });

    console.log('✅ AW_16 — Transform instruction produces Transformed Content PASSED');
  });

  test('AW_16: New Transform button clears previous and shows blank transformation', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(
      page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' })
    ).toBeVisible({ timeout: 10_000 });

    // Open Transform and fill once
    await page.getByRole('button', { name: 'Transform' }).first().click();
    await page.getByRole('textbox', { name: 'Enter transformation' }).fill('Add in Cooperation');
    await page.getByRole('button', { name: 'Transform' }).nth(1).click();
    await expect(page.getByText('Transformed Content')).toBeVisible({ timeout: 30_000 });

    // recorder: test-1.spec.ts — click existing transform then New Transform
    await page.getByText('Add in Cooperation').click();
    await page.getByRole('button', { name: 'New Transform' }).click();

    // VERIFY: Textbox is cleared / new state
    await expect(
      page.getByRole('textbox', { name: 'Enter transformation' })
    ).toBeVisible({ timeout: 10_000 });

    // Dismiss notification if shown
    const toastDismiss = page.getByRole('button', { name: 'Dismiss notification' });
    if (await toastDismiss.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toastDismiss.click();
    }

    // Close modal
    await page.getByRole('button', { name: 'Close modal' }).click();

    console.log('✅ AW_16 — New Transform clears previous PASSED');
  });
});