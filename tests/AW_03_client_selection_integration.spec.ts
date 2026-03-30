import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { openDashboard } from './helpers/app-navigation';
dotenv.config();

test('AW_03: Client Selection & Integration', async ({ page }) => {
  await openDashboard(page);

  // ACTION -> Click Client button & Select required client
  // Click "ORG" (Organization Selection)
  await page.getByRole('button', { name: 'ORG' }).click();


  // Click the client mapping link. This triggers a SharePoint popup.
  const sharepointPagePromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Organization Default Use' }).getByRole('link').click();

  // VALIDATE -> Validate SharePoint integration for selected client
  const sharepointPage = await sharepointPagePromise;

  // Wait for the SharePoint page to load
  await sharepointPage.waitForLoadState('domcontentloaded');

  // We check the title indicator in SharePoint to validate it opened the expected site
  await expect(sharepointPage.locator('#DeltaPlaceHolderPageTitleInTitleArea')).toContainText('My Organization');

  // Optional: close the SharePoint tab if no longer needed
  await sharepointPage.close();

  // VERIFY -> Verify selected client name is visible back on the main app
  // Check if "Organization" is listed as selected/visible
  await expect(page.locator('tbody')).toContainText('Organization');

  // Close the select client modal
  await page.getByRole('button', { name: 'Close Select Client' }).click();

  // Verify the homepage button reflects the selected item text. 
  // Selecting "Organization" shows "ORG". For other items, it should show their respective names.
  await expect(page.getByRole('button', { name: 'ORG', exact: true })).toBeVisible();
});
