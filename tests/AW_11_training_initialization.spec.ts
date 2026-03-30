import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { openAgileMapping } from './helpers/app-navigation';
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
  await openAgileMapping(page);

  // Action -> Enter desired output filename
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill('test_AW_11_' + Date.now());

  // Action -> Select destination template
  await page.getByRole('button', { name: 'Select destination template [' }).click();
  await page.getByRole('button', { name: 'Expand CEPI ICF' }).click();
  await page.getByRole('checkbox', { name: 'Select ICF_SET0_modified_10-' }).check();
  // Using Select button to confirm selection
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  // Action -> Select source documents
  await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();
  await page.getByRole('button', { name: 'Expand CEPI' }).click();
  await page.getByRole('checkbox', { name: 'Select CEPI_Synterex_Protocol' }).check();
  await page.getByRole('checkbox', { name: 'Select CEPI EOI_A14Protocols_Test Scenario.docx' }).check();
  await page.getByRole('checkbox', { name: 'Select CEPI SOA_Mock Source.' }).check();
  // Using Done button to confirm selection
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

  // Action -> Select QA reference document
  await page.getByRole('button', { name: 'Select QA reference document' }).click();
  await page.getByRole('button', { name: 'File: CEPI_PLS_18March2026_raw_qa.xlsx' }).click();
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  // Action -> Click Start Training
  await page.getByRole('button', { name: 'Start Training [Alt+G]' }).click();
  console.log('Clicked Start Training, waiting for navigation...');

  // Validate -> Navigation to the training/generation page
  // The URL should transition to /train with an ID
  await expect(page).toHaveURL(/.*\/train\?id=.*/, { timeout: 60000 });
  console.log('Navigation to /train successful. URL:', page.url());

  // Verify -> The page is loading or has loaded the workspace
  // Initially, it shows "Loading Training Workspace"
  await expect(page.getByRole('heading', { name: /Loading\s*Training\s*Workspace/i })).toBeVisible({ timeout: 30000 });
  console.log('Headings found, waiting for document preview generation...');

  // Wait for the loading to progress (optional, but good for stability)
  await expect(page.getByText(/Generating\s*interactive\s*document\s*preview/i)).toBeVisible({ timeout: 60000 });
  console.log('Generating interactive document preview visible...');

  // Support for "Generate Document" page - looking for "Create Final Doc" as the primary indicator
  // as the literal text "Generate Document" is not present in the current UI version.
  await expect(page.getByRole('button', { name: /Create\s*Final\s*Doc/i })).toBeVisible({ timeout: 120000 });
  console.log('"Create Final Doc" button found!');

  // Once loaded, verify other functional elements
  // Note: The buttons are named "Show document list" and "Show mapping controls"
  // but contain "Sources" and "Mapping" text respectively.
  await expect(page.getByRole('button', { name: /Show\s*document\s*list/i })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: /Show\s*mapping\s*controls/i })).toBeVisible({ timeout: 10000 });

  // Optional: Double check by text if needed
  await expect(page.getByText(/Sources/i).first()).toBeVisible();
  await expect(page.getByText(/Mapping/i).first()).toBeVisible();

  console.log('Functional elements verified. Training initialization successful.');
});
