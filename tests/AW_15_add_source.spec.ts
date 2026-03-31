import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  addSourceButton,
  createTrainingSession,
  ensureSourcesSectionOpen,
  openFirstPlaceholder,
  restoreTrainingSession,
} from './helpers/training-setup';

function selectSourceHeading(page: Page) {
  return page.getByText(/Protocol Title:|Protocol Number:|Study Phase:|Sponsor Name:/i).last();
}

function sourcePickerDocument(page: Page) {
  return page.getByRole('button', { name: /Protocol Example \(28Sep2023\)_trimmed\.docx/i }).last();
}

async function createTrainingSessionWithRetry(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
  session: TrainingSession;
}> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    try {
      const session = await createTrainingSession(page);
      return { context, page, session };
    } catch (error) {
      lastError = error;
      console.log(`AW_15 setup attempt ${attempt} failed: ${String(error)}`);
      await context.close().catch(() => undefined);

      if (attempt === 2) {
        throw error;
      }
    }
  }

  throw lastError;
}

// Workbook AW_15 covers Add Source. This spec exercises the full flow so it
// does not report a false green from only opening the dialog.
test.describe('AW_15: Add Source', () => {
  test.describe.configure({ mode: 'serial', retries: 2, timeout: 2_100_000 });
  test.setTimeout(2_100_000);

  let setupContext: BrowserContext;
  let setupPage: Page;
  let session: TrainingSession;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(4_200_000);

    const setup = await createTrainingSessionWithRetry(browser);
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

  test('AW_15: Add Source loads headings for the selected source document', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await addSourceButton(page).click();

    await expect(
      page.getByRole('heading', { name: /Select Source/i })
        .or(page.getByRole('dialog').first())
        .first()
    ).toBeVisible({ timeout: 30_000 });

    await sourcePickerDocument(page).click();

    await expect(selectSourceHeading(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Select a heading from the list to view its content/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('AW_15: Selecting a heading and saving creates a pending add change', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await addSourceButton(page).click();
    await expect(page.getByRole('heading', { name: /Select Source/i })).toBeVisible({ timeout: 30_000 });

    await sourcePickerDocument(page).click();
    await expect(selectSourceHeading(page)).toBeVisible({ timeout: 30_000 });

    await selectSourceHeading(page).click();
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeEnabled({ timeout: 30_000 });

    await page.getByRole('button', { name: /^Save$/i }).click();

    await expect(page.getByText(/PENDING ADD/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Sources:\s*1\s*add/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Source changes detected/i)).toBeVisible({ timeout: 60_000 });
  });
});
