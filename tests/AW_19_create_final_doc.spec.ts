import { test, expect, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  createFinalDocButton,
  createTrainingSession,
  restoreTrainingSession,
} from './helpers/training-setup';

test.describe('AW_19: Final Document Creation', () => {
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

  test('AW_19: Create Final Doc opens the generated document review screen', async ({ page }) => {
    await expect(createFinalDocButton(page)).toBeEnabled({ timeout: 300_000 });
    await createFinalDocButton(page).click();

    await expect(page).toHaveURL(/.*\/review\?id=.*/, { timeout: 600_000 });
    await expect(page.getByRole('heading', { name: /Review Screen/i })).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible({ timeout: 120_000 });
  });
});
