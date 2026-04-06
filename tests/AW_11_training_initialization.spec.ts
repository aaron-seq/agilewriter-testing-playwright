import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

/**
 * AW_11: Training Initialization
 * 
 * Description: Verify that the user can start the training process and navigate 
 * to the "Generate Document" page.
 * 
 * Flow:
 * 1. Login to the application.
 * 2. Open AgileMapping.
 * 3. Fill in the output filename.
 * 4. Select a destination template.
 * 5. Select source documents.
 * 6. Select a QA reference document.
 * 7. Click "Start Training".
 * 8. Verify navigation to the "Generate Document" page.
 */
test('AW_11: Training Initialization', async ({ page }) => {
  // Navigate to the base URL
  await page.goto(process.env.BASE_URL as string);

  // Authentication - Instantly completes if session is valid or cookies are present
  // Following the pattern from existing tests (AW_04_agile_mapping_access.spec.ts)
  await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();
  
  // Wait for the redirect to complete and land on the dashboard
  await page.waitForURL(
    (url: URL) => url.href.startsWith(process.env.BASE_URL as string) && !url.href.includes('/signin'),
    { timeout: 600_000 }
  );

  // Action -> Click Open AgileMapping
  await page.getByRole('button', { name: 'Open AgileMapping' }).click();

  // Action -> Enter desired output filename
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill('test_AW_11_' + Date.now());

  // Action -> Select destination template
  await page.getByRole('button', { name: 'Select destination template [' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Expand QA Testing' }).click();
  await page.getByRole('checkbox').check();

  // Using Select button to confirm selection
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  // Action -> Select source documents

  await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();

  await page.getByRole('button', { name: 'Expand QA Testing' }).click();
  await page.getByRole('checkbox', { name: 'Select QA Testing' }).check();

  // Using Done button to confirm selection
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

// Action -> Select QA reference document
//   await page.getByRole('button', { name: 'Select QA reference document' }).click();
//   await page.getByRole('button', { name: 'File: CEPI_PLS_18March2026_raw_qa.xlsx' }).click();
//   await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  // Action -> Click Start Training
  await page.getByRole('button', { name: 'Start Training [Alt+G]' }).click();
  console.log('Clicked Start Training, waiting for navigation...');

  // Validate -> Navigation to the training/generation page
  // The URL should transition to /train with an ID
  await expect(page).toHaveURL(/.*\/train\?id=.*/, { timeout: 600_000 });
  console.log('Navigation to /train successful. URL:', page.url());
  
  // Verify -> The page is loading or has loaded the workspace
  // Initially, it shows "Loading Training Workspace"
  await expect(page.getByRole('heading', { name: /Loading\s*Training\s*Workspace/i })).toBeVisible({ timeout: 600_000 });
  console.log('Headings found, waiting for document preview generation...');
  
  // Wait for the loading to progress (optional, but good for stability)
  await expect(page.getByText(/Generating\s*interactive\s*document\s*preview/i)).toBeVisible({ timeout: 600_000 });
  console.log('Generating interactive document preview visible...');

  // Support for "Generate Document" page - looking for "Create Final Doc" as the primary indicator
  // as the literal text "Generate Document" is not present in the current UI version.
  await expect(page.getByRole('button', { name: /Create\s*Final\s*Doc/i })).toBeVisible({ timeout: 120_000 });
  console.log('"Create Final Doc" button found!');

  // Once loaded, verify other functional elements
  // Note: The buttons are named "Show document list" and "Show mapping controls"
  // but contain "Sources" and "Mapping" text respectively.
  await expect(page.getByRole('button', { name: /Show\s*document\s*list/i })).toBeVisible({ timeout: 600_000 });
  await expect(page.getByRole('button', { name: /Show\s*mapping\s*controls/i })).toBeVisible({ timeout: 600_000 });
  
  // Optional: Double check by text if needed
  await expect(page.getByText(/Sources/i).first()).toBeVisible();
  await expect(page.getByText(/Mapping/i).first()).toBeVisible();

  console.log('Functional elements verified. Training initialization successful.');
});
