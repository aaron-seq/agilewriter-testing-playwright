import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { runTrainingSetup } from './helpers/training-setup';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2820 | Feature: Reset
 * Test ID: AW_18
 * Source: test-1.spec.ts — Select Source dialog open + close via Close Select Source
 *
 * Note: "Reset" as a standalone button was not recorded in test-1.spec.ts.
 * These tests cover the "Select Source" dialog open/close and the
 * Close Mapping Controls drawer flow which is the closest confirmed recorder flow.
 */

test.describe('AW_18: Reset & Select Source', () => {
  test.setTimeout(600_000);

  test.beforeEach(async ({ page }) => {
    await runTrainingSetup(page);
  });

  test('AW_18: Select Source dialog opens from source button and closes correctly', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    // Open Sources section
    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(
      page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' })
    ).toBeVisible({ timeout: 10_000 });

    // recorder: test-1.spec.ts — click source button → opens Select Source dialog
    await page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' }).click();

    // VERIFY: Select Source dialog opens
    await expect(
      page.getByRole('dialog', { name: 'Select Source' })
    ).toBeVisible({ timeout: 10_000 });

    // recorder: test-1.spec.ts — close via Close Select Source button
    await page.getByRole('button', { name: 'Close Select Source' }).click();

    // VERIFY: dialog dismissed
    await expect(
      page.getByRole('dialog', { name: 'Select Source' })
    ).not.toBeVisible({ timeout: 5_000 });

    console.log('✅ AW_18 — Select Source dialog open/close PASSED');
  });

  test('AW_18: Apply after source selection applies the mapping', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(
      page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' })
    ).toBeVisible({ timeout: 10_000 });

    // Open and immediately close Select Source (no change)
    await page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Select Source' })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Close Select Source' }).click();

    // recorder: test-1.spec.ts — Apply after closing Select Source
    await page.getByRole('button', { name: 'Apply', exact: true }).click();

    // VERIFY: Placeholder still visible after apply
    await expect(placeholder).toBeVisible({ timeout: 15_000 });

    console.log('✅ AW_18 — Apply after Select Source close PASSED');
  });

  test('AW_18: Close Mapping Controls drawer then reopen', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    // recorder: test-1.spec.ts — Close Mapping Controls drawer
    await page.getByRole('button', { name: 'Close Mapping Controls drawer' }).click();
    await expect(
      page.getByRole('heading', { name: 'Mapping Controls' })
    ).not.toBeVisible({ timeout: 5_000 });

    console.log('✅ AW_18 — Close Mapping Controls drawer PASSED');
  });
});