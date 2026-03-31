import { test, expect, Page } from '@playwright/test';
import { openAgileMapping } from './helpers/app-navigation';

test.describe('AW_06-AW_07: Destination Template Handling', () => {
  test.describe.configure({ retries: 2, timeout: 240_000 });

  test.beforeEach(async ({ page }) => {
    await openAgileMapping(page);
  });

  async function openDestinationTemplatePicker(page: Page) {
    await page.getByRole('button', { name: /Select destination template/i }).click();
    await expect(page.getByRole('heading', { name: /Select Destination Template/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('textbox', { name: /Search files/i })).toBeVisible({ timeout: 30_000 });
  }

  async function searchKnownTemplate(page: Page) {
    await openDestinationTemplatePicker(page);
    await page.getByRole('textbox', { name: /Search files/i }).fill('CSR_Table_Trimmed.docx');
    await page.getByRole('button', { name: /Expand CSR/i }).click();
    await expect(page.getByRole('checkbox', { name: /Select CSR_Table_Trimmed\.docx/i })).toBeVisible({
      timeout: 30_000,
    });
  }

  test('AW_06: Destination template picker opens with provider and template search controls', async ({ page }) => {
    await openDestinationTemplatePicker(page);

    await expect(page.getByRole('button', { name: /Select source provider/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tree').first()).toBeVisible({ timeout: 15_000 });
  });

  test('AW_07: Selecting a destination template shows preview signals and returns to Train Document', async ({ page }) => {
    await searchKnownTemplate(page);

    const fileButton = page.getByRole('button', { name: /File: CSR_Table_Trimmed\.docx/i }).first();
    if (await fileButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fileButton.click();
    }

    await expect(
      page.getByRole('button', { name: /Full Preview/i })
        .or(page.getByText(/Preview/i).first())
        .first()
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('checkbox', { name: /Select CSR_Table_Trimmed\.docx/i }).check();
    await page.getByRole('button', { name: /Select \[ENTER\]/i }).click();

    await expect(page.getByRole('button', { name: /CSR_Table_Trimmed\.docx/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Start Training/i })).toBeVisible({ timeout: 20_000 });
  });
});
