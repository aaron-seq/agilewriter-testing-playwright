import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { openAgileMapping } from './helpers/app-navigation';
dotenv.config();

test('AW_05: File Name Validation', async ({ page }) => {
  await openAgileMapping(page);

  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible();

  const fileNameInput = page.getByPlaceholder('Enter desired output filename');
  const startTrainingButton = page.getByRole('button', { name: 'Start Training' });
  const errorMessage = page.getByText('Please enter a name that doesn\'t include any of these characters: " * : < > ? / \\ |.');

  // 4. Action -> Enter characters that are invalid for file names
  await fileNameInput.fill('Invalid*File?Name');

  // 5. Validate -> specific error message appears
  await expect(errorMessage).toBeVisible();

  // 6. Verify -> "Start Training" button is disabled
  await expect(startTrainingButton).toBeDisabled();

  // 7. Action -> Enter a file name with underscores
  await fileNameInput.fill('Valid_File_Name_01');

  // 8. Verify -> No error message appears and the "Start Training" button is enabled
  await expect(errorMessage).not.toBeVisible();
  await expect(startTrainingButton).toBeEnabled();

  // 9. Action -> Enter a standard valid file name
  await fileNameInput.fill('ProjectTestFile');

  // 10. Verify -> "Start Training" button is enabled
  await expect(startTrainingButton).toBeEnabled();

  // 11. Action -> Click "Select destination template"
  await page.getByRole('button', { name: 'Select destination template' }).click();

  // 12. Verify -> "Select Destination Template" modal opens
  await expect(page.getByRole('dialog', { name: 'Select Destination Template' })).toBeVisible();
});
