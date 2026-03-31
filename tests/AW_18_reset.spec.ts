import { test, expect, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  createTrainingSession,
  ensureWritingInstructionsOpen,
  openFirstPlaceholder,
  restoreTrainingSession,
} from './helpers/training-setup';

const UPDATED_INSTRUCTION = 'Use the sponsor legal name exactly as written in the source.';

test.describe('AW_18: Reset', () => {
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

  test('AW_18: Reset restores the original instruction after a temporary edit', async ({ page }) => {
    await openFirstPlaceholder(page);
    const editor = await ensureWritingInstructionsOpen(page);

    await editor.fill(UPDATED_INSTRUCTION);
    await expect(editor).toHaveValue(UPDATED_INSTRUCTION, { timeout: 30_000 });

    await page.getByRole('button', { name: /^Reset$/i }).first().click();

    await expect(editor).not.toHaveValue(UPDATED_INSTRUCTION, { timeout: 30_000 });
    await expect(editor).toHaveValue(/Replace the .* sponsor(?:'s)? name/i, { timeout: 30_000 });
  });
});
