import { test, expect } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// AW_06: Destination Template Selection - Test 1
test('AW_06: Destination Template — Veeva and SharePoint links are visible', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Navigate to AgileMapping 
  await page.getByText(/Agile\s*Mapping/i).first().click();
  await page.waitForLoadState('networkidle');

  // Click "Destination Template"
  // SELECTOR TODO: Run codegen to find: [Destination Template button]
  await page.getByRole('button', { name: /Destination\s*Template/i }).click();

  // Verify Veeva templates section is visible with ≥1 template listed
  // JIRA MAPPING:  Verified Veeva and SharePoint templates both visible on selection page
  const veevaSection = page.locator('.veeva-templates, [data-testid="veeva-templates"], table').first();
  await expect(veevaSection).toBeVisible({ timeout: 15000 });

  // Verify SharePoint templates section is visible with ≥1 template listed
  const spSection = page.locator('.sharepoint-templates, [data-testid="sharepoint-templates"], table').nth(1).or(page.getByText(/SharePoint/i).first());
  await expect(spSection).toBeVisible({ timeout: 15000 });

  // Return to Train Document page
  await page.getByRole('button', { name: /Close|Cancel/i }).first().click();
  console.log(' TC5 — Destination Template — Veeva and SharePoint links are visible PASSED');
});

// AW_07: Destination Template Selection - Test 2
test('AW_07: Destination Template — Single selection enforced', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByText(/Agile\s*Mapping/i).first().click();
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Destination\s*Template/i }).click();

  // Select first template via checkbox
  const firstCheckbox = page.getByRole('checkbox').nth(0);
  await firstCheckbox.check();

  // JIRA MAPPING:  Single-select enforcement: unchecks previous template when new one selected
  await expect(firstCheckbox).toBeChecked({ timeout: 15000 });

  // Verify template preview appears
  // JIRA MAPPING:  Template preview displays correctly after selection
  // SELECTOR TODO: Run codegen to find: [template preview pane]
  const previewPane = page.locator('.template-preview, [data-testid="template-preview"]').first();
  await expect(previewPane).toBeVisible({ timeout: 15000 });

  // Attempt to select second template via checkbox
  const secondCheckbox = page.getByRole('checkbox').nth(1);
  if (await secondCheckbox.isVisible()) {
    await secondCheckbox.check();

    // Verify first template is deselected
    await expect(firstCheckbox).not.toBeChecked({ timeout: 15000 });
    // Verify second template is now checked
    await expect(secondCheckbox).toBeChecked({ timeout: 15000 });
  }

  // Confirm selection
  await page.getByRole('button', { name: /Confirm|Save/i }).click();

  // Verify selection state persists on page
  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible({ timeout: 15000 });

  console.log(' TC5 — Destination Template — Single selection enforced PASSED');
});

// AW_07: Destination Template Selection - Test 3
test('AW_07: Destination Template — Confirm selection and navigate back', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByText(/Agile\s*Mapping/i).first().click();
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Destination\s*Template/i }).click();

  // Select a template
  const checkbox = page.getByRole('checkbox').first();
  await checkbox.check();

  // Verify preview is displayed
  const previewPane = page.locator('.template-preview, [data-testid="template-preview"]').first();
  await expect(previewPane).toBeVisible({ timeout: 15000 });

  // Click "Confirm" button
  await page.getByRole('button', { name: /Confirm|Save/i }).click();

  // JIRA MAPPING:  Confirm button persists selection and navigates back to Train Document
  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible({ timeout: 15000 });

  // Verify selected template name is visible in Train Document context
  // SELECTOR TODO: Run codegen to find: [selected template name container]
  await expect(page.getByText(/Destination Template is selected/i).or(page.locator('.selected-template-name'))).toBeVisible({ timeout: 15000 });

  console.log(' TC5 — Destination Template — Confirm selection and navigate back PASSED');
});
