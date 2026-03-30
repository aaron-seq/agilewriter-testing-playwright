import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

test('AW_05: File Name Validation', async ({ page }) => {
  // 1. Navigate to the dashboard (reusing auth state)
  await page.goto(process.env.BASE_URL as string);

  // Re-login button if needed (MSAL can be tricky with sessionStorage)
  const signInButton = page.getByRole('button', { name: 'Microsoft Logo Sign In with' });
  if (await signInButton.isVisible()) {
    await signInButton.click();
  }

  // Wait for redirect to land on dashboard
  await page.waitForURL(
    (url: URL) => url.href.startsWith(process.env.BASE_URL as string) && !url.href.includes('/signin'),
    { timeout: 60000 }
  );
  await page.waitForLoadState('networkidle');

  // 2. Click Agile Mapping
  await page.getByText(/Agile\s*Mapping/i).first().click();

  // 3. Wait for the "Train Document" page
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