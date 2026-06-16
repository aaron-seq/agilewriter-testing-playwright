import { test, expect, Page } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { isVisible } from './helpers/app-navigation';

const MICROSOFT_SIGN_IN_BUTTON = /Sign In with Microsoft/i;
const MICROSOFT_EMAIL_INPUT = /someone@synterex\.com|email|phone|skype|sign in/i;
const MICROSOFT_PASSWORD_INPUT = /enter the password|password/i;
const DASHBOARD_TIMEOUT = 120_000;
const BASE_URL = runtimeConfig.baseUrl;

function microsoftEmailField(page: Page) {
  return page
    .getByRole('textbox', { name: MICROSOFT_EMAIL_INPUT })
    .or(page.locator('input[name="loginfmt"]'))
    .or(page.locator('input[type="email"]'))
    .or(page.locator('input[type="text"]'))
    .first();
}

function microsoftPasswordField(page: Page) {
  return page
    .getByRole('textbox', { name: MICROSOFT_PASSWORD_INPUT })
    .or(page.locator('input[name="passwd"]'))
    .or(page.locator('input[type="password"]'))
    .first();
}

async function loginWithMicrosoft(page: Page): Promise<void> {
  const msEmail = runtimeConfig.email;
  const msPassword = runtimeConfig.password;

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');

  // If Microsoft auto-completes the login (cached session), the popup will
  // close immediately. In that case we skip all interaction and just wait for
  // the main page to redirect to the dashboard.
  const popupClosed = await popup.waitForEvent('close', { timeout: 5_000 }).then(() => true).catch(() => false);

  if (!popupClosed) {
    // Popup is still open — we need to fill credentials manually.
    // Some SSO sessions skip the email field if the account is cached.
    const emailField = microsoftEmailField(popup);
    const emailVisible = await isVisible(emailField, 5_000);

    if (emailVisible) {
      await emailField.fill(msEmail);
      await popup.getByRole('button', { name: 'Next' }).click();
    }

    const passwordField = microsoftPasswordField(popup);
    await expect(passwordField).toBeVisible({ timeout: DASHBOARD_TIMEOUT });
    await passwordField.fill(msPassword);
    await popup.getByRole('button', { name: 'Sign in' }).click();

    const staySignedInCheckbox = popup.locator('input[type="checkbox"]').first();
    if (await isVisible(staySignedInCheckbox, 5_000)) {
      await staySignedInCheckbox.uncheck().catch(() => undefined);
    }

    const yesButton = popup.getByRole('button', { name: 'Yes' });
    if (await isVisible(yesButton, 10_000)) {
      await yesButton.click();
    }

    // Wait for popup to close after sign-in completes
    await popup.waitForEvent('close', { timeout: DASHBOARD_TIMEOUT }).catch(() => undefined);
  }

  // Wait for the main page to redirect away from /signin to the dashboard
  await page.waitForURL(
    (url: URL) => url.href.startsWith(BASE_URL) && !url.href.includes('/signin'),
    { timeout: DASHBOARD_TIMEOUT }
  );
  await page.waitForLoadState('domcontentloaded');
}

test('Style trainer - scc-198', async ({ page }) => {
  // Navigate to sign-in page
  await page.goto('/signin');

  // Complete Microsoft SSO login
  await loginWithMicrosoft(page);

  // Verify the dashboard loaded
  await expect(page.locator('h2')).toContainText('Services');
  await expect(page.getByRole('button', { name: 'Open StyleTrainer' })).toBeVisible();
  await expect(page.getByLabel('Open StyleTrainer').getByRole('heading')).toContainText('StyleTrainer');

  // Open Style Trainer
  await page.getByRole('button', { name: 'Open StyleTrainer' }).click();
  await expect(page.locator('h1')).toContainText('Style Trainer');

  // Return to dashboard
  await page.goto('/');
});