import { test, expect, Page } from '@playwright/test';
import dotenv from 'dotenv';
import { openAgileMapping } from './helpers/app-navigation';

dotenv.config();

test.describe('AW_06-AW_07: Destination Template Handling', () => {
  test.describe.configure({ retries: 2, timeout: 240_000 });

  test.beforeEach(async ({ page }) => {
    await openAgileMapping(page);
  });

  async function openDestinationTemplatePicker(page: Page) {
    await page.getByRole('button', { name: /Select destination template/i }).click();
    await expect(page.getByRole('textbox', { name: /Search files/i })).toBeVisible({ timeout: 30_000 });
  }

  async function openVeevaTemplates(page: Page) {
    await openDestinationTemplatePicker(page);
    const sharePointButton = page.getByRole('button', { name: /Sharepoint/i }).first();
    if (await sharePointButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sharePointButton.click();
    }
    await page.getByRole('button', { name: /Veeva/i }).first().click();
    await page.getByRole('button', { name: /Expand Templates/i }).click();
  }

  test('AW_06: Destination template picker opens and shows available template sources', async ({ page }) => {
    await openVeevaTemplates(page);

    await expect(
      page.getByRole('button', { name: /Veeva|Sharepoint/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('checkbox', { name: /Select Narrative_Set1_template\.docx/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('AW_06: Selecting a different template keeps destination selection in single-select mode', async ({ page }) => {
    await openVeevaTemplates(page);

    await page.getByRole('checkbox', { name: /Select Narrative_Set1_template\.docx/i }).check();
    await expect(page.getByText(/file selected/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('checkbox', { name: /Select 2\.6_2\.6\.4 18 June\.docx/i }).check();
    await expect(page.getByText(/file selected/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('checkbox', { name: /Select IND_2\.6\.4/i }).check();
    await expect(page.getByText(/file selected/i)).toBeVisible({ timeout: 15_000 });
  });

  test('AW_07: Selected template shows preview signals and returns to Train Document after confirm', async ({ page }) => {
    await openVeevaTemplates(page);

    await page.getByRole('checkbox', { name: /Select IND_2\.6\.4/i }).check();

    await expect(
      page.locator('.docx-preview__canvas').first()
        .or(page.getByRole('button', { name: /Preview/i }).first())
        .or(page.getByRole('button', { name: /Full Preview/i }).first())
        .first()
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /Select \[ENTER\]/i }).click();

    await expect(
      page.getByRole('button', { name: /IND_2\.6\.4/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: /Start Training/i })
    ).toBeVisible({ timeout: 20_000 });
  });
});
