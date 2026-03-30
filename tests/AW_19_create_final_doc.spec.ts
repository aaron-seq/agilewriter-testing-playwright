import { test, expect, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  createTrainingSession,
  ensureSourcesSectionOpen,
  openFirstPlaceholder,
  restoreTrainingSession,
  transformButton,
  transformEditor,
} from './helpers/training-setup';

// Legacy file name retained. Workbook AW_19 covers Transform.
test.describe('AW_19: Transform', () => {
  test.describe.configure({ mode: 'serial', retries: 2, timeout: 2_100_000 });
  test.setTimeout(2_100_000);

  let setupContext: BrowserContext;
  let setupPage: Page;
  let session: TrainingSession;

  test.beforeAll(async ({ browser }) => {
    setupContext = await newAuthenticatedContext(browser);
    setupPage = await setupContext.newPage();
    session = await createTrainingSession(setupPage);
  });

  test.afterAll(async () => {
    await setupContext?.close();
  });

  test.beforeEach(async ({ page }) => {
    await restoreTrainingSession(page, session);
  });

  test('AW_19: Transform opens an editor for the selected source content', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await transformButton(page).click();
    await expect(transformEditor(page)).toBeVisible({ timeout: 30_000 });
  });

  test('AW_19: Submitting a transform shows transformed output signals', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await transformButton(page).click();
    await expect(transformEditor(page)).toBeVisible({ timeout: 30_000 });

    await transformEditor(page).fill('Add in cooperation');
    await page.getByRole('button', { name: /^Transform$/i }).last().click();

    await expect(
      page.getByText(/Transformed Content/i)
        .or(page.getByRole('button', { name: /New Transform/i }))
        .or(page.getByText(/Add in cooperation/i))
        .first()
    ).toBeVisible({ timeout: 60_000 });
  });
});
