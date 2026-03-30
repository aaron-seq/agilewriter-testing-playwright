import { Locator, Page, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { openAgileMapping, openDashboard } from './app-navigation';

dotenv.config();

const TRAINING_TIMEOUT = 2_100_000;
const UI_TIMEOUT = 60_000;

export interface TrainingSession {
  trainUrl: string;
  outputFileName: string;
}

async function isVisible(locator: Locator, timeout = 2_000): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function waitForPickerSearch(page: Page): Promise<void> {
  await expect(
    page.getByRole('textbox', { name: /Search files/i })
  ).toBeVisible({ timeout: UI_TIMEOUT });
}

async function ensureWorkspaceHealthy(page: Page, step: string): Promise<void> {
  const timeoutHeading = page.getByRole('heading', { name: /This site can.t be reached/i });

  if (await isVisible(timeoutHeading)) {
    throw new Error(`App is unavailable while ${step}: Chromium reached a network timeout page at ${page.url()}.`);
  }

  if (page.url().includes('/signin')) {
    throw new Error(`Cached auth was lost while ${step}. Current URL: ${page.url()}.`);
  }
}

export function firstPlaceholder(page: Page): Locator {
  return page.getByRole('button', { name: /Sponsor.*Name/i }).first();
}

export function applyAllButton(page: Page): Locator {
  return page.getByRole('button', { name: /Apply All/i });
}

export function createFinalDocButton(page: Page): Locator {
  return page.getByRole('button', { name: /Create\s*Final\s*Doc/i });
}

export function mappingControlsHeading(page: Page): Locator {
  return page.getByRole('heading', { name: /Mapping Controls/i });
}

export function sourcesToggle(page: Page): Locator {
  return page.getByRole('button', { name: /Sources/i });
}

export function writingInstructionsToggle(page: Page): Locator {
  return page.getByRole('button', { name: /Writing Instructions/i });
}

export function addSourceButton(page: Page): Locator {
  return page.getByRole('button', { name: /Add source/i });
}

export function removeSourceButton(page: Page): Locator {
  return page.getByRole('button', { name: /Remove source/i }).first();
}

export function transformButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Transform$/i }).first();
}

export function applyButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Apply$/i }).first();
}

export function acceptPendingChangesButton(page: Page): Locator {
  return page.getByRole('button', { name: /Accept pending changes/i });
}

export function instructionEditor(page: Page): Locator {
  return page.locator('textarea, [contenteditable="true"], input[type="text"]').last();
}

export function transformEditor(page: Page): Locator {
  return page.locator('textarea, [contenteditable="true"], input[type="text"]').last();
}

export function appliedMappingsToast(page: Page): Locator {
  return page.getByText(/Applied all(?:\s+\d+)?\s+mappings?\.?/i).first();
}

export function savedChangesToast(page: Page): Locator {
  return page.getByText(/Changes saved successfully|saved successfully/i).first();
}

export async function dismissNotificationIfVisible(page: Page): Promise<void> {
  const dismissButton = page.getByRole('button', { name: /Dismiss notification/i });
  if (await isVisible(dismissButton, 3_000)) {
    await dismissButton.click();
  }
}

export async function waitForWorkspaceReady(
  page: Page,
  options: { requireApplyAll?: boolean } = {}
): Promise<void> {
  await ensureWorkspaceHealthy(page, 'waiting for the training workspace');
  await expect(page).toHaveURL(/.*\/train\?id=.*/, { timeout: UI_TIMEOUT });

  const workspaceSignal = createFinalDocButton(page)
    .or(applyAllButton(page))
    .or(firstPlaceholder(page))
    .or(page.getByRole('button', { name: /Show mapping controls/i }))
    .or(page.getByRole('button', { name: /Show document list/i }));

  await expect(workspaceSignal.first()).toBeVisible({ timeout: TRAINING_TIMEOUT });

  await expect(
    page.getByRole('button', { name: /Show mapping controls/i })
      .or(page.getByRole('button', { name: /Show document list/i }))
      .first()
  ).toBeVisible({ timeout: UI_TIMEOUT });

  if (options.requireApplyAll) {
    await expect(createFinalDocButton(page)).toBeEnabled({ timeout: TRAINING_TIMEOUT });
    await expect(applyAllButton(page)).toBeVisible({ timeout: UI_TIMEOUT });
  }

  await expect(firstPlaceholder(page)).toBeVisible({ timeout: UI_TIMEOUT });
}

async function selectDestinationTemplate(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select destination template/i }).click();
  await waitForPickerSearch(page);
  await page.getByRole('textbox', { name: /Search files/i }).fill('CSR_Table_Trimmed.docx');
  await page.getByRole('button', { name: /Expand CSR/i }).click();
  await page.getByRole('checkbox', { name: /Select CSR_Table_Trimmed\.docx/i }).check();
  await page.getByRole('button', { name: /Select \[ENTER\]/i }).click();
}

async function selectSourceDocuments(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select source documents/i }).click();
  await waitForPickerSearch(page);
  await page
    .getByRole('textbox', { name: /Search files/i })
    .fill('Protocol Example (28Sep2023)_trimmed.docx');
  await page.getByRole('button', { name: /Expand Protocol/i }).click();
  await page.getByRole('checkbox', { name: /Select Protocol Example/i }).check();
  await page.getByRole('button', { name: /Done \[ENTER\]/i }).click();
}

export async function createTrainingSession(page: Page): Promise<TrainingSession> {
  await openAgileMapping(page);

  const outputFileName = `AW_test_${Date.now()}`;
  await page.getByRole('textbox', { name: /Enter desired output filename/i }).fill(outputFileName);

  await selectDestinationTemplate(page);
  await selectSourceDocuments(page);

  await page.getByRole('button', { name: /Start Training/i }).click();
  await waitForWorkspaceReady(page, { requireApplyAll: true });

  return {
    trainUrl: page.url(),
    outputFileName,
  };
}

export async function restoreTrainingSession(page: Page, session: TrainingSession): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto(session.trainUrl, { waitUntil: 'domcontentloaded' });

    if (page.url().includes('/signin')) {
      await openDashboard(page);
      continue;
    }

    try {
      await waitForWorkspaceReady(page, { requireApplyAll: true });
      return;
    } catch (error) {
      if (attempt === 2 || !page.url().includes('/signin')) {
        throw error;
      }

      await openDashboard(page);
    }
  }
}

export async function openFirstPlaceholder(page: Page): Promise<Locator> {
  const placeholder = firstPlaceholder(page);
  await expect(placeholder).toBeVisible({ timeout: UI_TIMEOUT });
  await placeholder.click();
  await expect(mappingControlsHeading(page)).toBeVisible({ timeout: UI_TIMEOUT });
  return placeholder;
}

export async function ensureSourcesSectionOpen(page: Page): Promise<void> {
  if (
    !(await isVisible(transformButton(page), 2_000)) &&
    !(await isVisible(addSourceButton(page), 2_000)) &&
    !(await isVisible(removeSourceButton(page), 2_000))
  ) {
    await sourcesToggle(page).click();
  }

  await expect(
    transformButton(page).or(addSourceButton(page)).or(removeSourceButton(page)).first()
  ).toBeVisible({ timeout: UI_TIMEOUT });
}

export async function ensureWritingInstructionsOpen(page: Page): Promise<Locator> {
  const editor = instructionEditor(page);

  if (!(await isVisible(editor, 2_000))) {
    await writingInstructionsToggle(page).click();
  }

  await expect(editor).toBeVisible({ timeout: UI_TIMEOUT });
  return editor;
}
