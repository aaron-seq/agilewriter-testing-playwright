import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

// Ensure this test runs unauthenticated, even if a global storageState was defined 
// in other configuration files. We want to test the explicit login flow.
test.use({ storageState: { cookies: [], origins: [] } });

test('AW_01-AW_02: Login & Authentication', async ({ page }) => {
  // Stage 1: Action - Open browser and navigate to application URL
  await page.goto(`${process.env.BASE_URL}/signin`);

  // Validate - Verify Sign-in page is displayed
  await expect(page).toHaveURL(new RegExp(`${process.env.BASE_URL}/signin`));
  const signInButton = page.getByRole('button', { name: 'Microsoft Logo Sign In with' });
  await expect(signInButton).toBeVisible();

  // Stage 2: Action - Click "Sign in await page.getByRole('checkbox', { name: 'Select CSR_Template_20FEB2026' }).check();with Microsoft"
  const popupPromise = page.waitForEvent('popup');
  await signInButton.click();
  const popup = await popupPromise;

  // Stage 3: Action - Select account and login
  // Note: These steps map to the same selectors used in auth.setup.ts
  await popup.getByRole('textbox', { name: 'someone@synterex.com' }).fill(process.env.MS_EMAIL!);
  await popup.getByRole('button', { name: 'Next' }).click();

  await popup.getByRole('textbox', { name: 'Enter the password for s.' }).fill(process.env.MS_PASSWORD!);
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

  await page.waitForLoadState('networkidle');

  // Explicit assertion to check we are no longer on the signin page.
  await expect(page).not.toHaveURL(new RegExp(`${process.env.BASE_URL}/signin`));

  // If there's a specific Dashboard header/title to verify, you could also add:
  // await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible(); 
});
