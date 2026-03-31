import { test, expect, Page } from '@playwright/test';
import { openAgileMapping } from './helpers/app-navigation';

test.describe('AW_08-AW_10: Source Selection & Preview', () => {
  test.describe.configure({ retries: 2, timeout: 240_000 });

  test.beforeEach(async ({ page }) => {
    await openAgileMapping(page);
  });

  async function openSourcePicker(page: Page) {
    await page.getByRole('button', { name: /Select source documents/i }).click();
    await expect(page.getByRole('heading', { name: /Select Source Documents/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('textbox', { name: /Search files/i })).toBeVisible({ timeout: 30_000 });
  }

  async function searchKnownSource(page: Page) {
    await openSourcePicker(page);
    await page.getByRole('textbox', { name: /Search files/i }).fill('Protocol Example (28Sep2023)_trimmed.docx');
    await page.getByRole('button', { name: /Expand Protocol/i }).click();
    await expect(page.getByRole('checkbox', { name: /Select Protocol Example/i })).toBeVisible({
      timeout: 30_000,
    });
  }

  test('AW_08: Source selection dialog opens and supports multi-select in the current Sharepoint view', async ({ page }) => {
    await openSourcePicker(page);

    await page.getByRole('checkbox', { name: /Select Clinical Study Protocol_V4\.docx/i }).check();
    await page.getByRole('checkbox', { name: /Select ICF_SET0_TRIMMED\.docx/i }).check();

    await expect(page.getByText(/files selected/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Done \[ENTER\]/i })).toBeEnabled({ timeout: 15_000 });
  });

  test('AW_09: Selecting a source document returns to Train Document with the chosen file visible', async ({ page }) => {
    await searchKnownSource(page);

    const fileButton = page.getByRole('button', { name: /File: Protocol Example \(28Sep2023\)_trimmed\.docx/i }).first();
    if (await fileButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fileButton.click();
    }

    await expect(
      page.getByRole('button', { name: /Full Preview/i })
        .or(page.getByText(/Preview/i).first())
        .first()
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('checkbox', { name: /Select Protocol Example/i }).check();
    await page.getByRole('button', { name: /Done \[ENTER\]/i }).click();

    await expect(
      page.getByRole('button', { name: /Protocol Example \(28Sep2023\)_trimmed\.docx/i }).first()
        .or(page.getByRole('button', { name: /1 files?:/i }).first())
        .first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('AW_10: Full Preview opens for the selected source document', async ({ page }) => {
    await searchKnownSource(page);

    const fileButton = page.getByRole('button', { name: /File: Protocol Example \(28Sep2023\)_trimmed\.docx/i }).first();
    if (await fileButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fileButton.click();
    }

    await page.getByRole('button', { name: /Full Preview/i }).click();

    await expect(page.getByLabel(/Full Preview/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Close modal/i })).toBeVisible({ timeout: 30_000 });
  });
});
