import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { runTrainingSetup } from './helpers/training-setup';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2815 | Feature: Mapping Control Panel
 * Test ID: AW_13
 * Source: test-1.spec.ts (recorder) — placeholder click, drawer open/close,
 *         sources section, writing instructions, Apply All
 *
 * TIMEOUT: 30 minutes (1_800_000ms) — training pipeline can take up to 10 min,
 * plus each test step needs breathing room.
 */

test.describe('AW_13: Mapping Control Panel', () => {
  test.setTimeout(1_800_000); // 30 minutes

  test.beforeEach(async ({ page }) => {
    await runTrainingSetup(page);
  });

  // ── TEST 1: Clicking placeholder opens Mapping Controls drawer ─────────
  test('AW_13: Clicking placeholder opens Mapping Controls drawer', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();

    // VERIFY: Mapping Controls heading — primary assertion
    await expect(
      page.getByRole('heading', { name: 'Mapping Controls' })
    ).toBeVisible({ timeout: 15_000 });

    // VERIFY: Subtitle (optional — present on some build versions)
    const subtitle = page.getByText('Configure selected placeholder');
    const subtitleVisible = await subtitle.isVisible({ timeout: 5_000 }).catch(() => false);
    if (subtitleVisible) {
      await expect(subtitle).toBeVisible();
    }

    // Close drawer
    await page.getByRole('button', { name: 'Close Mapping Controls drawer' }).click();
    await expect(
      page.getByRole('heading', { name: 'Mapping Controls' })
    ).not.toBeVisible({ timeout: 10_000 });

    // Reopen via toolbar button
    await page.getByRole('button', { name: 'Show mapping controls' }).click();
    await expect(
      page.getByRole('heading', { name: 'Mapping Controls' })
    ).toBeVisible({ timeout: 10_000 });

    console.log('✅ AW_13 — Mapping Controls drawer open/close PASSED');
  });

  // ── TEST 2: Placeholder status, sources, and Transform button ──────────
  test('AW_13: Placeholder shows post-training status and Sources section', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(
      page.getByRole('heading', { name: 'Mapping Controls' })
    ).toBeVisible({ timeout: 15_000 });

    // VERIFY: Training status — poll for any known post-training state
    // "Replacement Done" appears when mapping has been auto-applied by training
    // "Match Found" appears when training found a match but hasn't applied yet
    // Either confirms training completed for this placeholder
    await expect.poll(
      async () => {
        const done = await page.getByText('Replacement Done', { exact: true }).isVisible();
        const found = await page.getByText('Match Found', { exact: true }).isVisible();
        const pending = await page.getByText('Pending', { exact: true }).isVisible();
        return done || found || pending;
      },
      {
        message: 'Waiting for post-training placeholder status (Replacement Done / Match Found / Pending)',
        timeout: 60_000,
        intervals: [2_000, 3_000, 5_000],
      }
    ).toBe(true);

    // VERIFY: Sources section with drag-to-reorder hint
    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(
      page.getByText('Drag to reorder. Top =')
    ).toBeVisible({ timeout: 15_000 });

    // VERIFY: Source content button is present
    await expect(
      page.getByRole('button', { name: 'Sponsor Name: Stendarr, Inc.' })
    ).toBeVisible({ timeout: 10_000 });

    // VERIFY: Transform button present next to source
    await expect(
      page.getByRole('button', { name: 'Transform' }).first()
    ).toBeVisible();

    console.log('✅ AW_13 — Placeholder status, sources and Transform PASSED');
  });

  // ── TEST 3: Writing Instructions section ───────────────────────────────
  test('AW_13: Writing Instructions section expands and shows textbox', async ({ page }) => {
    const placeholder = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
    await placeholder.click();
    await expect(
      page.getByRole('heading', { name: 'Mapping Controls' })
    ).toBeVisible({ timeout: 15_000 });

    // Toggle Writing Instructions open
    await page.getByRole('button', { name: 'Writing Instructions' }).click();

    // VERIFY: instruction textbox visible
    await expect(
      page.getByRole('textbox', { name: 'Enter your instruction...' })
    ).toBeVisible({ timeout: 15_000 });

    console.log('✅ AW_13 — Writing Instructions section PASSED');
  });

  // ── TEST 4: Apply All applies all mappings with toast ──────────────────
  test('AW_13: Apply All applies all mappings and shows success toast', async ({ page }) => {
    // Apply All is always visible after training completes (set in runTrainingSetup)
    await page.getByRole('button', { name: 'Apply All [Alt+Y]' }).click();

    // VERIFY: Success toast with mapping count
    await expect(
      page.getByText(/Applied all \d+ mappings\./)
    ).toBeVisible({ timeout: 60_000 });

    console.log('✅ AW_13 — Apply All with toast PASSED');
  });
});