import { test, expect, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  applyAllButton,
  createFinalDocButton,
  createTrainingSession,
  restoreTrainingSession,
} from './helpers/training-setup';

// Legacy file name retained. Workbook AW_15 covers document generation stages.
test.describe('AW_15: Document Generation Stages', () => {
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

  test('AW_15: Generation stages are visible and final workspace actions load successfully', async ({ page }) => {
    await expect(page.getByText(/Indexing Sources/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Finding Placeholder Matches/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Populating Placeholders/i)).toBeVisible({ timeout: 60_000 });

    await expect(
      applyAllButton(page).or(createFinalDocButton(page)).first()
    ).toBeVisible({ timeout: 120_000 });
    await expect(
      page.getByRole('button', { name: /Show mapping controls/i })
        .or(page.getByRole('button', { name: /Show document list/i }))
        .first()
    ).toBeVisible({ timeout: 60_000 });
  });
});
