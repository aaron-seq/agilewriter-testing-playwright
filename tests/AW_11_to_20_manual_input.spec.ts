/**
 * AW_11_to_20_manual_input.spec.ts — Manual Input Variant
 *
 * WHAT IT DOES:
 *   Runs the full AW_11 to AW_20 document generation pipeline using
 *   manually-specified template and source documents from runtime-config.json.
 *   Supports nested folder paths (e.g., "ParentFolder/ChildFolder/DeepFolder")
 *   and Clinical / Non-Clinical tab switching.
 *
 *   After a successful run, auto-generates a health_[FormatName].spec.ts
 *   file with all values hardcoded for future re-runs.
 *
 * HOW TO CONFIGURE:
 *   Edit runtime-config.json with these fields:
 *     manualTemplateName:    "MyTemplate.docx"
 *     manualTemplateFolder:  "Folder/SubFolder"
 *     manualTemplateTab:     "Clinical" | "Non-Clinical"
 *     manualSourceFiles:     [{ "name": "Source1.docx", "folder": "Protocol" }]
 *     useQaFolderForSources: false
 *     generatedScriptName:   "MyFormat"
 *
 * HOW TO RUN:
 *   npx playwright test tests/AW_11_to_20_manual_input.spec.ts --headed
 */

import { test, expect, Locator, Page } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { openAgileMapping, isVisible, waitForApplyAllToast } from './helpers/app-navigation';
import { initTracker, saveResults, trackStep, trackSoftStep } from './helpers/step-tracker';
import {
  TrainingSession,
  acceptPendingChangesButton,
  addSourceButton,
  applyAllButton,
  applyButton,
  createFinalDocButton,
  ensureSourcesSectionOpen,
  ensureWritingInstructionsOpen,
  firstPlaceholder,
  instructionEditor,
  mappingControlsHeading,
  openFirstPlaceholder,
  removeSourceButton,
  restoreTrainingSession,
  savedChangesToast,
  sourcesToggle,
  transformButton,
  transformEditor,
  writingInstructionsToggle,
} from './helpers/training-setup';
import fs from 'fs';
import path from 'path';

const FOLDER_NAME = runtimeConfig.folder || 'QA Testing';

const UI_TIMEOUT = 60_000;
const TRAINING_TIMEOUT = 2_400_000;
const UPDATED_INSTRUCTION = 'Use the sponsor legal name exactly as written in the source.';
const ADVANCED_TRANSFORM_PROMPT = 'Add Dr. Karliah N. Gale, Senior MD Super Specialists';

/**
 * Escape special regex characters in a string for safe use in RegExp constructor.
 * @param str - The string to escape
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Expand nested folder path levels one at a time.
 * Given "ParentFolder/ChildFolder/DeepFolder", expands each level sequentially.
 * @param page      - Playwright Page
 * @param folderPath - Slash-separated folder path (e.g. "Protocol/SubFolder")
 */
async function expandNestedFolders(page: Page, folderPath: string): Promise<void> {
  const parts = folderPath.split('/').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const expandBtn = page.getByRole('button', { name: new RegExp(`Expand ${escapeRegExp(part)}`, 'i') });
    if (await expandBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expandBtn.click();
      await expect(
        page.getByRole('button', { name: new RegExp(`Collapse ${escapeRegExp(part)}`, 'i') })
      ).toBeVisible({ timeout: UI_TIMEOUT });
    }
  }
}

/**
 * Select a template document using manual configuration values.
 * Supports nested folders and tab switching (Clinical / Non-Clinical).
 *
 * @param page   - Playwright Page
 * @param config - Runtime config with manual template details
 * @returns The selected template filename
 */
async function selectManualTemplate(page: Page, config: typeof runtimeConfig): Promise<string> {
  const templateName = config.manualTemplateName!;
  const folderPath = config.manualTemplateFolder!;
  const tab = config.manualTemplateTab;

  console.log(`[Manual Template] Selecting "${templateName}" in folder "${folderPath}" (${tab || 'Clinical'})`);

  // 1. Open the template picker
  await page.getByRole('button', { name: /Select destination template/i }).click();
  await expect(
    page.getByRole('heading', { name: /Select Destination Template/i })
  ).toBeVisible({ timeout: UI_TIMEOUT });

  // 2. Switch tab if Non-Clinical
  if (tab === 'Non-Clinical') {
    const tabEl = page.getByRole('tab', { name: 'Non-Clinical' });
    await expect(tabEl).toBeVisible({ timeout: UI_TIMEOUT });
    await tabEl.click();
    await expect(tabEl).toHaveAttribute('aria-selected', 'true', { timeout: UI_TIMEOUT });
    console.log('[Manual Template] Switched to Non-Clinical tab');
  }

  // 3. Search for template
  const searchBox = page.getByRole('textbox', { name: 'Search files' });
  await expect(searchBox).toBeVisible({ timeout: UI_TIMEOUT });
  await searchBox.fill(templateName);

  // 4. Expand nested folder path
  await expandNestedFolders(page, folderPath);

  // 5. Check the file checkbox
  const fileCheckbox = page.getByRole('checkbox', {
    name: new RegExp(`Select ${escapeRegExp(templateName)}`, 'i'),
  }).first();
  await expect(fileCheckbox).toBeVisible({ timeout: UI_TIMEOUT });
  await fileCheckbox.check();
  console.log(`[Manual Template] ✓ Checked "${templateName}"`);

  // 6. Assert "file selected" text
  await expect(page.getByText(/file selected/i)).toBeVisible({ timeout: UI_TIMEOUT });

  // 7. Click "Select [ENTER]"
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  // Ensure dialog closes
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT }).catch(async () => {
    console.log('  ⚠ Dialog did not close, trying Enter key...');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT });
  });

  console.log(`[Manual Template] ✓ Template "${templateName}" confirmed`);
  return templateName;
}

/**
 * Select source documents using manual configuration values.
 * Supports two modes:
 *   MODE A (useQaFolderForSources=true): Check QA Testing folder checkbox
 *   MODE B (default): Loop individual files with nested folder expansion
 *
 * @param page   - Playwright Page
 * @param config - Runtime config with manual source details
 */
async function selectManualSources(page: Page, config: typeof runtimeConfig): Promise<void> {
  await page.getByRole('button', { name: /Select source documents/i }).click();

  if (config.useQaFolderForSources) {
    // MODE A — QA Testing folder-level checkbox
    const folderName = FOLDER_NAME;
    console.log(`[Manual Sources] MODE A — selecting entire "${folderName}" folder`);

    await page.getByRole('textbox', { name: 'Search files' }).fill(folderName);
    const folderButton = page.getByRole('button', { name: `Folder: ${folderName}` });
    await expect(folderButton).toBeVisible({ timeout: UI_TIMEOUT });

    await page.getByRole('checkbox', { name: `Select ${folderName}` }).check();
    await expect.soft(page.getByText(/\d+ files? selected/i)).toBeVisible({ timeout: UI_TIMEOUT });

    await page.getByRole('button', { name: 'Done [ENTER]' }).click();
    return;
  }

  // MODE B — Individual files with nested folder expansion
  const sourceFiles = config.manualSourceFiles || [];
  console.log(`[Manual Sources] MODE B — selecting ${sourceFiles.length} individual files`);

  const searchBox = page.getByRole('textbox', { name: 'Search files' });
  await expect(searchBox).toBeVisible({ timeout: UI_TIMEOUT });

  for (const source of sourceFiles) {
    if (!source.name.trim()) continue;
    console.log(`[Manual Sources] Searching for "${source.name}" in folder "${source.folder}"...`);

    await searchBox.click();
    await searchBox.fill(source.name);

    // Expand nested folder path
    await expandNestedFolders(page, source.folder);

    // Check the exact file checkbox
    const fileCheckbox = page.getByRole('checkbox', {
      name: new RegExp(`Select ${escapeRegExp(source.name)}`, 'i'),
    }).first();
    await expect(fileCheckbox).toBeVisible({ timeout: UI_TIMEOUT });
    await fileCheckbox.check();
    console.log(`[Manual Sources] ✓ Checked "${source.name}"`);
  }

  // Soft-assert count
  if (sourceFiles.length > 0) {
    await expect.soft(page.getByText(/\d+ files? selected/i)).toBeVisible({ timeout: UI_TIMEOUT });
  }

  // Confirm
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT }).catch(async () => {
    console.log('  ⚠ Dialog did not close, trying Enter key...');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT });
  });
  console.log(`[Manual Sources] ✓ All ${sourceFiles.length} sources confirmed`);
}

/**
 * After a successful test run, auto-generate a health_[Name].spec.ts file
 * with all values hardcoded for deterministic re-runs.
 *
 * @param config             - Runtime config
 * @param outputFileName     - The output filename used in this run
 * @param selectedTemplateName - The template filename selected
 */
function generateHealthScript(
  config: typeof runtimeConfig,
  outputFileName: string,
  selectedTemplateName: string
): void {
  const name = config.generatedScriptName || 'Generated';
  const templateFolder = config.manualTemplateFolder || FOLDER_NAME;
  const templateTab = config.manualTemplateTab || 'Clinical';
  const sourceFiles = config.manualSourceFiles || [];
  const sourceFolder = config.useQaFolderForSources
    ? FOLDER_NAME
    : sourceFiles.length > 0
      ? sourceFiles[0].folder
      : FOLDER_NAME;
  const sourceNamesArray = config.useQaFolderForSources
    ? '[] // QA folder mode — sources auto-selected'
    : sourceFiles.map((s) => `'${s.name}'`).join(',\n        ');

  const timestamp = new Date().toISOString();
  const templateTabLine = templateTab !== 'Clinical' ? `\n      templateTab: '${templateTab}',` : '';

  const content = `/**
 * health_${name}.spec.ts — Auto-generated Health Script
 * Generated: ${timestamp}
 * Source run: AW_11_to_20_manual_input
 *
 * HOW TO RUN:
 *   npx playwright test tests/health_${name}.spec.ts --headed
 */

import { test } from '@playwright/test';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';

test.describe('Health Report: ${name}', () => {
  test.describe.configure({ timeout: 3_600_000 });

  test.beforeAll(() => { initTracker(); });
  test.afterAll(() => { saveResults(); });

  test('${name} — Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = {
      reportName: '${name}',
      templateName: '${selectedTemplateName}',
      templateFolder: '${templateFolder}',${templateTabLine}
      sourceNames: [
        ${sourceNamesArray}
      ],
      sourceFolder: '${sourceFolder}',
      outputPrefix: '${name}_Test',
      expectedTrainingMinutes: 20,
    };
    await runHealthReport(page, config);
  });
});
`;

  const filePath = path.join('tests', `health_${name}.spec.ts`);
  fs.writeFileSync(filePath, content);
  console.log(`[Generator] ✓ Wrote ${filePath}`);
}

// ──────────────────────────────────────────────
// SHARED HELPERS (mirrored from QA folder variant)
// ──────────────────────────────────────────────

function finalDocSaveButton(page: Page): Locator {
  return page
    .getByRole('button', { name: /^Save(?:\s*\[Alt\+[A-Z]\])?$/i })
    .or(page.getByRole('button', { name: /\bSave\b/i }))
    .first();
}

function finalDocumentSignal(page: Page): Locator {
  return finalDocSaveButton(page)
    .or(page.getByRole('heading', { name: /Review Screen/i }))
    .or(page.getByRole('heading', { name: /download|final document|document ready/i }))
    .or(page.getByText(/download|final document|document ready/i).first())
    .first();
}

function primaryPlaceholder(page: Page): Locator {
  return page.locator('#placeholder-0').or(firstPlaceholder(page)).first();
}

function downloadButton(page: Page): Locator {
  return page.getByRole('button', { name: /Download/i }).first();
}

function pendingRemoveSourceButton(page: Page): Locator {
  return page
    .getByRole('button', { name: /Remove source/i })
    .or(page.getByRole('button', { name: /Delete source/i }))
    .or(page.getByLabel(/Remove source/i))
    .first();
}

function transformPromptEditor(page: Page): Locator {
  return page
    .getByRole('textbox', { name: /Enter transformation/i })
    .or(transformEditor(page))
    .first();
}

async function openPrimaryPlaceholder(page: Page): Promise<void> {
  await expect(primaryPlaceholder(page)).toBeVisible({ timeout: UI_TIMEOUT });
  await primaryPlaceholder(page).click({ force: true });
  await expect(mappingControlsHeading(page)).toBeVisible({ timeout: UI_TIMEOUT });
}

async function openFinalDocumentFlow(page: Page): Promise<void> {
  await expect(createFinalDocButton(page)).toBeEnabled({ timeout: 300_000 });
  await createFinalDocButton(page).click();

  await expect(page).toHaveURL(/.*\/review\?id=.*/, { timeout: 600_000 });
  await expect(finalDocumentSignal(page)).toBeVisible({ timeout: 600_000 });
}

// ──────────────────────────────────────────────
// MAIN TEST
// ──────────────────────────────────────────────

test('AW_11_to_20 Manual Input: Document Generation Stage', async ({ page }) => {
  // Validate required config
  if (!runtimeConfig.manualTemplateName || !runtimeConfig.manualTemplateFolder) {
    throw new Error(
      'Missing required runtime-config fields: manualTemplateName, manualTemplateFolder. ' +
      'Set these in runtime-config.json before running this script.'
    );
  }

  let selectedTemplateName = '';
  let outputFileName = '';
  let placeholders: Locator;

  // Raw RGB/A values
  const GREY_PATTERN = '156, 163, 175, 0.2';
  const YELLOW_PATTERN = '246, 234, 59, 0.18';
  const BLUE_PATTERN = '59, 130, 246, 0.18';
  const GREEN_PATTERN = '16, 185, 129, 0.2';
  const RED_PATTERN = '239, 68, 68';

  const buildColorRegex = (patterns: string[]) => {
    const escaped = patterns.map((p: string) => p.replace(/,\s*/g, '\\s*,\\s*').replace(/\./g, '\\.'));
    return new RegExp(`rgba?\\(\\s*(?:${escaped.join('|')})\\s*\\)`);
  };

  const verifyPlaceholderColors = async (stageName: string, expectedPatterns: string[]) => {
    console.log(`[VERIFY] Checking ${stageName} placeholder colors...`);
    const regex = buildColorRegex(expectedPatterns);
    const count = await placeholders.count();
    for (let i = 0; i < count; i++) {
      const locator = placeholders.nth(i);
      await expect(locator).toBeVisible();
      await expect(locator).toHaveCSS('background-color', regex, { timeout: 300_000 });
    }
    console.log(`[DONE] ${stageName} color verification passed ✓`);
  };

  // ─── AW_11: Training Init ───
  await trackStep(page, 'AW_11_to_20_manual', 'AW11 Training Init', 'Start training + workspace load', async () => {
    await openAgileMapping(page);
    await expect(page.getByRole('heading', { name: /Train Document/i })).toBeVisible({ timeout: UI_TIMEOUT });

    outputFileName = `AW_manual_${Date.now()}`;
    await page.getByRole('textbox', { name: /Enter desired output filename/i }).fill(outputFileName);

    // Select template via manual config
    selectedTemplateName = await selectManualTemplate(page, runtimeConfig);

    // Select sources via manual config
    await selectManualSources(page, runtimeConfig);

    // Start Training
    await expect(page.getByRole('button', { name: /Start Training/i })).toBeVisible({ timeout: UI_TIMEOUT });
    await page.getByRole('button', { name: /Start Training/i }).click();

    await expect(page.getByText(/Connecting to SharePoint and/i)).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByText(/Generating interactive/i)).toBeVisible({ timeout: UI_TIMEOUT });

    await expect(page.getByRole('button', { name: /Create\s*Final\s*Doc/i })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole('button', { name: /Show\s*document\s*list/i })).toBeVisible({ timeout: 600_000 });
    await expect(page.getByRole('button', { name: /Show\s*mapping\s*controls/i })).toBeVisible({ timeout: 600_000 });
  });

  // ─── AW_12B: Stage Monitoring ───
  await trackStep(page, 'AW_11_to_20_manual', 'AW12B Stage Monitoring', 'All 3 stages complete', async () => {
    await expect(page.getByRole('button', { name: 'Show mapping controls' })).toBeVisible();

    placeholders = page.locator('.doc-placeholder');
    await expect.poll(
      async () => placeholders.count(),
      { timeout: 120_000, intervals: [2_000, 3_000, 5_000, 5_000] }
    ).toBeGreaterThan(0);

    const COMPLETED_SELECTOR = '[aria-label="Completed"], img[alt="Completed"], [title="Completed"]';
    const PROCESSING_SELECTOR = '[aria-label="Processing"], img[alt="Processing"], [title="Processing"]';

    const stages = ['Indexing Sources', 'Finding Placeholder Matches', 'Populating Placeholders'];
    for (let i = 0; i < stages.length; i++) {
      const label = stages[i];
      const rowWithProcessing = page.locator('div, li, [role="listitem"]')
        .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
        .filter({ has: page.locator(PROCESSING_SELECTOR) })
        .last();
      const rowWithCompleted = page.locator('div, li, [role="listitem"]')
        .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
        .filter({ has: page.locator(COMPLETED_SELECTOR) })
        .last();

      await expect(rowWithProcessing.or(rowWithCompleted)).toBeVisible({ timeout: TRAINING_TIMEOUT });
      await expect(rowWithCompleted).toBeVisible({ timeout: TRAINING_TIMEOUT });
      await expect.poll(
        async () => page.locator(COMPLETED_SELECTOR).count(),
        { timeout: UI_TIMEOUT }
      ).toBeGreaterThanOrEqual(i + 1);
    }

    await expect(page.locator(PROCESSING_SELECTOR)).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator(COMPLETED_SELECTOR)).toHaveCount(3);
  });

  // ─── Apply All ───
  await trackSoftStep(page, 'AW_11_to_20_manual', 'AW12B Apply All', 'Apply All mappings', async () => {
    const toastPromise = waitForApplyAllToast(page, 10_000);
    await page.getByRole('button', { name: /Apply All/i }).click();
    const toastText = await toastPromise;
    expect(toastText).toMatch(/Applied all(?:\s+\d+)?\s+mappings?\.?/i);
    await verifyPlaceholderColors('Final (Post-Apply)', [GREEN_PATTERN, GREY_PATTERN, RED_PATTERN, BLUE_PATTERN]);
  });

  // ─── Final Gate ───
  await trackStep(page, 'AW_11_to_20_manual', 'AW12B Final Gate', 'Create Final Doc enabled', async () => {
    await expect(page.getByRole('button', { name: /Create\s*Final\s*Doc/i })).toBeEnabled({ timeout: 60_000 });
  });

  // ─── AW_13-18: Mapping Controls (Soft) ───
  await trackSoftStep(page, 'AW_13: Mapping Controls',
    'Verify placeholder details', 'Drawer opens and displays placeholder details', async () => {
      await openPrimaryPlaceholder(page);
      await expect(mappingControlsHeading(page)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByText(/Configure selected placeholder/i)).toBeVisible({ timeout: UI_TIMEOUT });
      await page.getByRole('button', { name: /Close Mapping Controls drawer/i }).click();
    });

  await trackSoftStep(page, 'AW_14: Source Management',
    'Verify Remove Source button', 'Remove source is available', async () => {
      await openPrimaryPlaceholder(page);
      await ensureSourcesSectionOpen(page);
      await expect(pendingRemoveSourceButton(page)).toBeVisible({ timeout: UI_TIMEOUT });
    });

  await trackSoftStep(page, 'AW_17/18: Writing Instructions',
    'Verify writing instructions', 'Instruction editor accepts text', async () => {
      await openPrimaryPlaceholder(page);
      const editor = await ensureWritingInstructionsOpen(page);
      await editor.fill(UPDATED_INSTRUCTION);
      await expect(editor).toHaveValue(UPDATED_INSTRUCTION, { timeout: UI_TIMEOUT });
      await page.getByRole('button', { name: /^Reset$/i }).first().click();
      const resetValue = await editor.inputValue();
      expect(resetValue).not.toBe(UPDATED_INSTRUCTION);
    });

  // ─── AW_19: Final Document Flow ───
  await trackStep(page, 'AW_19: Final Document Flow',
    'Create Final Doc', 'Review screen visible', async () => {
      await openFinalDocumentFlow(page);
      await expect(
        page.getByRole('heading', { name: /Review Screen/i })
          .or(finalDocSaveButton(page)).first()
      ).toBeVisible({ timeout: 120_000 });
    });

  // ─── AW_20: Document Download ───
  await trackStep(page, 'AW_20: Document Download',
    'Save/download document', 'Document downloads successfully', async () => {
      await expect(finalDocSaveButton(page)).toBeVisible({ timeout: 300_000 });

      const downloadFromSavePromise = page.waitForEvent('download', { timeout: 30_000 }).catch(() => null);
      await finalDocSaveButton(page).click();

      const directDownload = await downloadFromSavePromise;
      if (directDownload) {
        expect(await directDownload.suggestedFilename()).toMatch(/\.(docx|pdf|zip)$/i);
      } else {
        if (await isVisible(downloadButton(page), 5_000)) {
          const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
          await downloadButton(page).click();
          const downloadedFile = await downloadPromise;
          expect(await downloadedFile.suggestedFilename()).toMatch(/\.(docx|pdf|zip)$/i);
        }
      }

      await expect(page.locator('body')).toContainText(/download|saved|document ready|success/i, {
        timeout: 120_000,
      });
    });

  // ─── POST-TEST: Save run config & generate health script ───
  const configPath = path.join('reports', 'last-run-config.json');
  if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports', { recursive: true });
  }

  const sourceFolder = runtimeConfig.useQaFolderForSources
    ? FOLDER_NAME
    : (runtimeConfig.manualSourceFiles || [])[0]?.folder || FOLDER_NAME;

  const runConfig = {
    templateName: selectedTemplateName,
    templateFolder: runtimeConfig.manualTemplateFolder,
    templateTab: runtimeConfig.manualTemplateTab || 'Clinical',
    sourceFolder,
    outputPrefix: outputFileName,
    runDate: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(runConfig, null, 2));
  console.log(`[Config] ✓ Saved run config to ${configPath}`);

  // Auto-generate health script
  if (runtimeConfig.generatedScriptName) {
    generateHealthScript(runtimeConfig, outputFileName, selectedTemplateName);
  }
});
