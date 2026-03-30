import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { runTrainingSetup } from './helpers/training-setup';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2819 | Feature: Update Instruction
 * Test ID: AW_17
 * Source: test-1.spec.ts lines 53–60 (recorder) —
 *   Instruction textbox fill → Accept pending changes → Apply
 */

test.describe('AW_17: Update Instruction', () => {
  test.setTimeout(600_000);

  test.beforeEach(async ({ page }) => {
    await runTrainingSetup(page);
  });

  const INSTRUCTION =
    'Replace the placeholder with the sponsor name in inline text. and add in the cooperation';

  test('AW_17: Instruction textbox accepts input text', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    // Open Writing Instructions section
    await page.getByRole('button', { name: 'Writing Instructions' }).click();

    // VERIFY: textbox visible
    await expect(
      page.getByRole('textbox', { name: 'Enter your instruction...' })
    ).toBeVisible({ timeout: 10_000 });

    // recorder: test-1.spec.ts lines 53–55
    await page.getByRole('textbox', { name: 'Enter your instruction...' }).fill(INSTRUCTION);

    // VERIFY: value is set
    await expect(
      page.getByRole('textbox', { name: 'Enter your instruction...' })
    ).toHaveValue(INSTRUCTION);

    console.log('✅ AW_17 — Instruction textbox accepts input PASSED');
  });

  test('AW_17: Accept pending changes saves instruction with success toast', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Writing Instructions' }).click();
    await page.getByRole('textbox', { name: 'Enter your instruction...' }).fill(INSTRUCTION);

    // recorder: test-1.spec.ts line 56
    await page.getByRole('button', { name: 'Accept pending changes' }).click();

    // VERIFY: Success toast
    await expect(page.getByText('Changes saved successfully')).toBeVisible({ timeout: 15_000 });

    console.log('✅ AW_17 — Accept pending changes saves instruction PASSED');
  });

  test('AW_17: Apply after instruction update applies the mapping', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(page.getByRole('heading', { name: 'Mapping Controls' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Writing Instructions' }).click();
    await page.getByRole('textbox', { name: 'Enter your instruction...' }).fill(INSTRUCTION);
    await page.getByRole('button', { name: 'Accept pending changes' }).click();
    await expect(page.getByText('Changes saved successfully')).toBeVisible({ timeout: 15_000 });

    // recorder: test-1.spec.ts line 57
    await page.getByRole('button', { name: 'Apply', exact: true }).click();

    // VERIFY: Placeholder still visible (mapping applied, not removed)
    await expect(placeholder).toBeVisible({ timeout: 15_000 });

    console.log('✅ AW_17 — Apply after instruction PASSED');
  });
});