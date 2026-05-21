const { test } = require('@playwright/test');

test('Find Ideaya Folder', async ({ page }) => {
  const BASEURL = process.env.BASEURL || 'https://app-v2-rc1-aw.smarter.codes';
  await page.goto(`${BASEURL}/signin`);
  await page.getByPlaceholder('Enter your email').fill(process.env.TEST_USER_EMAIL || 'agilewritertester@gmail.com');
  await page.getByPlaceholder('Enter password').fill(process.env.TEST_USER_PASSWORD || 'Welcome@1234');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.waitForURL('**/dashboard');
  
  // Go to start new document
  await page.getByRole('button', { name: 'Start New Document' }).click();
  
  // Wait for the modal or page to load
  await page.waitForTimeout(5000);
  
  // Look for SharePoint tree
  // Assuming there's a button or tab for SharePoint
  await page.getByRole('button', { name: 'Select From SharePoint' }).click();
  
  await page.waitForTimeout(5000);
  
  // Get all buttons or items that might be folders
  const allTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .map(el => el.textContent?.trim())
      .filter(t => t && t.includes('Template'));
  });
  
  console.log('Found texts containing "Template":', [...new Set(allTexts)]);
  
  await page.screenshot({ path: 'ideaya_folder_search.png', fullPage: true });
});
