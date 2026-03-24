import { test as setup } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate via Microsoft SSO', async ({ page }) => {

  await page.goto(`${process.env.BASE_URL}/signin`);

  // SSO opens as a popup
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();
  const popup = await popupPromise;

  // Fill email in popup
  await popup.getByRole('textbox', { name: 'someone@synterex.com' }).fill(process.env.MS_EMAIL!);
  await popup.getByRole('button', { name: 'Next' }).click();

  // Fill password in popup
  await popup.getByRole('textbox', { name: 'Enter the password for s.' }).fill(process.env.MS_PASSWORD!);
  await popup.getByRole('button', { name: 'Sign in' }).click();

  // "Stay signed in?" — uncheck + Yes
  await popup.locator('label').click();
  await popup.getByRole('button', { name: 'Yes' }).click();

  // Wait for popup to close and land on dashboard
  await page.waitForURL(`${process.env.BASE_URL}/**`, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');

  // Save session
  await page.context().storageState({ path: authFile });
  console.log('Session saved!');
});