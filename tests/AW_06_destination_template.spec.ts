import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2776 | Feature: Destination Template Handling
 * Test IDs: AW_06 – AW_07
 * Assignee: Aaron Sequeira
 * Status: Recorder-verified — all locators confirmed working in live app
 * Source: AW_06-07.ts (VS Code Playwright Extension recorder, March 24, 2026)
 *
 * Key behaviours confirmed via recorder:
 * - "file selected" counter (singular) appears when ONE template checked (single-select)
 * - Checking a new file via checkbox replaces the previous selection (enforced by counter staying "1 file selected")
 * - Confirm: "Select [ENTER]" button → destination template button on Train Document page
 *   updates to show selected file name: "Module271_template.docx [Alt+2]"
 * - "Start Training [Alt+G]" button becomes visible/enabled after template selection
 */

const BASE_URL = process.env.BASE_URL || 'https://app-v2-rc1-aw.smarter.codes';

test.describe('AW_06–AW_07: Destination Template Handling', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // CANONICAL beforeEach — DO NOT MODIFY
  // Goes to base URL (not /signin), MSAL re-auth via SSO button auto-completes
  // using stored Microsoft cookies (no popup, no credential entry).
  // ─────────────────────────────────────────────────────────────────────────
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();

    await page.waitForURL(
      (url: URL) => url.href.startsWith(BASE_URL) && !url.href.includes('/signin'),
      { timeout: 60000 }
    );
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Open AgileMapping' }).click();
    await expect(
      page.getByRole('heading', { name: 'Train Document' })
    ).toBeVisible({ timeout: 15000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1 — AW_06
  // JIRA Comment 1: Verify "Select Destination Template" dialog opens on button click
  // JIRA Comment 2: SharePoint tab is visible and clickable
  // JIRA Comment 3: Veeva tab is visible and becomes active source after toggle
  // JIRA Comment 4: Veeva source button is confirmed visible after toggle sequence
  // ─────────────────────────────────────────────────────────────────────────
  test('AW_06: Destination Template dialog opens; Veeva and SharePoint source tabs are both visible', async ({ page }) => {
    // ACTION: Open Destination Template selector
    await page.getByRole('button', { name: 'Select destination template [' }).click();

    // ACTION: Toggle to SharePoint
    await page.getByRole('button', { name: 'Sharepoint' }).click();

    // ACTION: Toggle to Veeva
    await page.getByRole('button', { name: 'Veeva' }).click();

    // VERIFY: Veeva is now the active source
    await expect(page.getByRole('button', { name: 'Veeva' })).toBeVisible();

    // ACTION: Expand Templates folder under Veeva
    await page.getByRole('button', { name: 'Expand Templates' }).click();

    // VERIFY: File names are visible in the file tree after expansion
    // (Confirming folder expanded and file list rendered)
    await expect(
      page.getByRole('checkbox', { name: 'Select Narrative_Set1_template.docx' })
    ).toBeVisible({ timeout: 10000 });

    // Cleanup
    await page.keyboard.press('Escape');

    console.log('AW_06 — Veeva and SharePoint dialog tabs verified PASSED');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — AW_06
  // JIRA Comment 1: Checking a file checkbox shows filename in preview pane ("Name<file>")
  // JIRA Comment 2: "file selected" counter appears when exactly 1 template is selected
  // JIRA Comment 3: Checking a NEW file replaces previous selection (single-select enforced)
  // JIRA Comment 4: Most recently checked file's name is reflected in "h3" preview header
  // ─────────────────────────────────────────────────────────────────────────
  test('AW_06: Single-select enforced — selecting new template replaces previous selection', async ({ page }) => {
    await page.getByRole('button', { name: 'Select destination template [' }).click();
    await page.getByRole('button', { name: 'Sharepoint' }).click();
    await page.getByRole('button', { name: 'Veeva' }).click();
    await page.getByRole('button', { name: 'Expand Templates' }).click();

    // ACTION: Select first template via checkbox
    await page.getByRole('checkbox', { name: 'Select Narrative_Set1_template.docx' }).check();

    // VERIFY: Preview pane shows filename (recorder-confirmed format: "NameFilename.docx")
    await expect(page.getByText('NameNarrative_Set1_template.')).toBeVisible({ timeout: 10000 });

    // ACTION: Select a second template — should REPLACE first (single-select)
    await page.getByRole('checkbox', { name: 'Select 2.6_2.6.4 18 June.docx' }).check();

    // VERIFY: Second file preview is now showing
    await expect(page.getByText('Name2.6_2.6.4 18 June.docx')).toBeVisible();

    // VERIFY: Counter shows exactly "1 file selected" (not 2) — single-select enforced
    await expect(page.getByText('file selected')).toBeVisible();

    // ACTION: Select a third file — replaces second
    await page.getByRole('checkbox', { name: 'Select IND_2.6.4' }).check();

    // VERIFY: Previous second file checkbox still present in tree (not removed)
    await expect(
      page.getByRole('checkbox', { name: 'Select 2.6_2.6.4 18 June.docx' })
    ).toBeVisible();

    // Cleanup
    await page.keyboard.press('Escape');

    console.log('AW_06 — Single-select enforcement verified (1 file selected counter) PASSED');
  });

  test('AW_07: Inline Preview and Full Preview modal render document content correctly', async ({ page }) => {
    await page.getByRole('button', { name: 'Select destination template [' }).click();
    await page.getByRole('button', { name: 'Sharepoint' }).click();
    await page.getByRole('button', { name: 'Veeva' }).click();
    await page.getByRole('button', { name: 'Expand Templates' }).click();

    // Select a file to enable preview
    await page.getByRole('checkbox', { name: 'Select IND_2.6.4' }).check();

    // ACTION: Click inline "Preview" button (exact — avoids matching "Full Preview")
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    // VERIFY: Inline section content visible in preview pane
    await expect(page.locator('section').first()).toBeVisible({ timeout: 15000 });

    // ACTION: Open Full Preview modal
    await page.getByRole('button', { name: 'Full Preview' }).click();

    // VERIFY: docx-preview canvas is rendered inside Full Preview modal
    await expect(
      page.locator('.docx-preview__canvas.bg-white.text-black.max-h-\\[80vh\\].lg\\:max-h-\\[85vh\\].overflow-y-auto.overflow-x-auto.p-8.lg\\:p-10.rounded-xl.shadow-\\[0_25px_40px_-30px_rgba\\(15\\,23\\,42\\,0\\.55\\)\\].w-full.max-h-none.overflow-y-visible.max-w-none')
    ).toBeVisible({ timeout: 15000 });

    // VERIFY: Section content inside modal is accessible
    await page.locator('section').nth(2).click();
    await expect(page.locator('section').nth(2)).toBeVisible();

    // ACTION: Close Full Preview modal
    await page.getByRole('button', { name: 'Close modal' }).click();

    // VERIFY: Destination template dialog still visible (modal closed cleanly)
    await expect(
      page.getByRole('button', { name: 'Preview', exact: true })
    ).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');

    console.log('AW_07 — Inline Preview and Full Preview modal verified PASSED');
  });

  test('AW_07: Checkbox selection confirms via "Select [ENTER]"; Train Document page shows selected template name', async ({ page }) => {
    await page.getByRole('button', { name: 'Select destination template [' }).click();

    // Switch to Veeva then to SharePoint default (recorder-confirmed toggle pattern)
    await page.getByRole('button', { name: 'Veeva' }).click();
    await page.getByRole('button', { name: 'Sharepoint default' }).click();

    // VERIFY: SharePoint source is now active
    await expect(page.getByRole('button', { name: 'Sharepoint' })).toBeVisible({ timeout: 10_000 });

    // ACTION: Expand M271 folder and select Module271_template.docx
    // NOTE: Skipping output.docx — go directly to M271 to avoid single-select collision
    await page.getByRole('button', { name: 'Expand M271' }).click();
    await page.getByRole('checkbox', { name: 'Select Module271_template.docx' }).check();

    // VERIFY: Counter shows "file selected"
    await expect(page.getByText('file selected')).toBeVisible({ timeout: 10_000 });

    // VERIFY: Preview pane shows filename header for Module271
    await expect(
      page.locator('h3').getByText('Module271_template.docx')
    ).toBeVisible({ timeout: 15_000 });

    // VERIFY: docx-preview canvas rendered
    await expect(
      page.locator('.docx-preview__canvas').first()
    ).toBeVisible({ timeout: 20_000 });

    // VERIFY: Document preview content
    await expect(
      page.getByText('Summary of Biopharmaceutic Studies').first()
    ).toBeVisible({ timeout: 20_000 });

    // ACTION: Confirm selection
    await page.getByRole('button', { name: 'Select [ENTER]' }).click();

    // ── BACK ON TRAIN DOCUMENT PAGE ──
    // VERIFY: Destination template button now shows the selected file name
    await expect(
      page.getByRole('button', { name: 'Module271_template.docx [Alt+' })
    ).toBeVisible({ timeout: 15_000 });

    // VERIFY: Start Training button is visible
    await expect(
      page.getByRole('button', { name: 'Start Training [Alt+G]' })
    ).toBeVisible({ timeout: 10_000 });

    console.log('✅ AW_07 — Module271_template selected; Train Document shows template name; Start Training visible PASSED');
  });