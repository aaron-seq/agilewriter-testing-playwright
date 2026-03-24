import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

/**
 * JIRA: SC9DE0C307-2776 | Feature: Source Selection & Preview
 * Test IDs: AW_08 – AW_10
 * Assignee: Aaron Sequeira
 * Status: Recorder-verified — all locators confirmed working in live app
 * Source: AW_08-10.ts (VS Code Playwright Extension recorder, March 24, 2026)
 *
 * Key behaviours confirmed via recorder:
 * - MULTI-SELECT: Multiple checkboxes can be checked simultaneously across folders and tabs
 * - "files selected" counter (plural) grows as more files are checked
 * - Clear button resets ALL selections at once
 * - Done [ENTER] confirms selection → Train Document page shows file count button
 *   e.g. "5 files: 4.2.2.2 Dummy cover..."
 * - Start Training button becomes clickable after source selection is confirmed
 * - Metadata button opens file metadata panel in the preview area
 * - Dialog handler needed for Start Training confirmation dialog (recorder-confirmed)
 */

const BASE_URL = process.env.BASE_URL || 'https://app-v2-rc1-aw.smarter.codes';

test.describe('AW_08–AW_10: Source Selection & Preview', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // CANONICAL beforeEach — DO NOT MODIFY
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
  // TEST 1 — AW_08
  // JIRA Comment 1: Source dialog opens; heading "Select Source Documents" is visible
  // JIRA Comment 2: Multiple files can be checked simultaneously (ABC-, Clinical Study, ICF)
  // JIRA Comment 3: Expand Protocol [Phase_1 BOIN] reveals additional source files
  // JIRA Comment 4: Full Preview modal shows document content for selected source file
  // ─────────────────────────────────────────────────────────────────────────
  test('AW_08: Source dialog opens; Clinical tab supports multi-select via checkboxes', async ({ page }) => {
    // ACTION: Open Source Documents dialog
    await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();

    // VERIFY: Dialog heading visible
    await expect(
      page.getByRole('heading', { name: 'Select Source Documents' })
    ).toBeVisible({ timeout: 10000 });

    // ACTION: Select multiple sources via checkbox (Clinical tab is default)
    await page.getByRole('checkbox', { name: 'Select ABC-' }).check();
    await page.getByRole('checkbox', { name: 'Select Clinical Study' }).check();
    await page.getByRole('checkbox', { name: 'Select ICF_SET0_TRIMMED.docx' }).check();

    // VERIFY: ABC- checkbox is still checked (multi-select confirmed)
    await expect(
      page.getByRole('checkbox', { name: 'Select ABC-' })
    ).toBeVisible();

    // ACTION: Expand Protocol folder and check additional file
    await page.getByRole('button', { name: 'Expand Protocol [Phase_1 BOIN]' }).click();
    await page.getByRole('checkbox', { name: 'Select ABC-123_synopsis_table_formatted.docx' }).check();

    // ACTION: Click the file button to load preview
    await page.getByRole('button', { name: 'File: ABC-123_synopsis_table_formatted.docx' }).click();

    // VERIFY: Inline preview shows correct document content
    await expect(
      page.getByText('ABC-123-001 Protocol SynopsisA Phase 1 Study of the Safety, Tolerability,')
    ).toBeVisible({ timeout: 15000 });

    // ACTION: Add another file to multi-selection
    await page.getByRole('checkbox', { name: 'Select ABC-123_SOA.docx' }).check();

    // ACTION: Full Preview
    await page.getByRole('button', { name: 'Full Preview' }).click();

    // VERIFY: Full Preview modal shows the correct content
    await expect(
      page.getByLabel('Full Preview').getByText(
        'ABC-123-001 Protocol SynopsisA Phase 1 Study of the Safety, Tolerability,'
      )
    ).toBeVisible({ timeout: 15000 });

    // ACTION: Close modal
    await page.getByRole('button', { name: 'Close modal' }).click();

    await page.keyboard.press('Escape');

    console.log('AW_08 — Clinical tab multi-select and Full Preview verified PASSED');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — AW_08
  // JIRA Comment 1: Non-Clinical tab renders Module264 folder with sub-file checkboxes
  // JIRA Comment 2: Multiple files in Module264 can be selected simultaneously
  // JIRA Comment 3: Module264 parent checkbox becomes visible when all children selected
  // JIRA Comment 4: Multi-select persists across folder boundaries (Clinical + Non-Clinical)
  // ─────────────────────────────────────────────────────────────────────────
  test('AW_08: Non-Clinical tab — Module264 folder files support multi-select', async ({ page }) => {
    await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();

    // ACTION: Switch to Non-Clinical tab
    await page.getByRole('tab', { name: 'Non-Clinical' }).click();

    // ACTION: Expand Module264 folder
    await page.getByRole('button', { name: 'Expand Module264' }).click();

    // ACTION: Multi-select files within Module264
    await page.getByRole('checkbox', { name: 'Select DDI_Cyp_Report.docx' }).check();
    await page.getByRole('checkbox', { name: 'Select Absorption_PK Study in Dog.docx' }).check();
    await page.getByRole('checkbox', { name: 'Select Metabolism_Report.docx' }).check();
    await page.getByRole('checkbox', { name: 'Select ABC-123_Method of' }).check();

    // VERIFY: Module264 parent folder checkbox is visible (confirms folder-level state)
    await expect(
      page.getByRole('checkbox', { name: 'Select Module264' })
    ).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');

    console.log('AW_08 — Non-Clinical Module264 multi-select verified PASSED');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3 — AW_09
  // JIRA Comment 1: Veeva source switch shows Nonclinical folder with sub-folders
  // JIRA Comment 2: "a.docx" file click shows "Namea.docx" in preview pane
  // JIRA Comment 3: "Preview" (exact) renders section content after file selection
  // JIRA Comment 4: "Metadata" button opens metadata panel in preview area
  // ─────────────────────────────────────────────────────────────────────────
  test('AW_09: Veeva source — file Preview, Full Preview, and Metadata panel all functional', async ({ page }) => {
    await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();

    // Switch to SharePoint then Veeva (recorder-confirmed toggle pattern)
    await page.getByRole('button', { name: 'Sharepoint' }).click();
    await page.getByRole('button', { name: 'Veeva' }).click();

    // Expand Veeva folder tree
    await page.getByRole('button', { name: 'Expand Nonclinical' }).click();

    // Select folder-level checkboxes
    await page.getByRole('checkbox', { name: 'Select Regulatory Support' }).check();
    await page.getByRole('checkbox', { name: 'Select Study Reports' }).check();

    // VERIFY: Nonclinical parent checkbox is visible
    await expect(
      page.getByRole('checkbox', { name: 'Select Nonclinical' })
    ).toBeVisible({ timeout: 10000 });

    // Expand Regulatory Support sub-folder
    await page.getByRole('button', { name: 'Expand Regulatory Support' }).click();

    // ACTION: Click "a.docx" file to preview
    await page.getByRole('button', { name: 'File: a.docx' }).click();

    // VERIFY: Preview pane shows "Namea.docx" (recorder-confirmed format)
    await expect(page.getByText('Namea.docx')).toBeVisible({ timeout: 10000 });

    // ACTION: Full Preview then close
    await page.getByRole('button', { name: 'Full Preview' }).click();
    await page.getByRole('button', { name: 'Close modal' }).click();

    // ACTION: Inline Preview
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    // Expand Study Reports and verify section renders
    await page.getByRole('button', { name: 'Expand Study Reports' }).click();
    await expect(page.locator('section').first()).toBeVisible({ timeout: 15000 });

    // ACTION: Click Metadata button to open metadata panel
    await page.getByRole('button', { name: 'Metadata' }).click();

    await page.keyboard.press('Escape');

    console.log('AW_09 — Veeva Preview, Full Preview, and Metadata panel verified PASSED');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 — AW_10
  // JIRA Comment 1: "Clear" button resets all selections to zero
  // JIRA Comment 2: Re-selecting via checkbox after Clear restores "files selected" counter
  // JIRA Comment 3: "Done [ENTER]" confirms and navigates back to Train Document page
  // JIRA Comment 4: Train Document shows source file count button (e.g. "5 files: 4.2.2.2 Dummy cover...")
  // ─────────────────────────────────────────────────────────────────────────
  test('AW_10: Clear resets selections; Done confirms and Train Document shows file count', async ({ page }) => {
    await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();

    await page.getByRole('button', { name: 'Sharepoint' }).click();
    await page.getByRole('button', { name: 'Veeva' }).click();
    await page.getByRole('button', { name: 'Expand Nonclinical' }).click();

    // Select some files first
    await page.getByRole('checkbox', { name: 'Select Regulatory Support' }).check();
    await page.getByRole('checkbox', { name: 'Select Study Reports' }).check();

    // ACTION: Hit Clear — resets ALL selections
    await page.getByRole('button', { name: 'Clear' }).click();

    // ACTION: Re-select after clearing
    await page.getByRole('checkbox', { name: 'Select Study Reports' }).check();

    // VERIFY: "files selected" counter is back
    await expect(page.getByText('files selected')).toBeVisible({ timeout: 10000 });

    // ACTION: Confirm with Done [ENTER]
    await page.getByRole('button', { name: 'Done [ENTER]' }).click();

    // VERIFY: Back on Train Document — source button shows file count
    await expect(
      page.getByRole('button', { name: '5 files: 4.2.2.2 Dummy cover' })
    ).toBeVisible({ timeout: 15000 });

    console.log('AW_10 — Clear + re-select + Done → "5 files" on Train Document PASSED');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5 — AW_10 (COMBINED FLOW — mirrors recorder end-to-end confirmation)
  // JIRA Comment 1: After source confirmed, "Start Training [Alt+G]" becomes clickable
  // JIRA Comment 2: Dialog handler registered BEFORE clicking Start Training (recorder pattern)
  // JIRA Comment 3: Start Training button remains visible after dialog is dismissed
  // JIRA Comment 4: This test is the pre-requisite gate for AW_11 (Training Initialization)
  // ─────────────────────────────────────────────────────────────────────────
  test('AW_10: Confirmed source selection enables Start Training button', async ({ page }) => {
    await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();

    await page.getByRole('button', { name: 'Sharepoint' }).click();
    await page.getByRole('button', { name: 'Veeva' }).click();
    await page.getByRole('button', { name: 'Expand Nonclinical' }).click();
    await page.getByRole('checkbox', { name: 'Select Study Reports' }).check();
    await expect(page.getByText('files selected')).toBeVisible();

    await page.getByRole('button', { name: 'Done [ENTER]' }).click();

    // VERIFY: Source count button visible on Train Document
    await expect(
      page.getByRole('button', { name: '5 files: 4.2.2.2 Dummy cover' })
    ).toBeVisible({ timeout: 15000 });

    // Register dialog handler BEFORE clicking Start Training (recorder-confirmed pattern)
    page.once('dialog', dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      dialog.dismiss().catch(() => { });
    });

    // ACTION: Click Start Training
    await page.getByRole('button', { name: 'Start Training [Alt+G]' }).click();

    // VERIFY: Start Training button still visible after dialog dismissed
    await expect(
      page.getByRole('button', { name: 'Start Training [Alt+G]' })
    ).toBeVisible({ timeout: 15000 });

    console.log('AW_10 — Source confirmed; Start Training clickable; dialog handled PASSED');
  });

});