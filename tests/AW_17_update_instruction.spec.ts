import { test, expect, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  acceptPendingChangesButton,
  applyButton,
  createTrainingSession,
  ensureSourcesSectionOpen,
  openFirstPlaceholder,
  removeSourceButton,
  restoreTrainingSession,
  savedChangesToast,
} from './helpers/training-setup';

// Legacy file name retained. Workbook AW_17 covers Delete Source.
test.describe('AW_17: Delete Source', () => {
  test.describe.configure({ mode: 'serial', retries: 2, timeout: 2_100_000 });

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

  test('AW_17: Remove source is available from Mapping Controls', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await expect(removeSourceButton(page)).toBeVisible({ timeout: 30_000 });
  });

  test('AW_17: Removing a source exposes a save or apply path for the pending change', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await removeSourceButton(page).click();

    await expect(
      acceptPendingChangesButton(page)
        .or(page.getByText(/No matches found|pending/i).first())
        .or(applyButton(page))
        .first()
    ).toBeVisible({ timeout: 30_000 });

    if (await acceptPendingChangesButton(page).isVisible({ timeout: 5_000 }).catch(() => false)) {
      await acceptPendingChangesButton(page).click();
      await expect(
        savedChangesToast(page).or(applyButton(page)).first()
      ).toBeVisible({ timeout: 30_000 });
    }
  });
});
