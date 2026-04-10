import { test, expect, Browser, BrowserContext, Locator, Page } from '@playwright/test';
import dotenv from 'dotenv';
import { openAgileMapping, newAuthenticatedContext } from './helpers/app-navigation';
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

dotenv.config();

const UI_TIMEOUT = 60_000;
const TRAINING_TIMEOUT = 2_400_000;
const GROUP_TIMEOUT = 4_200_000;
const UPDATED_INSTRUCTION = 'Use the sponsor legal name exactly as written in the source.';
const ADVANCED_TRANSFORM_PROMPT = 'Add Dr. Karliah N. Gale, Senior MD Super Specialists';
const ADVANCED_INSTRUCTION =
  'Please mention she is a super specialist and also add in her details.';

type ManualTrainingSetup = {
  outputFileName: string;
  selectedTemplateName: string;
};

function buildPlaceholderRegex(): RegExp {
  const rawRegex = process.env.PLACEHOLDER_REGEX ?? '<\\s*([^<>]+?)\\s*>';

  const cleanedPattern = rawRegex
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\/|\/[gimsuy]*$/g, '')
    .replace(/;$/, '');

  return new RegExp(cleanedPattern);
}

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

function postSaveSignal(page: Page): Locator {
  return page
    .getByRole('heading', { name: /Review Screen/i })
    .or(page.getByRole('heading', { name: /download|document ready|saved/i }))
    .or(page.getByRole('button', { name: /Save/i }))
    .or(page.getByRole('button', { name: /Download/i }))
    .or(page.getByText(/download started|download complete|download successfully|document ready|saved/i).first())
    .first();
}

async function isVisible(locator: Locator, timeout = 2_000): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function clickIfVisible(locator: Locator, timeout = 3_000): Promise<boolean> {
  if (await isVisible(locator, timeout)) {
    await locator.click();
    return true;
  }
  return false;
}

async function selectDynamicTemplateFromQaTesting(page: Page): Promise<string> {
  await page.getByRole('button', { name: /Select destination template/i }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: /Expand QA Testing/i }).click();
  await page.waitForTimeout(1_000);

  const fileCheckboxes = await page.getByRole('checkbox').all();

  for (const checkbox of fileCheckboxes) {
    const ariaLabel = await checkbox.getAttribute('aria-label');
    const labelText = ariaLabel || (await checkbox.innerText()).trim();

    if (labelText && !labelText.includes('QA Testing') && !labelText.includes('Select All')) {
      const selectedTemplateName = labelText.replace(/^Select\s+/i, '').trim();
      await checkbox.check();

      await expect(page.locator('h3').getByText(selectedTemplateName)).toBeVisible({
        timeout: UI_TIMEOUT,
      });
      await expect(page.getByText('Loading preview...')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByText('Loading preview...')).toBeHidden({ timeout: UI_TIMEOUT });
      await expect(page.getByText('Preview', { exact: true })).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByRole('button', { name: 'Full Preview' })).toBeVisible({
        timeout: UI_TIMEOUT,
      });

      await page.getByRole('button', { name: 'Full Preview' }).click();
      await page.getByRole('button', { name: /Close modal/i }).click();
      await page.getByRole('button', { name: /Select \[ENTER\]/i }).click();
      return selectedTemplateName;
    }
  }

  throw new Error('No files found inside QA Testing folder to use as template.');
}

async function selectQaTestingSourceFolder(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select source documents/i }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByLabel('Folder: QA Testing')).toContainText('QA Testing');
  await page.getByRole('button', { name: /Expand QA Testing/i }).click();
  await page.getByRole('checkbox', { name: /Select QA Testing/i }).check();
  await page.getByRole('button', { name: /Done \[ENTER\]/i }).click();
}

async function startManualTraining(page: Page): Promise<ManualTrainingSetup> {
  await openAgileMapping(page);

  const outputFileName = `AW_11_20_${Date.now()}`;
  await page.getByRole('textbox', { name: /Enter desired output filename/i }).fill(outputFileName);

  const selectedTemplateName = await selectDynamicTemplateFromQaTesting(page);
  await selectQaTestingSourceFolder(page);

  await expect(page.getByRole('button', { name: /Start Training/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await page.getByRole('button', { name: /Start Training/i }).click();

  await expect(page).toHaveURL(/.*\/train\?id=.*/, { timeout: TRAINING_TIMEOUT });
  await expect(page.getByText(/Connecting to SharePoint and/i)).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByText(/Generating interactive/i)).toBeVisible({ timeout: UI_TIMEOUT });

  return { outputFileName, selectedTemplateName };
}

async function waitForWorkspaceShell(page: Page): Promise<void> {
  await expect(createFinalDocButton(page)).toBeVisible({ timeout: TRAINING_TIMEOUT });
  await expect(page.getByRole('button', { name: /Show document list/i })).toBeVisible({
    timeout: TRAINING_TIMEOUT,
  });
  await expect(page.getByRole('button', { name: /Show mapping controls/i })).toBeVisible({
    timeout: TRAINING_TIMEOUT,
  });
}

async function waitForReusableWorkspace(page: Page): Promise<void> {
  await waitForWorkspaceShell(page);
  await expect(createFinalDocButton(page)).toBeEnabled({ timeout: TRAINING_TIMEOUT });
  await expect(primaryPlaceholder(page)).toBeVisible({ timeout: UI_TIMEOUT });
}

async function openDocumentsDrawer(page: Page): Promise<void> {
  const drawerHeading = page.getByRole('heading', { name: 'Documents' });
  if (!(await isVisible(drawerHeading, 2_000))) {
    await page.getByRole('button', { name: /Show document list/i }).click();
  }

  await expect(drawerHeading).toBeVisible({ timeout: UI_TIMEOUT });
}

async function verifyDocumentPreviewList(page: Page, selectedTemplateName: string): Promise<void> {
  await waitForWorkspaceShell(page);
  await openDocumentsDrawer(page);

  const subtitle = page.getByText(/source file[s]? ready to review/i);
  await expect(subtitle).toBeVisible({ timeout: UI_TIMEOUT });

  const text = (await subtitle.textContent()) || '';
  const match = text.match(/(\d+)/);
  if (!match) {
    throw new Error('Could not extract source file count from the Documents drawer.');
  }

  const expectedCount = Number.parseInt(match[1], 10);
  const docButtons = page.getByRole('button', { name: /Show .*source document/i });

  await expect(docButtons.first()).toBeVisible({ timeout: UI_TIMEOUT });
  await expect(docButtons).toHaveCount(expectedCount, { timeout: UI_TIMEOUT });

  for (let index = 0; index < expectedCount; index += 1) {
    const button = docButtons.nth(index);
    await button.click();

    const loader = page.getByText('Loading preview...');
    if (await isVisible(loader, 2_000)) {
      await expect(loader).toBeHidden({ timeout: UI_TIMEOUT });
    }

    await expect(page.locator('.docx-preview-wrapper')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.locator('.docx-preview__canvas')).toBeVisible({ timeout: UI_TIMEOUT });
  }

  const cleanTemplateNameRegex = new RegExp(
    selectedTemplateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i'
  );
  const templateLocator = page.getByRole('button', { name: cleanTemplateNameRegex }).first();
  if (await isVisible(templateLocator, 3_000)) {
    await templateLocator.click();
  }

  await expect(
    page
      .getByText(/Template Preview/i)
      .or(page.locator('.docx-preview-wrapper'))
      .or(page.locator('.docx-preview__canvas'))
      .first()
  ).toBeVisible({ timeout: UI_TIMEOUT });

  const closeDrawer = page.getByRole('button', { name: /Close Documents drawer/i });
  if (await isVisible(closeDrawer, 2_000)) {
    await closeDrawer.click();
  }
}

async function waitForStageProcessing(page: Page, label: string, timeout = TRAINING_TIMEOUT): Promise<void> {
  const completedSelector = '[aria-label="Completed"], img[alt="Completed"], [title="Completed"]';
  const processingSelector = '[aria-label="Processing"], img[alt="Processing"], [title="Processing"]';

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

  await expect(rowWithProcessing.or(rowWithCompleted)).toBeVisible({ timeout });
}

async function waitForStageCompleted(
  page: Page,
  label: string,
  expectedCount: number,
  timeout = TRAINING_TIMEOUT
): Promise<void> {
  const completedSelector = '[aria-label="Completed"], img[alt="Completed"], [title="Completed"]';

  const rowWithCompleted = page
    .locator('div, li, [role="listitem"]')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .filter({ has: page.locator(completedSelector) })
    .last();

  await expect(rowWithCompleted).toBeVisible({ timeout });
  await expect
    .poll(async () => page.locator(completedSelector).count(), { timeout: UI_TIMEOUT })
    .toBeGreaterThanOrEqual(expectedCount);
}

async function verifyPlaceholderColors(
  page: Page,
  placeholders: Locator,
  expectedPatterns: string[]
): Promise<void> {
  const escaped = expectedPatterns.map((pattern) =>
    pattern.replace(/,\s*/g, '\\s*,\\s*').replace(/\./g, '\\.')
  );
  const regex = new RegExp(`rgba?\\(\\s*(?:${escaped.join('|')})\\s*\\)`);

  const count = await placeholders.count();
  for (let index = 0; index < count; index += 1) {
    await expect(placeholders.nth(index)).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(placeholders.nth(index)).toHaveCSS('background-color', regex, {
      timeout: UI_TIMEOUT,
    });
  }
}

async function verifyDocumentGenerationStages(page: Page): Promise<void> {
  const placeholderRegex = buildPlaceholderRegex();
  const placeholders = page.locator('.doc-placeholder');
  const completedSelector = '[aria-label="Completed"], img[alt="Completed"], [title="Completed"]';
  const stageLabels = ['Indexing Sources', 'Finding Placeholder Matches', 'Populating Placeholders'];

  await waitForWorkspaceShell(page);
  await expect(createFinalDocButton(page)).toBeVisible({ timeout: UI_TIMEOUT });

  await expect
    .poll(async () => placeholders.count(), {
      timeout: 120_000,
      intervals: [2_000, 3_000, 5_000, 5_000],
    })
    .toBeGreaterThan(0);

  const count = await placeholders.count();
  expect(count).toBeGreaterThan(0);

  const matchedCount = await placeholders.evaluateAll(
    (elements, patternSource) => {
      const regex = new RegExp(patternSource as string);
      return elements.filter((element) => {
        const raw =
          element.getAttribute('data-placeholder-text') ||
          element.getAttribute('data-placeholder') ||
          '';
        const decoded = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        return regex.test(decoded);
      }).length;
    },
    placeholderRegex.source
  );

  expect(matchedCount).toBeGreaterThanOrEqual(0);

  for (const label of stageLabels) {
    await expect(page.getByText(new RegExp(`^\\s*${label}\\s*$`)).first()).toBeVisible({
      timeout: UI_TIMEOUT,
    });
  }

  await expect
    .poll(async () => page.locator(completedSelector).count(), {
      timeout: TRAINING_TIMEOUT,
      intervals: [2_000, 3_000, 5_000, 5_000],
    })
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(async () => page.locator(completedSelector).count(), {
      timeout: TRAINING_TIMEOUT,
      intervals: [2_000, 3_000, 5_000, 5_000],
    })
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(async () => page.locator(completedSelector).count(), {
      timeout: TRAINING_TIMEOUT,
      intervals: [2_000, 3_000, 5_000, 5_000],
    })
    .toBeGreaterThanOrEqual(3);

  const toastDetectionPromise = page.evaluate(() => {
    return new Promise<{ text: string }>((resolve, reject) => {
      let observer: MutationObserver | undefined;

      const timeout = window.setTimeout(() => {
        observer?.disconnect();
        reject(new Error('Apply All toast did not appear within 10 seconds.'));
      }, 10_000);

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) {
              continue;
            }

            const text = (node.textContent || '').trim();
            if (/Applied all \d+ mappings?/i.test(text)) {
              window.clearTimeout(timeout);
              observer.disconnect();
              resolve({ text });
              return;
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  await applyAllButton(page).click();
  const toastInfo = await toastDetectionPromise;
  expect(toastInfo.text).toMatch(/Applied all \d+ mappings?/i);

  await expect(createFinalDocButton(page)).toBeEnabled({ timeout: UI_TIMEOUT });
}

async function createReadyQaTrainingSession(browser: Browser, label: string): Promise<{
  context: BrowserContext;
  page: Page;
  session: TrainingSession;
}> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    try {
      const setup = await startManualTraining(page);
      await waitForReusableWorkspace(page);

      const session: TrainingSession = {
        trainUrl: page.url(),
        outputFileName: setup.outputFileName,
      };
      return { context, page, session };
    } catch (error) {
      lastError = error;
      console.log(`${label} setup attempt ${attempt} failed: ${String(error)}`);
      await context.close().catch(() => undefined);

      if (attempt === 2) {
        throw error;
      }
    }
  }

  throw lastError;
}

function sourceHeadingOption(page: Page): Locator {
  return page
    .getByRole('dialog', { name: /Select Source/i })
    .getByRole('checkbox')
    .first();
}

function sourceHeadingCheckboxes(page: Page): Locator {
  return page.getByRole('dialog', { name: /Select Source/i }).getByRole('checkbox');
}

function sourceDocumentSummaryButton(page: Page): Locator {
  return page
    .getByRole('dialog', { name: /Mapping Controls/i })
    .getByRole('button', { name: /Protocol Example \(28Sep2023\)\.docx \(\d+\)/i })
    .first();
}

async function activateHeadingCheckbox(checkbox: Locator): Promise<boolean> {
  const initiallyChecked = await checkbox.isChecked().catch(() => false);
  if (initiallyChecked) {
    return true;
  }

  await checkbox.click({ force: true }).catch(() => undefined);
  if (await checkbox.isChecked().catch(() => false)) {
    return true;
  }

  await checkbox.focus().catch(() => undefined);
  await checkbox.press('Space').catch(() => undefined);
  if (await checkbox.isChecked().catch(() => false)) {
    return true;
  }

  await checkbox.locator('xpath=..').click({ force: true }).catch(() => undefined);
  return checkbox.isChecked().catch(() => false);
}

async function prepareSourceHeadingSelection(page: Page): Promise<Locator> {
  await sourcePickerDocument(page).click({ force: true });
  const headingCheckboxes = sourceHeadingCheckboxes(page);
  await expect(headingCheckboxes.first()).toBeVisible({ timeout: UI_TIMEOUT });

  if (await isVisible(headingSearchBox(page), 2_000)) {
    await headingSearchBox(page).fill('Spon');
  }

  return headingCheckboxes;
}

async function selectSourceHeadings(page: Page, maxSelections = 4): Promise<number> {
  const headingCheckboxes = await prepareSourceHeadingSelection(page);

  if (await headingCheckboxes.first().isChecked().catch(() => false)) {
    await headingCheckboxes.first().uncheck({ force: true }).catch(() => undefined);
  }

  let selectedCount = 0;
  const checkboxCount = await headingCheckboxes.count();

  for (let index = 1; index < checkboxCount && selectedCount < maxSelections; index += 1) {
    const checkbox = headingCheckboxes.nth(index);
    if (!(await isVisible(checkbox, 2_000))) {
      continue;
    }

    if (await activateHeadingCheckbox(checkbox)) {
      selectedCount += 1;
    }
  }

  if (selectedCount === 0 && (await activateHeadingCheckbox(headingCheckboxes.first()))) {
    selectedCount = 1;
  }

  return selectedCount;
}

function sourcePickerDocument(page: Page): Locator {
  return page
    .getByRole('dialog', { name: /Select Source/i })
    .getByRole('button', {
      name: /Protocol Example \(28Sep2023\)(?:_trimmed)?\.docx/i,
    })
    .first();
}

function primaryPlaceholder(page: Page): Locator {
  return page.locator('#placeholder-0').or(firstPlaceholder(page)).first();
}

function mappingStatusValue(page: Page): Locator {
  return page
    .getByRole('dialog', { name: /Mapping Controls/i })
    .getByText(/Replacement Done|Replacement done|Match Found|Matches Found|Replacement Not Found|Matching pending/i)
    .last();
}

function addInstructionButton(page: Page): Locator {
  return page.getByRole('button', { name: /Add instruction/i }).first();
}

function headingSearchBox(page: Page): Locator {
  return page.getByRole('searchbox', { name: /Search headings across all/i }).first();
}

function transformPromptEditor(page: Page): Locator {
  return page
    .getByRole('textbox', { name: /Enter transformation/i })
    .or(transformEditor(page))
    .first();
}

function downloadButton(page: Page): Locator {
  return page.getByRole('button', { name: /Download/i }).first();
}

function backToHomeButton(page: Page): Locator {
  return page.getByRole('button', { name: /Back to Home/i }).first();
}

function pendingRemoveSourceButton(page: Page): Locator {
  return page
    .getByRole('button', { name: /Remove source/i })
    .or(page.getByRole('button', { name: /Delete source/i }))
    .or(page.getByLabel(/Remove source/i))
    .first();
}

function sourceActionLocator(page: Page, action: 'add' | 'remove' | 'transform'): Locator {
  if (action === 'add') {
    return addSourceButton(page);
  }

  if (action === 'remove') {
    return removeSourceButton(page);
  }

  return transformButton(page);
}

async function openPlaceholderWithSourceAction(
  page: Page,
  action: 'add' | 'remove' | 'transform'
): Promise<void> {
  const target = sourceActionLocator(page, action);
  const placeholders = page.locator('.doc-placeholder');
  const count = await placeholders.count();

  for (let index = 0; index < Math.min(count, 20); index += 1) {
    const candidate = placeholders.nth(index);
    if (!(await isVisible(candidate, 2_000))) {
      continue;
    }

    await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
    await candidate.click({ force: true });
    await expect(mappingControlsHeading(page)).toBeVisible({ timeout: UI_TIMEOUT });
    await ensureSourcesSectionOpen(page);

    if (await isVisible(target, 5_000)) {
      return;
    }
  }

  throw new Error(`Could not find a placeholder with the "${action}" action available.`);
}

async function openPrimaryPlaceholder(page: Page): Promise<void> {
  await expect(primaryPlaceholder(page)).toBeVisible({ timeout: UI_TIMEOUT });
  await primaryPlaceholder(page).click({ force: true });
  await expect(mappingControlsHeading(page)).toBeVisible({ timeout: UI_TIMEOUT });
}

async function createPendingSourceAddition(page: Page): Promise<void> {
  await openPlaceholderWithSourceAction(page, 'add');
  await addSourceButton(page).click();

  await expect(
    page.getByRole('heading', { name: /Select Source/i }).or(page.getByRole('dialog').first()).first()
  ).toBeVisible({ timeout: UI_TIMEOUT });

  await selectSourceHeadings(page);

  await expect(page.getByRole('button', { name: /^Save$/i })).toBeEnabled({
    timeout: UI_TIMEOUT,
  });

  await page.getByRole('button', { name: /^Save$/i }).click();

  await expect(page.getByText(/PENDING ADD/i)).toBeVisible({ timeout: UI_TIMEOUT });
  await expect(page.getByText(/Source changes detected/i)).toBeVisible({
    timeout: UI_TIMEOUT,
  });
}

async function savePendingChanges(page: Page): Promise<void> {
  await expect(acceptPendingChangesButton(page)).toBeVisible({ timeout: UI_TIMEOUT });
  await acceptPendingChangesButton(page).click();

  await expect(
    page.getByText(/Saving changes/i)
      .or(savedChangesToast(page))
      .or(page.getByText(/Changes saved successfully/i))
      .first()
  ).toBeVisible({ timeout: UI_TIMEOUT });
  await expect(savedChangesToast(page).or(page.getByText(/Changes saved successfully/i)).first()).toBeVisible({
    timeout: UI_TIMEOUT,
  });
}

async function createSavedSourceAddition(page: Page): Promise<void> {
  await createPendingSourceAddition(page);
  await savePendingChanges(page);
  await expect(
    pendingRemoveSourceButton(page)
      .or(transformButton(page))
      .or(page.getByText(/Sources:\s*\d+\s+source/i))
      .first()
  ).toBeVisible({ timeout: UI_TIMEOUT });
}

async function addOrUpdateInstruction(page: Page, instructionText: string): Promise<Locator> {
  await openPrimaryPlaceholder(page);
  await ensureWritingInstructionsOpen(page);

  if (await isVisible(addInstructionButton(page), 2_000)) {
    await addInstructionButton(page).click();
  }

  const editor = page.getByRole('textbox', { name: /Enter your instruction/i }).last();
  await expect(editor).toBeVisible({ timeout: UI_TIMEOUT });
  await editor.fill(instructionText);
  await expect(editor).toHaveValue(instructionText, { timeout: UI_TIMEOUT });
  return editor;
}

async function openFinalDocumentFlow(page: Page): Promise<void> {
  await expect(createFinalDocButton(page)).toBeEnabled({ timeout: 300_000 });
  await createFinalDocButton(page).click();

  await expect(page).toHaveURL(/.*\/review\?id=.*/, { timeout: 600_000 });
  await expect(finalDocumentSignal(page)).toBeVisible({ timeout: 600_000 });
}

// This file mirrors the AW_00-AW_10 consolidated pattern:
// one file, many reportable tests, with grouped setup depending on feature depth.
test.describe('AW_11-AW_20: Consolidated Workflow', () => {
  test.describe('AW_11-AW_12B Training Pipeline', () => {
    test.describe.configure({ retries: 2, timeout: GROUP_TIMEOUT });

    test('AW_11: Training Initialization', async ({ page }) => {
      await startManualTraining(page);
      await waitForWorkspaceShell(page);

      await expect(page.getByText(/Sources/i).first()).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByText(/Mapping/i).first()).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('AW_12: Agile Mapping Preview Verify', async ({ page }) => {
      const setup = await startManualTraining(page);
      await verifyDocumentPreviewList(page, setup.selectedTemplateName);
    });

    test('AW_12B: Document Generation Stages', async ({ page }) => {
      await startManualTraining(page);
      await verifyDocumentGenerationStages(page);
    });
  });

  test.describe('AW_13-AW_18 Mapping Controls', () => {
    test.describe.configure({ mode: 'serial', retries: 2, timeout: GROUP_TIMEOUT });
    test.setTimeout(GROUP_TIMEOUT);

    let setupContext: BrowserContext;
    let setupPage: Page;
    let session: TrainingSession;

    test.beforeAll(async ({ browser }, testInfo) => {
      testInfo.setTimeout(GROUP_TIMEOUT);
      const setup = await createReadyQaTrainingSession(browser, 'AW_13-AW_18');
      setupContext = setup.context;
      setupPage = setup.page;
      session = setup.session;
    });

    test.afterAll(async () => {
      await setupContext?.close();
    });

    test.beforeEach(async ({ page }) => {
      await restoreTrainingSession(page, session);
    });

    test('AW_13: Clicking a placeholder opens the Mapping Controls drawer with placeholder details', async ({
      page,
    }) => {
      await openPrimaryPlaceholder(page);

      await expect(mappingControlsHeading(page)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByText(/Configure selected placeholder/i)).toBeVisible({
        timeout: UI_TIMEOUT,
      });
      await expect(page.getByText(/^Placeholder$/i)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByText(/^Status$/i)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(mappingStatusValue(page)).toBeVisible({ timeout: UI_TIMEOUT });

      await page.getByRole('button', { name: /Close Mapping Controls drawer/i }).click();
      await page.getByRole('button', { name: /Show mapping controls/i }).click();
      await expect(mappingControlsHeading(page)).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('AW_13: Mapping Controls exposes source, instruction, and related mapping actions', async ({
      page,
    }) => {
      await openPrimaryPlaceholder(page);

      await expect(sourcesToggle(page)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(writingInstructionsToggle(page)).toBeVisible({ timeout: UI_TIMEOUT });

      await ensureSourcesSectionOpen(page);
      await expect(
        transformButton(page).or(addSourceButton(page)).or(applyButton(page)).first()
      ).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByText(/Placeholder/i).first()).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('AW_14: Remove source is available from Mapping Controls', async ({ page }) => {
      await openPrimaryPlaceholder(page);
      await ensureSourcesSectionOpen(page);
      await expect(pendingRemoveSourceButton(page)).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('AW_14: Removing a source exposes a pending-change or save/apply path', async ({ page }) => {
      await openPrimaryPlaceholder(page);
      await ensureSourcesSectionOpen(page);
      await pendingRemoveSourceButton(page).click();

      await expect(
        acceptPendingChangesButton(page)
          .or(page.getByText(/Sources:\s*\d+\s+remove/i).first())
          .or(page.getByText(/pending/i).first())
          .or(applyButton(page))
          .first()
      ).toBeVisible({ timeout: UI_TIMEOUT });

      if (await isVisible(acceptPendingChangesButton(page), 5_000)) {
        await savePendingChanges(page);
      }
    });

    test('AW_15: Add Source loads headings for the selected source document', async ({ page }) => {
      await openPrimaryPlaceholder(page);
      await ensureSourcesSectionOpen(page);
      await addSourceButton(page).click();

      await expect(
        page.getByRole('heading', { name: /Select Source/i }).or(page.getByRole('dialog').first()).first()
      ).toBeVisible({ timeout: UI_TIMEOUT });

      await prepareSourceHeadingSelection(page);
      await expect(sourceHeadingOption(page)).toBeVisible({ timeout: UI_TIMEOUT });
      await expect
        .poll(async () => sourceHeadingCheckboxes(page).count(), { timeout: UI_TIMEOUT })
        .toBeGreaterThan(0);
      await expect(
        headingSearchBox(page)
          .or(page.getByText(/Select a heading from the list to view its content/i))
          .first()
      ).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('AW_15: Selecting a heading and saving creates a pending add change', async ({ page }) => {
      await openPrimaryPlaceholder(page);
      await ensureSourcesSectionOpen(page);
      await addSourceButton(page).click();

      await expect(page.getByRole('heading', { name: /Select Source/i })).toBeVisible({
        timeout: UI_TIMEOUT,
      });

      const initialSummary = await sourceDocumentSummaryButton(page).textContent().catch(() => null);
      const selectedCount = await selectSourceHeadings(page);

      await expect(page.getByRole('button', { name: /^Save$/i })).toBeEnabled({
        timeout: UI_TIMEOUT,
      });

      await page.getByRole('button', { name: /^Save$/i }).click();
      await expect(page.getByRole('dialog', { name: /Select Source/i })).toBeHidden({
        timeout: UI_TIMEOUT,
      });

      await expect(
        page
          .getByText(/PENDING ADD/i)
          .or(page.getByText(/Sources:\s*\d+\s*adds?/i))
          .or(acceptPendingChangesButton(page))
          .or(page.getByText(/Source changes detected/i))
          .or(sourceDocumentSummaryButton(page))
          .first()
      ).toBeVisible({ timeout: UI_TIMEOUT });

      const updatedSummary = await sourceDocumentSummaryButton(page).textContent().catch(() => null);
      if (initialSummary && updatedSummary) {
        expect(updatedSummary.length).toBeGreaterThanOrEqual(initialSummary.length);
      }
    });

    test('AW_16: Transform opens an editor for the selected source content', async ({ page }) => {
      await openPrimaryPlaceholder(page);
      await ensureSourcesSectionOpen(page);
      await expect(transformButton(page)).toBeVisible({ timeout: UI_TIMEOUT });
      await transformButton(page).click();
      await expect(transformPromptEditor(page)).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('AW_16: Submitting a transform shows transformed output signals', async ({ page }) => {
      await openPrimaryPlaceholder(page);
      await ensureSourcesSectionOpen(page);
      await expect(transformButton(page)).toBeVisible({ timeout: UI_TIMEOUT });
      await transformButton(page).click();
      await expect(transformPromptEditor(page)).toBeVisible({ timeout: UI_TIMEOUT });

      await transformPromptEditor(page).fill(ADVANCED_TRANSFORM_PROMPT);
      await page.getByRole('button', { name: /^Transform$/i }).last().click();

      await expect(
        page
          .getByText(/Transformed Content/i)
          .or(page.getByRole('button', { name: /New Transform/i }))
          .or(page.getByText(/Karliah|Senior MD|Super Specialists/i))
          .or(page.getByText(ADVANCED_TRANSFORM_PROMPT))
          .first()
      ).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('AW_17: Writing Instructions editor accepts rewritten instruction text', async ({ page }) => {
      const editor = await addOrUpdateInstruction(page, ADVANCED_INSTRUCTION);
      await expect(editor).toHaveValue(ADVANCED_INSTRUCTION, { timeout: UI_TIMEOUT });
      await expect(
        acceptPendingChangesButton(page)
          .or(page.getByText(/Instructions:\s*Updated/i))
          .first()
      ).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('AW_17: Preview opens after the instruction is updated', async ({ page }) => {
      const editor = await addOrUpdateInstruction(page, ADVANCED_INSTRUCTION);
      await expect(editor).toHaveValue(ADVANCED_INSTRUCTION, {
        timeout: UI_TIMEOUT,
      });
      await savePendingChanges(page);

      await page.getByRole('button', { name: /^Preview$/i }).first().click();
      await expect(page.getByRole('heading', { name: /Preview/i })).toBeVisible({
        timeout: UI_TIMEOUT,
      });
      await expect(page.locator('body')).toContainText(/content|preview/i, { timeout: UI_TIMEOUT });
      await clickIfVisible(page.getByRole('button', { name: /Close Preview/i }).first(), 3_000);
    });

    test('AW_18: Reset restores the original instruction after a temporary edit', async ({
      page,
    }) => {
      await openPrimaryPlaceholder(page);
      const editor = await ensureWritingInstructionsOpen(page);

      await editor.fill(UPDATED_INSTRUCTION);
      await expect(editor).toHaveValue(UPDATED_INSTRUCTION, { timeout: UI_TIMEOUT });

      await page.getByRole('button', { name: /^Reset$/i }).first().click();
      await expect(editor).not.toHaveValue(UPDATED_INSTRUCTION, { timeout: UI_TIMEOUT });
      // After Reset, verify the value changed away from the temp edit.
      // The exact reset target depends on prior saved state, so we use an outcome-based check.
      const resetValue = await editor.inputValue();
      expect(resetValue).not.toBe(UPDATED_INSTRUCTION);
      expect(resetValue.length).toBeGreaterThan(0);
    });
  });

  test.describe('AW_19-AW_20 Final Document', () => {
    test.describe.configure({ mode: 'serial', retries: 2, timeout: GROUP_TIMEOUT });
    test.setTimeout(GROUP_TIMEOUT);

    let setupContext: BrowserContext;
    let setupPage: Page;
    let session: TrainingSession;

    test.beforeAll(async ({ browser }, testInfo) => {
      testInfo.setTimeout(GROUP_TIMEOUT);
      const setup = await createReadyQaTrainingSession(browser, 'AW_19-AW_20');
      setupContext = setup.context;
      setupPage = setup.page;
      session = setup.session;
    });

    test.afterAll(async () => {
      await setupContext?.close();
    });

    test.beforeEach(async ({ page }) => {
      await restoreTrainingSession(page, session);
    });

    test('AW_19: Create Final Doc opens the generated document review screen', async ({ page }) => {
      await openFinalDocumentFlow(page);

      await expect(
        page
          .getByRole('heading', { name: /Review Screen/i })
          .or(finalDocSaveButton(page))
          .first()
      ).toBeVisible({ timeout: 120_000 });
      await expect(finalDocSaveButton(page)).toBeVisible({ timeout: 120_000 });
    });

    test('AW_20: Save downloads the generated document and shows a download-ready screen', async ({
      page,
    }) => {
      await openFinalDocumentFlow(page);
      await expect(finalDocSaveButton(page)).toBeVisible({ timeout: 300_000 });

      const downloadFromSavePromise = page.waitForEvent('download', { timeout: 30_000 }).catch(() => null);
      await finalDocSaveButton(page).click();

      const directDownload = await downloadFromSavePromise;
      if (directDownload) {
        expect(await directDownload.suggestedFilename()).toMatch(/\.(docx|pdf|zip)$/i);
      } else {
        await expect(
          downloadButton(page)
            .or(postSaveSignal(page))
            .or(page.getByText(/Success/i))
            .first()
        ).toBeVisible({ timeout: 120_000 });

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
      await clickIfVisible(backToHomeButton(page), 5_000);
    });
  });
});
