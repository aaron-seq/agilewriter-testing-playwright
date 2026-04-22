import { Browser, BrowserContext, Locator, Page, expect } from '@playwright/test';
import path from 'path';
import { runtimeConfig } from '../../runtime-config';

export const BASE_URL = runtimeConfig.baseUrl;
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

export async function navigateToFolder(page: Page, folderName: string): Promise<void> {
  const expandButton = page.getByRole('button', { name: new RegExp(`Expand ${folderName}`, 'i') });
  const collapseButton = page.getByRole('button', { name: new RegExp(`Collapse ${folderName}`, 'i') });
  
  // If already expanded, we're done
  if (await isVisible(collapseButton, 2000)) {
    return;
  }
  
  let found = await clickIfVisible(expandButton);
  
  if (!found) {
    const nextBtn = page.getByRole('button', { name: /Next page/i });
    while (await nextBtn.isEnabled().catch(() => false) && !found) {
      await nextBtn.click();
      await page.waitForTimeout(500); // Give DOM time to update
      found = await clickIfVisible(expandButton);
    }
  }
  
  if (!found) {
    throw new Error(`Could not find folder "${folderName}" across all pages.`);
  }
  
  await expect(collapseButton).toBeVisible({ timeout: 10000 });
}

export async function confirmPickerDialog(
  page: Page,
  buttonName: RegExp | string,
  dialogLocator: Locator,
  timeout = 60_000
): Promise<void> {
  await page.getByRole('button', { name: buttonName }).click();
  const closed = await dialogLocator.isHidden({ timeout: 3000 }).catch(() => false);
  if (!closed) {
    console.log(`  ⚠ Dialog did not close on "${buttonName}", trying Enter key...`);
    await page.keyboard.press('Enter');
    await expect(dialogLocator).toBeHidden({ timeout });
  }
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

    try {
      await expect(page.getByRole('heading', { name: /Train Document/i })).toBeVisible({ timeout: TRAIN_DOCUMENT_TIMEOUT });
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

/**
 * Dismisses any modal overlay currently blocking pointer events.
 * Safe to call even when no overlay is present.
 */
export async function dismissModalOverlay(page: Page): Promise<void> {
  const overlay = page.locator(
    '[role="presentation"] [aria-hidden="true"].absolute.inset-0'
  );
  if (await overlay.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const closeModal = page.getByRole('button', { name: /Close modal/i });
    if (await closeModal.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeModal.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(overlay).toBeHidden({ timeout: 10_000 });
  }
}
