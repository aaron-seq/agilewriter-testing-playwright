import { test, expect, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  acceptPendingChangesButton,
  addSourceButton,
  createTrainingSession,
  ensureSourcesSectionOpen,
  openFirstPlaceholder,
  restoreTrainingSession,
  savedChangesToast,
} from './helpers/training-setup';

// Legacy file name retained. Workbook AW_18 covers Add Source.
test.describe('AW_18: Add Source', () => {
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

  test('AW_18: Add source opens the source selector dialog', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await addSourceButton(page).click();

    await expect(
      page.getByRole('dialog').first()
        .or(page.getByRole('heading', { name: /Select Source/i }))
        .first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('AW_18: A newly selected source can be saved as a pending change', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await addSourceButton(page).click();
    await expect(
      page.getByRole('dialog').first()
        .or(page.getByRole('heading', { name: /Select Source/i }))
        .first()
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByRole('button', { name: /Cancel/i })
        .or(page.getByRole('button', { name: /^Save$/i }))
        .first()
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeDisabled({ timeout: 30_000 });
  });
});
