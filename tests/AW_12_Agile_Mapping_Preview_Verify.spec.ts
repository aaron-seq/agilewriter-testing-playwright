import { test, expect } from '@playwright/test';

test('AW_12_Source Document Handling', async ({ page }) => {
  // Navigate to the base URL
  await page.goto(process.env.BASE_URL as string);

  // Authentication - Instantly completes if session is valid or cookies are present
  // Following the pattern from existing tests (AW_04_agile_mapping_access.spec.ts)
  await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();
  
  // Wait for the redirect to complete and land on the dashboard
  await page.waitForURL(
    (url: URL) => url.href.startsWith(process.env.BASE_URL as string) && !url.href.includes('/signin'),
    { timeout: 60_000 }
  );

  await expect(page.locator('h2')).toContainText('Services');

  // Action -> Click Open AgileMapping
  await expect(page.getByLabel('Open AgileMapping').getByRole('heading')).toContainText('AgileMapping');
  await page.getByRole('button', { name: 'Open AgileMapping' }).click();

  // Wait for Train Document screen
  await expect(page.getByRole('heading')).toContainText('Train Document');

  await page.getByRole('textbox', { name: 'Enter desired output filename' }).click();
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill('AW_12_test_001');

  await page.getByRole('button', { name: 'Select destination template [' }).click();

  // Wait for template search box
  await page.waitForSelector('input[aria-label="Search files"], [role="textbox"][name="Search files"]', {
    state: 'visible',
    timeout: 60_000,
  });
  await page.getByRole('textbox', { name: 'Search files' }).click();
  await page.getByRole('textbox', { name: 'Search files' }).fill('CSR_Template_20FEB2026.docx');
  await page.getByRole('textbox', { name: 'Search files' }).press('Enter');

  // Wait for QA Testing folder and template checkbox to appear
  await page.getByRole('button', { name: 'Expand QA Testing' }).click();
  await page.getByRole('checkbox', { name: 'Select CSR_Template_20FEB2026' }).check();

  await expect(page.locator('h3').getByText('CSR_Template_20FEB2026.docx')).toBeVisible();
  await expect(page.getByText('Preview', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Full Preview' }).click();

  // Wait for Full Preview modal
  await page.waitForSelector('[aria-label="Full Preview"]', {
    state: 'visible',
    timeout: 600_000,
  });
  await expect(page.getByLabel('Full Preview').getByText('CSR_Template_20FEB2026.docx')).toBeVisible();
  await expect(
    page.getByLabel('Full Preview').getByText('<Sponsor\'s Name> Clinical Study Report Clinical Study Report Page 16 of <')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Close modal' }).click();
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();

  // Wait for source docs search
  await page.getByRole('textbox', { name: 'Search files' }).click();
  await page.getByRole('textbox', { name: 'Search files' }).fill('QA Testing');

  // Wait for QA Testing checkbox
  await page.getByRole('checkbox', { name: 'Select QA Testing' }).check();
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

  await expect(page.getByRole('button', { name: '3 files: Mock_CSR' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Start Training [Alt+G]' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Training [Alt+G]' }).click();

  // Training may take time
  await page.waitForSelector('text=Connecting to SharePoint and', {
    state: 'visible',
  });
  await expect(page.getByText('Connecting to SharePoint and')).toBeVisible();

  await page.waitForSelector('text=Generating interactive', {
    state: 'visible',
  });
  await expect(page.getByText('Generating interactive')).toBeVisible();

  // Wait for document list to be available
  
  await expect(page.getByRole('button', { name: 'Show document list' })).toBeVisible();
  await expect(page.getByLabel('Show document list')).toContainText('Sources');
  await page.getByRole('button', { name: 'Show document list' }).click();

  await expect(page.getByText('source files ready to review')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Show Mock_CSR _Tables_30Oct25' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Mock_CSR_Protocol.docx' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Mock_CSR Key' })).toBeVisible();

  await page.getByRole('button', { name: 'Show Mock_CSR_Protocol.docx' }).click();

  
  await expect(page.getByRole('button', { name: 'word icon Mock_CSR_Protocol.' })).toBeVisible();
  await page.waitForSelector('text=Source Preview', {
  state: 'visible',
  timeout: 600_000
});

  await expect(page.getByText('Source Preview')).toBeVisible();
  await page.locator('.docx-preview__canvas').click();
  await page.getByRole('button', { name: 'Show Mock_CSR Key' }).click();
  await expect(page.getByRole('button', { name: 'word icon Mock_CSR Key' })).toBeVisible();
  await page.getByText('Source Preview').click();
  await page.waitForSelector('text=Source Preview', {
  state: 'visible',
  timeout: 600_000
});

  await expect(page.getByText('Source Preview')).toBeVisible();
  await expect(page.locator('.docx-preview__canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Show Mock_CSR _Tables_30Oct25' }).click();
  await expect(page.getByRole('button', { name: 'rtf icon Mock_CSR' })).toBeVisible();
  await expect(page.getByText('Unable to render this DOCX')).toBeVisible();
  await page.getByRole('button', { name: 'word icon CSR_Template_20FEB2026.docx' }).click();

  await page.waitForSelector('text=Template Preview', {
  state: 'visible',
  timeout: 600_000
});
  await expect(page.getByText('Template Preview')).toBeVisible();
  await expect(page.getByText('<Sponsor\'s Name> Clinical Study Report Clinical Study Report Page 16 of <')).toBeVisible();
  
  await page.getByRole('button', { name: 'Close Documents drawer' }).click();
});