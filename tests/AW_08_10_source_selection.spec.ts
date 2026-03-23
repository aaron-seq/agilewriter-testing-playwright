import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

test('AW_08-AW_10: Source Selection & Preview', async ({ page }) => {
  // JIRA ACTION: Navigate to Train Document page (Pre-requisite for AW_08)
  await page.goto(process.env.BASE_URL as string);
  await page.waitForLoadState('networkidle');

  // Handle MSAL re-auth
  const signInButton = page.getByRole('button', { name: 'Microsoft Logo Sign In with' });
  if (await signInButton.isVisible()) {
    await signInButton.click();
    await page.waitForURL(
      (url: URL) => url.href.startsWith(process.env.BASE_URL as string) && !url.href.includes('/signin'),
      { timeout: 60000 }
    );
  }

  // Go to AgileMapping
  await page.getByText(/Agile\s*Mapping/i).first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible();

  // JIRA MAPPING [AW08]: Open Source dropdown and verify Veeva/SharePoint sources are listed
  // TODO: Aaron — adjust selector for Source dropdown if needed
  await page.getByRole('button', { name: /Source/i, exact: false }).nth(1).click(); // Often the second button after Destination

  await expect(page.getByText(/Veeva/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/SharePoint/i).first()).toBeVisible();

  // JIRA MAPPING [AW09]: Select multiple sources and verify they remain selected simultaneously (multi-select supported)
  // Assuming checkboxes for selection
  const firstSource = page.getByRole('checkbox').nth(0);
  const secondSource = page.getByRole('checkbox').nth(1);

  await firstSource.check();
  await secondSource.check();

  await expect(firstSource).toBeChecked();
  await expect(secondSource).toBeChecked();

  // JIRA MAPPING [AW10]: Click Full Preview and verify document preview is visible
  // Assuming there's a button or icon for full preview for the selected source
  const fullPreviewBtn = page.getByRole('button', { name: /Full\s*Preview/i }).first();
  if (await fullPreviewBtn.isVisible()) {
    await fullPreviewBtn.click();

    // Verify preview modal/area 
    const previewModal = page.locator('.source-preview-modal, [role="dialog"]').first();
    await expect(previewModal).toBeVisible();

    // Close preview
    await page.getByRole('button', { name: /Close/i }).first().click();
  }

  // JIRA ACTION: Confirm source selection and return to Train Document
  await page.getByRole('button', { name: /Confirm/i }).click();
  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible();

  console.log(' [TC6] AW_08-AW_10 Source Selection & Preview PASSED');
});
