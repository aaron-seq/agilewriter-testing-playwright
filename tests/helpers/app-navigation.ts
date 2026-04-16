import { Browser, BrowserContext, Locator, Page, expect } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const BASE_URL = process.env.BASE_URL || 'https://app-v2-rc1-aw.smarter.codes';
export const AUTH_FILE = path.join(process.cwd(), 'playwright', '.auth', 'user.json');
const MICROSOFT_SIGN_IN_BUTTON = /Sign In with Microsoft/i;

const DASHBOARD_TIMEOUT = 120_000;
const TRAIN_DOCUMENT_TIMEOUT = 120_000;

export const DEFAULT_VISIBLE_TIMEOUT = 2000;

export async function isVisible(locator: Locator, timeout = DEFAULT_VISIBLE_TIMEOUT): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false);
}

export async function clickIfVisible(locator: Locator, timeout = 3_000): Promise<boolean> {
  if (await isVisible(locator, timeout)) {
    await locator.click();
    return true;
  }
  return false;
}

export async function waitForApplyAllToast(page: Page, timeoutMs = 30000): Promise<string> {
  return page.evaluate((timeoutValue) => {
    return new Promise<string>((resolve, reject) => {
      let observer: MutationObserver | undefined;
      const timeout = window.setTimeout(() => {
        observer?.disconnect();
        reject(new Error(`Apply All toast did not appear within ${timeoutValue}ms.`));
      }, timeoutValue);

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            const text = (node.textContent || '').trim();
            if (/Applied all(?:\s+\d+)?\s+mappings?\.?/i.test(text)) {
              window.clearTimeout(timeout);
              observer?.disconnect();
              resolve(text);
              return;
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }, timeoutMs);
}

async function assertAppIsReachable(page: Page, step: string): Promise<void> {
  const timeoutHeading = page.getByRole('heading', { name: /This site can.t be reached/i });
  if (await isVisible(timeoutHeading)) {
    throw new Error(`App is unavailable while ${step}: Chromium reached a network timeout page at ${page.url()}.`);
  }
}

async function waitForDashboard(page: Page): Promise<void> {
  const agileMappingButton = page.getByRole('button', { name: /Open AgileMapping/i });
  await expect(agileMappingButton).toBeVisible({ timeout: DASHBOARD_TIMEOUT });
}

async function recoverDashboardSession(page: Page): Promise<void> {
  const signInButton = page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON });
  const shouldSignIn = page.url().includes('/signin') || await isVisible(signInButton, 5_000);

  if (!shouldSignIn) {
    return;
  }

  const popupPromise = page.waitForEvent('popup').catch(() => null);
  await signInButton.click();
  const popup = await popupPromise;

  if (popup) {
    await popup.waitForEvent('close', { timeout: DASHBOARD_TIMEOUT }).catch(() => null);
  }

  await page.waitForURL(
    (url: URL) => url.href.startsWith(BASE_URL) && !url.href.includes('/signin'),
    { timeout: DASHBOARD_TIMEOUT }
  );
  await page.waitForLoadState('domcontentloaded');
}

export async function openDashboard(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await assertAppIsReachable(page, 'opening the dashboard');
  await recoverDashboardSession(page);

  try {
    await waitForDashboard(page);
  } catch (error) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertAppIsReachable(page, 'reloading the dashboard');
    await recoverDashboardSession(page);
    await waitForDashboard(page);
  }
}

export async function openAgileMapping(page: Page): Promise<void> {
  await openDashboard(page);

  const openButton = page.getByRole('button', { name: /Open AgileMapping/i });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await expect(openButton).toBeVisible({ timeout: DASHBOARD_TIMEOUT });
    await openButton.click();

    const trainDocumentSignal = page
      .getByRole('heading', { name: /Train Document/i })
      .or(page.getByRole('textbox', { name: /Enter desired output filename/i }));

    try {
      await expect(trainDocumentSignal.first()).toBeVisible({ timeout: TRAIN_DOCUMENT_TIMEOUT });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }

      await openDashboard(page);
    }
  }
}

export async function newAuthenticatedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: AUTH_FILE });
}
