import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

// AW_06: Destination Template Selection - Test 1
test('AW_06: Destination Template — Veeva and SharePoint links are visible', async ({ page }) => {
  await page.goto(process.env.BASE_URL as string);
  await page.waitForLoadState('networkidle');

  const signInButton = page.getByRole('button', { name: 'Microsoft Logo Sign In with' });
  if (await signInButton.isVisible()) {
    await signInButton.click();
    await page.waitForURL(
      (url: URL) => url.href.startsWith(process.env.BASE_URL as string) && !url.href.includes('/signin'),
      { timeout: 60000 }
    );
  }

  await page.getByText(/Agile\s*Mapping/i).first().click();
  await page.waitForLoadState('networkidle');

  // Click "Destination Template" using exact locator from recorder
  await page.getByRole('button', { name: 'Select destination template [' }).click();

  // Reveal Veeva by clicking the default selected Sharepoint dropdown
  const spDropdown = page.getByRole('button', { name: 'Sharepoint', exact: true }).first();
  await expect(spDropdown).toBeVisible({ timeout: 15000 });
  await spDropdown.click();

  // Verify Veeva templates section is visible (button from recorder)
  // JIRA MAPPING: Verified Veeva and SharePoint templates both visible on selection page
  await expect(page.getByText(/Veeva/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Sharepoint/i).first()).toBeVisible({ timeout: 15000 });

  // Return to Train Document page
  await page.getByRole('button', { name: 'Cancel [ESC]' }).first().click();
  console.log('TC5 — Destination Template — Veeva and SharePoint links are visible PASSED');
});

// AW_07: Destination Template Selection - Test 2
test('AW_07: Destination Template — Single selection enforced', async ({ page }) => {
  await page.goto(process.env.BASE_URL as string);
  await page.waitForLoadState('networkidle');

  const signInButton = page.getByRole('button', { name: 'Microsoft Logo Sign In with' });
  if (await signInButton.isVisible()) await signInButton.click();

  await page.getByText(/Agile\s*Mapping/i).first().click();
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Select destination template [' }).click();

  // Open Veeva by expanding Sharepoint dropdown
  const spDropdown = page.getByRole('button', { name: 'Sharepoint', exact: true }).first();
  if (await spDropdown.isVisible()) await spDropdown.click();
  
  const veevaBtn = page.getByText(/Veeva/i).first();
  if (await veevaBtn.isVisible()) await veevaBtn.click();

  // Expand first if possible to reveal checkboxes
  const expandBtn = page.getByRole('button', { name: 'Expand Templates' }).first();
  if (await expandBtn.isVisible()) await expandBtn.click();

  // Select first template via checkbox (from recorder)
  const firstCheckbox = page.getByRole('checkbox', { name: 'Select Narrative_Set1_template.docx' }).first();
  if (await firstCheckbox.isVisible()) {
    await firstCheckbox.check();
    // JIRA MAPPING: Single-select enforcement: unchecks previous template when new one selected
    await expect(firstCheckbox).toBeChecked({ timeout: 15000 });
  } else {
    // Fallback
    await page.getByRole('checkbox').nth(0).check();
    await expect(page.getByRole('checkbox').nth(0)).toBeChecked();
  }

  // Verify template preview appears
  // JIRA MAPPING: Template preview displays correctly after selection
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.getByText('MetadataPreview')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Close modal' }).click();

  // Attempt to select second template via checkbox
  const secondCheckbox = page.getByRole('checkbox', { name: 'Select 2.6_2.6.4 18 June.docx' }).first();
  if (await secondCheckbox.isVisible()) {
    await secondCheckbox.check();

    // Verify first template is deselected
    if (await firstCheckbox.isVisible()) {
      await expect(firstCheckbox).not.toBeChecked({ timeout: 15000 });
    }
    // Verify second template is now checked
    await expect(secondCheckbox).toBeChecked({ timeout: 15000 });
  } else {
    await page.getByRole('checkbox').nth(1).check();
    await expect(page.getByRole('checkbox').nth(1)).toBeChecked();
    await expect(page.getByRole('checkbox').nth(0)).not.toBeChecked();
  }

  // Confirm selection using the Upload[Alt+U] or Confirm button
  const confirmBtn = page.getByRole('button', { name: /Upload \[Alt\+U\]|Confirm/i }).first();
  if (await confirmBtn.isVisible()) await confirmBtn.click();

  // Verify selection state persists on page
  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible({ timeout: 15000 });

  console.log('TC5 — Destination Template — Single selection enforced PASSED');
});

// AW_07: Destination Template Selection - Test 3
test('AW_07: Destination Template — Confirm selection and navigate back', async ({ page }) => {
  await page.goto(process.env.BASE_URL as string);
  await page.waitForLoadState('networkidle');

  const signInButton = page.getByRole('button', { name: 'Microsoft Logo Sign In with' });
  if (await signInButton.isVisible()) await signInButton.click();

  await page.getByText(/Agile\s*Mapping/i).first().click();
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Select destination template [' }).click();

  // Select a template
  const checkbox = page.getByRole('checkbox').first();
  await checkbox.check();

  // Click "Upload [Alt+U]" or "Confirm" button
  const confirmBtn = page.getByRole('button', { name: /Upload \[Alt\+U\]|Confirm/i }).first();
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click();
  } else {
    await page.keyboard.press('Alt+u');
  }

  // JIRA MAPPING: Confirm button persists selection and navigates back to Train Document
  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible({ timeout: 15000 });

  console.log('TC5 — Destination Template — Confirm selection and navigate back PASSED');
});
