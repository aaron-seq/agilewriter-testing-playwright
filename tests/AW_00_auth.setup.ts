import { test as setup } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const authFile = path.join(__dirname, '../playwright/.auth/user.json');
const MICROSOFT_SIGN_IN_BUTTON = /Sign In with Microsoft/i;
const MICROSOFT_EMAIL_INPUT = /someone@synterex\.com|email, phone, or skype/i;
const MICROSOFT_PASSWORD_INPUT = /enter the password|password/i;

setup('authenticate via Microsoft SSO', async ({ page }) => {
  const baseUrl = process.env.BASE_URL || 'https://app-v2-rc1-aw.smarter.codes';
  await page.goto(`${baseUrl}/signin`);

  // SSO opens as a popup
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON }).click();
  const popup = await popupPromise;

  // Fill email in popup
  await popup.getByRole('textbox', { name: MICROSOFT_EMAIL_INPUT }).fill(process.env.MS_EMAIL!);
  await popup.getByRole('button', { name: 'Next' }).click();

  // Fill password in popup
  await popup.getByRole('textbox', { name: MICROSOFT_PASSWORD_INPUT }).fill(process.env.MS_PASSWORD!);
  await popup.getByRole('button', { name: 'Sign in' }).click();

  // "Stay signed in?" — uncheck + Yes
  await popup.locator('label').click();
  await popup.getByRole('button', { name: 'Yes' }).click();

  // Wait for popup to close and land on dashboard
  await page.waitForURL(`${baseUrl}/**`, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');

  // Save session
  await page.context().storageState({ path: authFile });
  console.log('Session saved!');
});
