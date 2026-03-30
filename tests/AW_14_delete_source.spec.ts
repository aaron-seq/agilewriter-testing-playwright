import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { runTrainingSetup } from './helpers/training-setup';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2816 | Feature: Remove Source
 * Test ID: AW_14
 * Source: test-1.spec.ts — "Remove source" button inside Sources section
 */

test.describe('AW_14: Remove Source', () => {
  test.setTimeout(600_000);

  test.beforeEach(async ({ page }) => {
    await runTrainingSetup(page);
  });

  test('AW_14: Remove source button is visible in Sources section', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    // Open Sources section
    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(
      page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' })
    ).toBeVisible({ timeout: 10_000 });

    // VERIFY: Remove source button is present
    await expect(
      page.getByRole('button', { name: 'Remove source' }).first()
    ).toBeVisible();

    console.log('✅ AW_14 — Remove source button visible PASSED');
  });

  test('AW_14: Remove source clears the source and shows pending change', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(
      page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' })
    ).toBeVisible({ timeout: 10_000 });

    // ACTION: Remove the source
    await page.getByRole('button', { name: 'Remove source' }).first().click();

    // VERIFY: Pending change counter or "No matches found" shows
    await expect(
      page.getByText(/Sources:.*remove|No matches found/)
    ).toBeVisible({ timeout: 10_000 });

    // ACTION: Accept pending changes
    await page.getByRole('button', { name: 'Accept pending changes' }).click();

    // VERIFY: Changes saved successfully toast
    await expect(page.getByText('Changes saved successfully')).toBeVisible({ timeout: 15_000 });

    // Dismiss toast if present
    const dismissBtn = page.getByRole('button', { name: 'Dismiss notification' });
    if (await dismissBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dismissBtn.click();
    }

    // ACTION: Apply
    await page.getByRole('button', { name: 'Apply', exact: true }).click();

    console.log('✅ AW_14 — Remove source with pending change and apply PASSED');
  });
});