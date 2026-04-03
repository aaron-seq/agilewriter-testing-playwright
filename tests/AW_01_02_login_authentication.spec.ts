import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

// Ensure this test runs unauthenticated, even if a global storageState was defined 
// in other configuration files. We want to test the explicit login flow.
test.use({ storageState: { cookies: [], origins: [] } });

const MICROSOFT_SIGN_IN_BUTTON = /Sign In with Microsoft/i;
const MICROSOFT_EMAIL_INPUT = /someone@synterex\.com|email, phone, or skype/i;
const MICROSOFT_PASSWORD_INPUT = /enter the password|password/i;

function requiredEnv(name: 'MS_EMAIL' | 'MS_PASSWORD'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Create a local .env file with ${name}=... before running Microsoft SSO tests.`
    );
  }
  return value;
}

test('AW_01-AW_02: Login & Authentication', async ({ page }) => {
  const msEmail = requiredEnv('MS_EMAIL');
  const msPassword = requiredEnv('MS_PASSWORD');

  // Stage 1: Action - Open browser and navigate to application URL
  await page.goto(`${process.env.BASE_URL}/signin`);

  // Validate - Verify Sign-in page is displayed
  await expect(page).toHaveURL(new RegExp(`${process.env.BASE_URL}/signin`));
  const signInButton = page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON });
  await expect(signInButton).toBeVisible();

  // Stage 2: Action - Click "Sign in with Microsoft"
  const popupPromise = page.waitForEvent('popup');
  await signInButton.click();
  const popup = await popupPromise;

  // Stage 3: Action - Select account and login
  // Note: These steps map to the same selectors used in auth.setup.ts
  await popup.getByRole('textbox', { name: MICROSOFT_EMAIL_INPUT }).fill(msEmail);
  await popup.getByRole('button', { name: 'Next' }).click();

  await popup.getByRole('textbox', { name: MICROSOFT_PASSWORD_INPUT }).fill(msPassword);
  await popup.getByRole('button', { name: 'Sign in' }).click();

  // "Stay signed in?" — uncheck + Yes
  await popup.locator('label').click();
  await popup.getByRole('button', { name: 'Yes' }).click();

  // Verify - Verify homepage is displayed
  // Wait for it to navigate away from the signin page to the dashboard/homepage
  await page.waitForURL(
    (url: URL) => url.href.startsWith(process.env.BASE_URL as string) && !url.href.includes('/signin'),
    { timeout: 60000 }
  );

  await page.waitForLoadState('domcontentloaded');

  // Explicit assertion to check we are no longer on the signin page.
  await expect(page).not.toHaveURL(new RegExp(`${process.env.BASE_URL}/signin`));

  // If there's a specific Dashboard header/title to verify, you could also add:
  // await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible(); 
});
