import { test, expect } from '@playwright/test';

test('AW_12_Agile_Mapping_Preview_Verify', async ({ page }) => {
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
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill('AW_12_test_' + Date.now());

  // Action -> Select destination template
  await page.getByRole('button', { name: 'Select destination template [' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Expand QA Testing' }).click();
  
  await page.waitForTimeout(1000); 

  // Dynamically select the first available file in the folder as the template
  const fileCheckboxes = await page.getByRole('checkbox').all();
  let selectedTemplateName = '';
  let templateCheckbox = null;
  
  for (const cb of fileCheckboxes) {
    const ariaLabel = await cb.getAttribute('aria-label');
    const labelText = ariaLabel || await cb.innerText();
    if (labelText && !labelText.includes('QA Testing') && !labelText.includes('Select All')) {
      templateCheckbox = cb;
      selectedTemplateName = labelText.replace('Select ', '').trim();
      break;
    }
  }

  if (templateCheckbox) {
    await templateCheckbox.check();
  } else {
    throw new Error('No files found inside QA Testing folder to use as template');
  }

  await expect(page.locator('h3').getByText(selectedTemplateName)).toBeVisible();
  // Wait for loading to appear
  await expect(page.getByText('Loading preview...')).toBeVisible();

  // Wait for loading to disappear (this is the key step)
  await expect(page.getByText('Loading preview...')).toBeHidden();

  // Now confirm preview is actually visible
  await expect(page.getByText('Preview', { exact: true })).toBeVisible();


  await expect(page.getByRole('button', { name: 'Full Preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Full Preview' }).click();
  await page.getByRole('button', { name: 'Close modal' }).click();
  
  // Using Select button to confirm selection
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();


  // Action -> Select source documents

  await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();

  // await page.getByRole('button', { name: 'Expand QA Testing' }).click();
  // await page.getByRole('checkbox', { name: 'Select QA Testing' }).check();

  // Expand folder
  await expect(page.getByLabel('Folder: M274')).toContainText('M274');
  await page.getByRole('button', { name: 'Expand M274' }).click();
  await page.getByRole('checkbox', { name: 'Select M274' }).check();

  // Get all file buttons inside M274
  const fileButtons = await page.locator('[role="button"][aria-label^="File:"]').all();

  if (fileButtons.length === 0) {
    throw new Error('No files found inside M274 folder');
  }

  for (const fileBtn of fileButtons) {
    const fileName = await fileBtn.getAttribute('aria-label');

    // Click file
    await fileBtn.click();

    // Wait for preview loading lifecycle
    await expect(page.getByText('Loading preview...')).toBeVisible();
    await expect(page.getByText('Loading preview...')).toBeHidden();
    await expect(page.getByText('Preview', { exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Full Preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Full Preview' }).click();
    await page.getByRole('button', { name: 'Close modal' }).click();
  }
  

  // Using Done button to confirm selection
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

  // Start Training
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

  await expect(page.getByText(/source file[s]? ready to review/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

  // Dynamically verify files in the Documents list

  // Step 1: Extract expected count
  const subtitle = page.getByText(/source file[s]? ready to review/i);
  await expect(subtitle).toBeVisible();

  const text = await subtitle.textContent();
  const match = text?.match(/(\d+)/);

  if (!match) {
    throw new Error('Could not extract source file count');
  }

  const expectedCount = parseInt(match[1], 10);
  console.log(`Expecting ${expectedCount} document buttons in the list.`);

  // Step 2: Use ACCESSIBLE NAME (correct approach)
  const docButtons = page.getByRole('button', {
    name: /Show .*source document/i
  });

  // Wait until they appear
  await expect(docButtons.first()).toBeVisible({ timeout: 30000 });

  // Step 3: Validate count
  await expect(docButtons).toHaveCount(expectedCount);

  // Step 4: Iterate
  for (let i = 0; i < expectedCount; i++) {
    const btn = docButtons.nth(i);

    await btn.click();

    const loader = page.getByText('Loading preview...');

    // Optional wait for loader
    if (await loader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(loader).toBeHidden();
    }

    // Always validate final render
    await expect(page.locator('.docx-preview-wrapper')).toBeVisible();
    await expect(page.locator('.docx-preview__canvas')).toBeVisible();
    await expect(page.getByText('Preview')).toBeVisible();
  }

  // Step 5: Verify selected template preview
  if (selectedTemplateName) {
    const cleanTemplateNameRegex = new RegExp(
      selectedTemplateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    );

    const templateLocator = page
      .getByRole('button', { name: cleanTemplateNameRegex })
      .first();

    await expect(templateLocator).toBeVisible();
    await templateLocator.click();

    await expect(page.getByText('Template Preview')).toBeVisible();
  }
  
  await page.getByRole('button', { name: 'Close Documents drawer' }).click();
});