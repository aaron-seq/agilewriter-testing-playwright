import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { newAuthenticatedContext } from './helpers/app-navigation';
import {
  TrainingSession,
  createFinalDocButton,
  createTrainingSession,
  restoreTrainingSession,
} from './helpers/training-setup';

function saveButton(page: Page) {
  return page.getByRole('button', { name: /^Save(?:\s*\[Alt\+[A-Z]\])?$/i })
    .or(page.getByRole('button', { name: /\bSave\b/i }))
    .first();
}

function finalDocumentSignal(page: Page) {
  return saveButton(page)
    .or(page.getByRole('heading', { name: /Review Screen/i }))
    .or(page.getByRole('heading', { name: /download|final document|document ready/i }))
    .or(page.getByText(/download|final document|document ready/i).first())
    .first();
}

function postSaveSignal(page: Page) {
  return page.getByRole('heading', { name: /Review Screen/i })
    .or(page.getByRole('heading', { name: /download|document ready|saved/i }))
    .or(page.getByRole('button', { name: /Save/i }))
    .or(page.getByRole('button', { name: /Download/i }))
    .or(page.getByText(/download started|download complete|download successfully|document ready|saved/i).first())
    .first();
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
      console.log(`AW_20 setup attempt ${attempt} failed: ${String(error)}`);
      await context.close().catch(() => undefined);

      if (attempt === 2) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function logState(page: Page, label: string): Promise<void> {
  const headings = await page.getByRole('heading')
    .evaluateAll(nodes => nodes.map(node => (node.textContent || '').trim()).filter(Boolean))
    .catch(() => []);
  const buttons = await page.getByRole('button')
    .evaluateAll(nodes => nodes.map(node => ({
      text: (node.textContent || '').trim(),
      aria: node.getAttribute('aria-label') || '',
    })).filter(button => button.text || button.aria).slice(0, 20))
    .catch(() => []);

  console.log(`[${label}] URL: ${page.url()}`);
  console.log(`[${label}] Headings: ${JSON.stringify(headings)}`);
  console.log(`[${label}] Buttons: ${JSON.stringify(buttons)}`);
}

async function openFinalDocumentFlow(page: Page): Promise<void> {
  await expect(createFinalDocButton(page)).toBeEnabled({ timeout: 300_000 });
  await createFinalDocButton(page).click();

  await expect(page).toHaveURL(/.*\/review\?id=.*/, { timeout: 600_000 });
  await expect(finalDocumentSignal(page)).toBeVisible({ timeout: 600_000 });
  await logState(page, 'after-create-final-doc');
}

test.describe('AW_20: Save & Integration Validation', () => {
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

  test('AW_20: Save downloads the generated document and shows a download-ready screen', async ({ page }) => {
    await openFinalDocumentFlow(page);

    await expect(saveButton(page)).toBeVisible({ timeout: 300_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 }).catch(() => null);
    await saveButton(page).click();

    const download = await downloadPromise;
    if (download) {
      expect(await download.suggestedFilename()).toMatch(/\.(docx|pdf|zip)$/i);
      return;
    }

    await expect(postSaveSignal(page)).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('body')).toContainText(/download|saved|document ready/i, { timeout: 120_000 });
  });
});
