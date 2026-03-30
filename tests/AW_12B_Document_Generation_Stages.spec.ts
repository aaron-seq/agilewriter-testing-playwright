import { test, expect } from '@playwright/test';

test('AW_12B_Document_Generation_Stages', async ({ page }) => {
  await page.goto(process.env.BASE_URL as string);

  // Playwright global session cache enabled, overriding manual SSO login

  await page.waitForURL(
    (url: URL) =>
      url.href.startsWith(process.env.BASE_URL as string) &&
      !url.href.includes('/signin'),
    { timeout: 60_000 }
  );

  //await expect(page.locator('h2')).toContainText('Services');
  await expect(
    page.getByLabel('Open AgileMapping').getByRole('heading')
  ).toContainText('AgileMapping');

  await page.getByRole('button', { name: 'Open AgileMapping' }).click();

  await expect(
    page.getByRole('button', { name: 'Start Training [Alt+G]' })
  ).toBeVisible();

  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill('AW_12_09_test');

  page.once('dialog', d => d.dismiss());
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).press('Enter');

  // Template selection
  await page.getByRole('button', { name: 'Select destination template [' }).click();
  await page.getByRole('textbox', { name: 'Search files' }).fill('CSR_Table_Trimmed.docx');
  await page.getByRole('button', { name: 'Expand CSR' }).click();
  await page.getByRole('checkbox', { name: 'Select CSR_Table_Trimmed.docx' }).check();

  await expect(page.locator('h3')).toContainText('CSR_Table_Trimmed.docx');
  await page.getByRole('button', { name: 'Full Preview' }).click();
  await page.getByRole('button', { name: 'Close modal' }).click();
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  // Source selection
  await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();
  await page.getByRole('textbox', { name: 'Search files' }).fill('Protocol Example (28Sep2023)_trimmed.docx');
  await page.getByRole('button', { name: 'Expand Protocol' }).click();
  await page.getByRole('checkbox', { name: 'Select Protocol Example (' }).check();
  await page.getByRole('button', { name: 'File: Protocol Example (' }).click();

  await page.getByRole('button', { name: 'Full Preview' }).click();
  await page.getByRole('button', { name: 'Close modal' }).click();
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

  await page.getByRole('button', { name: 'Start Training [Alt+G]' }).click();

  await expect(page.getByText('Connecting to SharePoint and')).toBeVisible();

  // Wait for workspace ready
  await expect(
    page.getByRole('button', { name: 'Show document list' })
  ).toBeVisible({ timeout: 120_000 });

  await expect(
    page.getByRole('button', { name: 'Show mapping controls' })
  ).toBeVisible();

  const sponsorBtn = page.getByRole('button', { name: /Sponsor.*Name/ }).first();
  const tableBtn = page.getByRole('button', {
    name: '<Table Summary of Participant Disposition>',
  }).first();

  // ── Stage 1: Indexing Sources ─────────────────────────────
  const indexingStage = page.getByText('Indexing Sources').locator('..');
  const indexingSpinner = indexingStage.locator('[aria-label="Processing"]');

  await expect(indexingSpinner).toBeVisible({ timeout: 60_000 });

  // Grey during Stage 1 (eventual, not strict)
  await expect.poll(
    () => sponsorBtn.evaluate(el => getComputedStyle(el).backgroundColor),
    { timeout: 30_000 }
  ).toContain('156, 163, 175');

  await expect(
    indexingStage.getByRole('img', { name: 'Completed' })
  ).toBeVisible({ timeout: 3000000 });

  // ── Stage 2: Finding Placeholder Matches ─────────────────
  const findingStage = page.getByText('Finding Placeholder Matches').locator('..');
  const findingSpinner = findingStage.locator('[aria-label="Processing"]');

  // Wait until Stage 2 is present (safe, quick check)
  await expect(
    page.getByText('Finding Placeholder Matches')
  ).toBeVisible();

  // Wait until Stage 3 appears → guarantees Stage 2 completed
  await expect(
    page.getByText('Populating Placeholders')
  ).toBeVisible({ timeout: 300_000 });

  await expect(
    page.getByRole('button', { name: 'Create Final Doc [Alt+G]' })
  ).toBeDisabled();

  await expect.poll(
    async () => {
      const color = await sponsorBtn.evaluate(el =>
        getComputedStyle(el).backgroundColor
      );

      if (
        color.includes('246, 234, 59') || // yellow
        color.includes('156, 163, 175')   // grey
      ) {
        return true;
      }

      throw new Error(`Unexpected color: ${color}`);
    },
    { timeout: 6000000 }
  ).toBe(true);

  // ── Stage 3: Populating Placeholders ─────────────────────
  const populatingStage = page.getByText('Populating Placeholders').locator('..');




  // Wait for final outcome instead of UI indicator
  await expect(
    page.getByRole('button', { name: 'Create Final Doc [Alt+G]' })
  ).toBeEnabled({ timeout: 300_000 });

  // verify final state via color
  await expect.poll(
    () => sponsorBtn.evaluate(el => getComputedStyle(el).backgroundColor),
    { timeout: 120_000 }
  ).toContain('16, 185, 129');

  // Final assertions
  await expect(
    page.getByRole('button', { name: 'Create Final Doc [Alt+G]' })
  ).toBeEnabled();

  await page.getByRole('button', { name: 'Apply All [Alt+Y]' }).click();

  await expect(page.getByText('Applied all 2 mappings.')).toBeVisible();

  // Green after completion
  await expect.poll(
    () => sponsorBtn.evaluate(el => getComputedStyle(el).backgroundColor),
    { timeout: 60_000 }
  ).toContain('16, 185, 129');
});