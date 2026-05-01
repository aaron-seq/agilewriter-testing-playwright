/**
 * health-report-runner.ts — Shared Helper for Health Report Scripts
 *
 * WHAT IT DOES:
 *   Provides a reusable function that runs a complete health report flow:
 *   1. Login (uses stored auth from playwright setup)
 *   2. Navigate to AgileMapping
 *   3. Enter output filename
 *   4. Select template document (via search box — name from .env)
 *   5. Select source documents (via search box — names from .env)
 *   6. Start training
 *   7. Wait for all 3 stages to complete
 *   8. Count placeholder colors (green/grey/blue/red/yellow)
 *   9. Apply All mappings
 *   10. Create final document
 *   11. Download and verify
 *
 * HOW FILE SELECTION WORKS (from Playwright Codegen recording, April 2026):
 *   Template: Click "Select destination template" → type in search box →
 *             wait for folder → expand folder → wait for file → check file checkbox →
 *             click "Select [ENTER]"
 *   Sources:  Click "Select source documents" → for each source file:
 *             type in search box → wait for folder → expand → check file checkbox →
 *             click "Done [ENTER]"
 *
 *   Key insight from recording: After typing in the search box, files appear
 *   under expandable folders. We need to expand the folder BEFORE selecting.
 *   Folder names are configured via .env (HEALTH_TEMPLATE_FOLDER, HEALTH_SOURCE_FOLDER).
 *
 * WHY .env FOR FILE SELECTION:
 *   - Client provides different documents each time
 *   - No code changes needed — just update .env
 *   - Same script structure works for ICF, CSR, M264, or any new doc type
 *
 * CONSEQUENCES OF THIS APPROACH:
 *   - Pro: One helper serves all 4+ health report scripts
 *   - Pro: Dynamic file selection works for any document in SharePoint
 *   - Con: If file not found in search, test fails immediately with clear error
 *   - Con: Cannot validate specific placeholder TEXT (only colors)
 *   - Con: Folder must be expanded after search — requires knowing folder name
 *
 * PLAYWRIGHT FEATURES USED:
 *   - getByRole('textbox', { name: 'Search files' }) — for search boxes
 *   - fill() instead of type() — faster, clears existing text
 *   - evaluateAll() — for counting placeholder colors in one browser call
 *   - expect.poll() — for waiting until placeholders appear progressively
 */

import { Page, Locator, expect } from '@playwright/test';
import { trackStep, trackSoftStep, countPlaceholderColors, ColorCounts } from './step-tracker';
import { openAgileMapping, waitForApplyAllToast, isVisible } from './app-navigation';

const UI_TIMEOUT = 60_000;
const TRAINING_TIMEOUT = 2_400_000;

/**
 * Configuration for a health report run.
 * All values can come from .env variables.
 */
export type HealthReportConfig = {
  /** Human-readable name for this report (e.g., "ICF Trimmed") */
  reportName: string;
  /** Template document filename (e.g., "ICF_SET0_TRIMMED.docx") */
  templateName: string;
  /** Folder name that appears after searching for the template (e.g., "QA Testing") */
  templateFolder: string;
  /** Source document filenames — comma-separated in .env, array here */
  sourceNames: string[];
  /**
   * Folder name for source documents (e.g., "QA Testing", "CSR")
   * After searching, this folder appears and must be expanded/selected.
   */
  sourceFolder: string;
  /** Prefix for the output filename (e.g., "ICF_Trimmed") */
  outputPrefix: string;
  /**
   * Expected training time in minutes — used to set appropriate timeouts.
   * The actual timeout is this value × 2 (for safety buffer).
   */
  expectedTrainingMinutes: number;
  /**
   * Tab to select in the picker dialog before searching.
   * The picker has "Clinical" (default) and "Non-Clinical" tabs.
   * M264 documents are under "Non-Clinical".
   * If omitted, defaults to "Clinical" (no tab click needed).
   */
  templateTab?: 'Clinical' | 'Non-Clinical';
};

// ──────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────


/**
 * Select a template document using the search-based approach.
 *
 * FLOW (learned from recorded test-1.spec.ts):
 *   1. Click "Select destination template" button
 *   2. Type filename in the search box
 *   3. Wait for search results
 *   4. Expand the folder containing the file
 *   5. Check the file's checkbox
 *   6. Click "Select [ENTER]" to confirm
 *
 * WHY search-based instead of folder navigation:
 *   - Works regardless of which folder the file is in
 *   - No need to click "Next page" buttons repeatedly
 *   - Faster and more reliable
 *   - Matches how a human user would find a specific file
 */
async function selectTemplateBySearch(
  page: Page,
  templateName: string,
  folderName: string,
  templateTab?: 'Clinical' | 'Non-Clinical'
): Promise<void> {
  console.log(`[Template] Selecting "${templateName}" in folder "${folderName}" (${templateTab || 'Clinical'})`);

  // 1. Open the template picker
  await page.getByRole('button', { name: /Select destination template/i }).click();
  await expect(
    page.getByRole('heading', { name: /Select Destination Template/i })
  ).toBeVisible({ timeout: UI_TIMEOUT });

  // 1b. Switch tab if needed (e.g., Non-Clinical for M264)
  if (templateTab && templateTab !== 'Clinical') {
    const tab = page.getByRole('tab', { name: templateTab });
    await expect(tab).toBeVisible({ timeout: UI_TIMEOUT });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: UI_TIMEOUT });
    console.log(`[Template] Switched to "${templateTab}" tab`);
  }

  // 2. Search for file by name
  const searchBox = page.getByRole('textbox', { name: 'Search files' });
  await expect(searchBox).toBeVisible({ timeout: UI_TIMEOUT });
  await searchBox.click();
  await searchBox.fill(templateName);
  console.log(`[Template] Searching for "${templateName}"...`);

  // 3. Wait for the expand button and click the left side arrow (Expand)
  const expandButton = page.getByRole('button', { name: `Expand ${folderName}` });
  await expect(expandButton).toBeVisible({ timeout: 20_000 });
  await expandButton.click();
  console.log(`[Template] Clicked expand for folder "${folderName}"`);

  // 4. Wait for Collapse confirmation before proceeding
  const collapseButton = page.getByRole('button', { name: `Collapse ${folderName}` });
  await expect(collapseButton).toBeVisible({ timeout: UI_TIMEOUT });
  console.log(`[Template] Expanded folder "${folderName}" confirmed`);

  // 5. Select the file's checkbox
  const fileCheckbox = page.getByRole('checkbox', { name: `Select ${templateName}` }).first();
  await expect(fileCheckbox).toBeVisible({ timeout: UI_TIMEOUT });
  await fileCheckbox.check();
  console.log(`[Template] ✓ Checked "${templateName}"`);

  // 6. Assert "file selected" text visible
  await expect(page.getByText(/file selected/i)).toBeVisible({ timeout: UI_TIMEOUT });

  // 7. Click "Select [ENTER]"
  const selectBtn = page.getByRole('button', { name: 'Select [ENTER]' });
  await selectBtn.click();

  // Ensure dialog closes
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT }).catch(async () => {
    console.log('  ⚠ Dialog did not close, trying Enter key...');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT });
  });

  // 8. Verify the selected template name appears on the Train Document screen
  const escapedName = templateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(
    page.getByRole('button', { name: new RegExp(escapedName, 'i') })
  ).toBeVisible({ timeout: UI_TIMEOUT });
  console.log(`[Template] ✓ Template "${templateName}" confirmed on screen`);
}

/**
 * Select source documents using individual file selection.
 *
 * FLOW (from Playwright Codegen recording, April 2026):
 *   1. Click "Select source documents" button
 *   2. For each source file:
 *      a. Type filename in search box
 *      b. Wait for folder to appear in results
 *      c. Expand the folder
 *      d. Wait for file checkbox to appear
 *      e. Check the file's checkbox (NOT the folder checkbox)
 *   3. Click "Done [ENTER]" to confirm
 *
 * KEY INSIGHT from recording:
 *   - Source documents may live in a DIFFERENT folder than templates
 *     (e.g., ICF sources are under "Protocol", not "QA Testing")
 *   - We must select individual file checkboxes, not folder checkboxes
 *   - The folder name comes from config.sourceFolder in .env
 */
async function selectSourcesBySearch(
  page: Page,
  sourceNames: string[],
  sourceFolder: string,
  templateTab?: 'Clinical' | 'Non-Clinical'
): Promise<void> {
  console.log(`[Sources] Selecting ${sourceNames.length} files from folder "${sourceFolder}" (${templateTab || 'Clinical'})`);

  // 1. Open the source picker
  await page.getByRole('button', { name: /Select source documents/i }).click();

  // 1b. Switch tab if needed (e.g., Non-Clinical for M264)
  if (templateTab && templateTab !== 'Clinical') {
    const tab = page.getByRole('tab', { name: templateTab });
    if (await tab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: UI_TIMEOUT });
      console.log(`[Sources] Switched to "${templateTab}" tab`);
    }
  }

  // Wait for picker to load
  const searchBox = page.getByRole('textbox', { name: 'Search files' });
  await expect(searchBox).toBeVisible({ timeout: UI_TIMEOUT });

  // 2. Select each source file individually
  for (const sourceName of sourceNames) {
    if (!sourceName.trim()) continue;
    console.log(`[Sources] Searching for "${sourceName}"...`);

    // Search for this specific file
    await searchBox.click();
    await searchBox.fill(sourceName);

    // Expand the folder
    const expandButton = page.getByRole('button', { name: `Expand ${sourceFolder}` });
    await expect(expandButton).toBeVisible({ timeout: 20_000 });
    await expandButton.click();
    console.log(`[Sources] Clicked expand for folder "${sourceFolder}"`);

    // Wait for collapse to confirm expansion
    const collapseButton = page.getByRole('button', { name: `Collapse ${sourceFolder}` });
    await expect(collapseButton).toBeVisible({ timeout: UI_TIMEOUT });

    // Select the exact file checkbox (NOT the folder checkbox)
    const fileCheckbox = page.getByRole('checkbox', { name: `Select ${sourceName}` }).first();
    await expect(fileCheckbox).toBeVisible({ timeout: UI_TIMEOUT });
    await fileCheckbox.check();
    console.log(`[Sources] ✓ Checked "${sourceName}"`);
  }

  // 3. Confirm selection count
  if (sourceNames.length > 0) {
    await expect(page.getByText(new RegExp(`${sourceNames.length} files? selected`, 'i'))).toBeVisible({ timeout: UI_TIMEOUT });
  }

  // 4. Confirm selection
  const doneBtn = page.getByRole('button', { name: 'Done [ENTER]' });
  await doneBtn.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT }).catch(async () => {
    console.log('  ⚠ Dialog did not close, trying Enter key...');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT });
  });
  console.log(`[Sources] Clicked Done — verifying selection...`);

  // 5. Verify the source selection appears (flexible: matches "N files:" or single file name)
  if (sourceNames.length > 0 && sourceNames[0].trim()) {
    const firstSourceRaw = sourceNames[0].trim();
    const firstSourceTruncated = firstSourceRaw.substring(0, 15);
    const firstSourceEscapedSafe = firstSourceTruncated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    await expect(
      page.getByRole('button', { name: new RegExp(`(${firstSourceEscapedSafe}|\\d+ files:)`, 'i') })
    ).toBeVisible({ timeout: UI_TIMEOUT });
  }
  console.log(`[Sources] ✓ All ${sourceNames.length} sources confirmed`);
}

/**
 * Wait for all 3 training stages to complete.
 * Stages: Indexing Sources → Finding Placeholder Matches → Populating Placeholders
 */
async function waitForTrainingStages(page: Page, timeout: number): Promise<void> {
  const completedSelector = '[aria-label="Completed"], img[alt="Completed"], [title="Completed"]';
  const processingSelector = '[aria-label="Processing"], img[alt="Processing"], [title="Processing"]';

  const stages = ['Indexing Sources', 'Finding Placeholder Matches', 'Populating Placeholders'];

  for (let i = 0; i < stages.length; i++) {
    const label = stages[i];
    console.log(`  ⏳ Waiting for stage: "${label}"...`);

    const rowWithProcessing = page
      .locator('div, li, [role="listitem"]')
      .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
      .filter({ has: page.locator(processingSelector) })
      .last();

    const rowWithCompleted = page
      .locator('div, li, [role="listitem"]')
      .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
      .filter({ has: page.locator(completedSelector) })
      .last();

    // Wait for the stage to start processing or complete
    await expect(rowWithProcessing.or(rowWithCompleted)).toBeVisible({ timeout });

    // Wait for it to reach completed state
    await expect(rowWithCompleted).toBeVisible({ timeout });

    // Verify the cumulative completed count
    await expect
      .poll(async () => page.locator(completedSelector).count(), { timeout })
      .toBeGreaterThanOrEqual(i + 1);

    console.log(`  ✅ Stage "${label}" completed.`);
  }
}

// ──────────────────────────────────────────────
// MAIN HEALTH REPORT RUNNER
// ──────────────────────────────────────────────

/**
 * Run a complete health report for a specific document type.
 *
 * This is the main function called by each health report spec file.
 * It orchestrates the entire flow from login to download.
 *
 * @param page   - Playwright Page object
 * @param config - Configuration for this health report (from .env)
 */
export async function runHealthReport(
  page: Page,
  config: HealthReportConfig
): Promise<void> {
  const testName = `Health: ${config.reportName}`;
  const trainingTimeout = config.expectedTrainingMinutes * 2 * 60_000; // 2× buffer

  // ─── Step 1: Navigate to AgileMapping ───
  await trackStep(page, testName, 'Navigate to AgileMapping',
    'User lands on Train Document screen', async () => {
      await openAgileMapping(page);
      await expect(page.getByRole('heading', { name: /Train Document/i })).toBeVisible({
        timeout: UI_TIMEOUT,
      });
    });

  // ─── Step 2: Enter output filename ───
  const outputFileName = `${config.outputPrefix}_${Date.now()}`;
  await trackStep(page, testName, 'Enter output filename',
    'Output filename is accepted', async () => {
      await page.getByRole('textbox', { name: /Enter desired output filename/i }).fill(outputFileName);
    });

  // ─── Step 3: Select template ───
  await trackStep(page, testName, `Select template: ${config.templateName}`,
    'Template document is selected from file picker', async () => {
      await selectTemplateBySearch(page, config.templateName, config.templateFolder, config.templateTab);
    });

  // ─── Step 4: Select source documents ───
  await trackStep(page, testName, `Select sources: ${config.sourceNames.join(', ')}`,
    'Source documents are selected from file picker', async () => {
      await selectSourcesBySearch(page, config.sourceNames, config.sourceFolder, config.templateTab);
    });

  // ─── Step 5: Start training ───
  await trackStep(page, testName, 'Start training',
    'Training process begins', async () => {
      await expect(page.getByRole('button', { name: /Start Training/i })).toBeVisible({
        timeout: UI_TIMEOUT,
      });
      await page.getByRole('button', { name: /Start Training/i }).click();

      // Wait for training workspace to load
      await expect(page.getByText(/Connecting to SharePoint and/i)).toBeVisible({
        timeout: UI_TIMEOUT,
      });
    });

  // ─── Step 6: Wait for workspace shell ───
  await trackStep(page, testName, 'Wait for workspace to load',
    'Training workspace shell is ready', async () => {
      await expect(page.getByRole('button', { name: /Create\s*Final\s*Doc/i })).toBeVisible({
        timeout: trainingTimeout,
      });
    });

  // Soft: UI labels are nice to verify but don't block training
  await trackSoftStep(page, testName, 'Verify workspace UI elements',
    'Document list and mapping controls buttons visible', async () => {
      await expect(page.getByRole('button', { name: /Show document list/i })).toBeVisible({
        timeout: UI_TIMEOUT,
      });
      await expect(page.getByRole('button', { name: /Show mapping controls/i })).toBeVisible({
        timeout: UI_TIMEOUT,
      });
    });

  // ─── Step 7: Wait for placeholders to appear ───
  await trackStep(page, testName, 'Wait for placeholders',
    'Placeholders are rendered in the document', async () => {
      const placeholders = page.locator('.doc-placeholder');
      await expect
        .poll(async () => placeholders.count(), {
          timeout: 120_000,
          intervals: [2_000, 3_000, 5_000],
        })
        .toBeGreaterThan(0);

      const count = await placeholders.count();
      console.log(`  📋 Found ${count} placeholders.`);
    });

  // ─── Step 8: Wait for all 3 training stages ───
  await trackStep(page, testName, 'Wait for training stages',
    'All 3 stages complete (Indexing, Matching, Populating)', async () => {
      await waitForTrainingStages(page, trainingTimeout);
    });

  // ─── Step 9: Count placeholder colors (PRE-APPLY) — SOFT: informational, don't stop ───
  let preApplyColors: ColorCounts = { green: 0, grey: 0, blue: 0, red: 0, yellow: 0, other: 0 };
  preApplyColors = await countPlaceholderColors(page);
  await trackSoftStep(page, testName, 'Count placeholder colors (pre-apply)',
    'Placeholder color distribution is recorded', async () => {
      // Color counts are captured before trackSoftStep so the report receives populated data.
    }, preApplyColors);

  // ─── Step 10: Apply All mappings ───
  await trackStep(page, testName, 'Apply All mappings',
    'All placeholder mappings are applied', async () => {
      // Set up toast detection before clicking
      const toastPromise = waitForApplyAllToast(page);

      await page.getByRole('button', { name: /Apply All/i }).click();
      const toastText = await toastPromise;
      console.log(`  ✅ ${toastText}`);
    });

  // ─── Step 11: Count placeholder colors (POST-APPLY) — SOFT: informational ───
  let postApplyColors: ColorCounts = { green: 0, grey: 0, blue: 0, red: 0, yellow: 0, other: 0 };
  postApplyColors = await countPlaceholderColors(page);
  await trackSoftStep(page, testName, 'Count placeholder colors (post-apply)',
    'Final placeholder color distribution after applying', async () => {
      // Color counts are captured before trackSoftStep so the report receives populated data.
    }, postApplyColors);

  // ─── Step 12: Create Final Document ───
  await trackStep(page, testName, 'Create Final Document',
    'Final document generation starts', async () => {
      await expect(page.getByRole('button', { name: /Create\s*Final\s*Doc/i })).toBeEnabled({
        timeout: 300_000,
      });
      await page.getByRole('button', { name: /Create\s*Final\s*Doc/i }).click();

      await expect(page).toHaveURL(/.*\/review\?id=.*/, { timeout: 600_000 });
    });

  // ─── Step 13: Save/Download document ───
  await trackStep(page, testName, 'Download generated document',
    'Document file is downloaded successfully', async () => {
      const saveButton = page
        .getByRole('button', { name: /^Save(?:\s*\[Alt\+[A-Z]\])?$/i })
        .or(page.getByRole('button', { name: /\bSave\b/i }))
        .first();

      await expect(saveButton).toBeVisible({ timeout: 300_000 });

      const downloadPromise = page.waitForEvent('download', { timeout: 120_000 }).catch(() => null);
      await saveButton.click({ timeout: 120_000 });

      const download = await downloadPromise;
      if (download) {
        const filename = await download.suggestedFilename();
        console.log(`  📥 Downloaded: ${filename}`);
      } else {
        // Check for download button as fallback
        const downloadBtn = page.getByRole('button', { name: /Download/i }).first();
        if (await isVisible(downloadBtn, 5_000)) {
          const dlPromise = page.waitForEvent('download', { timeout: 120_000 });
          await downloadBtn.click();
          const dl = await dlPromise;
          console.log(`  📥 Downloaded: ${await dl.suggestedFilename()}`);
        }
      }

      await expect(page.locator('body')).toContainText(
        /download|saved|document ready|success/i,
        { timeout: 120_000 }
      );
    });

  console.log(`\n🎉 Health Report for "${config.reportName}" complete!`);
  console.log(`  Pre-apply:  Green=${preApplyColors.green} Grey=${preApplyColors.grey} Blue=${preApplyColors.blue} Red=${preApplyColors.red}`);
  console.log(`  Post-apply: Green=${postApplyColors.green} Grey=${postApplyColors.grey} Blue=${postApplyColors.blue} Red=${postApplyColors.red}`);
}
