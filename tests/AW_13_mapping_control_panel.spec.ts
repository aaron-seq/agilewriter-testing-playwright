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

test.describe('AW_13: Apply All', () => {
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
    await dismissNotificationIfVisible(page);
  });

  test('AW_13: Apply All shows a success notification and keeps final document actions available', async ({ page }) => {
    await expect(applyAllButton(page)).toBeVisible({ timeout: 120_000 });
    await expect(applyAllButton(page)).toBeEnabled({ timeout: 120_000 });

    await applyAllButton(page).click();

    await expect(appliedMappingsToast(page)).toBeVisible({ timeout: 120_000 });
    await expect(createFinalDocButton(page)).toBeVisible({ timeout: 60_000 });
  });
});
