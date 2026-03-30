import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

// test.use({ video: 'on' }); // Options: 'on', 'retain-on-failure', or 'on-first-retry'

test('AW_04: Agile Mapping Access', async ({ page }) => {
  // Navigate to the base URL
  await page.goto(process.env.BASE_URL as string);

  // Because MSAL (Microsoft Auth) often uses sessionStorage (which Playwright doesn't save across tests), 
  // the app asks us to "Sign In" again. Since your Microsoft cookies ARE saved, clicking this button 
  // instantly completes the login without asking for an email/password.
  await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();

  // Wait for the SSO redirect to complete and land on the dashboard
  await page.waitForURL(
    (url: URL) => url.href.startsWith(process.env.BASE_URL as string) && !url.href.includes('/signin'),
    { timeout: 60000 }
  );


  // Action -> Click AgileMapping
  // You might need to adjust the locator depending on whether it's a link, button, or menu item.
  // Using a broad text matcher here as a starting point.
  await page.getByText(/Agile\s*Mapping/i).first().click();

  // Wait for the page to navigate or load the new view
  await page.waitForLoadState('networkidle');

  // Verify -> Train Document page is displayed
  // Checking for a heading that says "Train Document". Alternatively, we could check the URL.
  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible();

  // Optional: Also assert that the URL contains the expected path (update '/train-document' if it's different)
  // await expect(page).toHaveURL(/.*train-document/);
});