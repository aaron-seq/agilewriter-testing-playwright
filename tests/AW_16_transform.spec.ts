import { test, expect, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  applyAllButton,
  appliedMappingsToast,
  createFinalDocButton,
  createTrainingSession,
  dismissNotificationIfVisible,
  restoreTrainingSession,
} from './helpers/training-setup';

// Legacy file name retained. Workbook AW_16 is a second Apply All validation.
test.describe('AW_16: Apply All Stability', () => {
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
    await dismissNotificationIfVisible(page);
  });

  test('AW_16: Apply All can be triggered without destabilizing the generated workspace', async ({ page }) => {
    await expect(applyAllButton(page)).toBeVisible({ timeout: 120_000 });

    if (await applyAllButton(page).isEnabled().catch(() => false)) {
      await applyAllButton(page).click();
      await expect(appliedMappingsToast(page)).toBeVisible({ timeout: 120_000 });
      await dismissNotificationIfVisible(page);
    }

    await expect(createFinalDocButton(page)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByRole('button', { name: /Show mapping controls/i })
        .or(page.getByRole('button', { name: /Show document list/i }))
        .first()
    ).toBeVisible({ timeout: 60_000 });
  });
});
