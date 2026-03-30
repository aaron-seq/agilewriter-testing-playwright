import { test, expect, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  addSourceButton,
  applyButton,
  createTrainingSession,
  ensureSourcesSectionOpen,
  openFirstPlaceholder,
  restoreTrainingSession,
  sourcesToggle,
  transformButton,
  writingInstructionsToggle,
} from './helpers/training-setup';

// Legacy file name retained. Workbook AW_14 covers Mapping Controls.
test.describe('AW_14: Mapping Controls', () => {
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

  test('AW_14: Clicking a placeholder opens the Mapping Controls drawer', async ({ page }) => {
    await openFirstPlaceholder(page);

    await expect(sourcesToggle(page)).toBeVisible({ timeout: 30_000 });
    await expect(writingInstructionsToggle(page)).toBeVisible({ timeout: 30_000 });
  });

  test('AW_14: Mapping Controls exposes the related source and apply actions', async ({ page }) => {
    await openFirstPlaceholder(page);
    await ensureSourcesSectionOpen(page);

    await expect(
      transformButton(page).or(addSourceButton(page)).or(applyButton(page)).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
