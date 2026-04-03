import { test, expect, Page } from '@playwright/test';
import dotenv from 'dotenv';
import { openDashboard, openAgileMapping } from './helpers/app-navigation';

dotenv.config();

const MICROSOFT_SIGN_IN_BUTTON = /Sign In with Microsoft/i;
const MICROSOFT_EMAIL_INPUT = /someone@synterex\.com|email, phone, or skype/i;
const MICROSOFT_PASSWORD_INPUT = /enter the password|password/i;
const UI_TIMEOUT = 30_000;
const DASHBOARD_TIMEOUT = 120_000;
const BASE_URL = process.env.BASE_URL || 'https://app-v2-rc1-aw.smarter.codes';

function requiredEnv(name: 'MS_EMAIL' | 'MS_PASSWORD'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Create a local .env file with ${name}=... before running Microsoft SSO tests.`
    );
  }
  return value;
}

async function isVisible(locator: ReturnType<Page['getByRole']>, timeout = 5_000): Promise<boolean> {
  return locator.isVisible({ timeout }).catch(() => false);
}

async function loginWithMicrosoft(page: Page): Promise<void> {
  const msEmail = requiredEnv('MS_EMAIL');
  const msPassword = requiredEnv('MS_PASSWORD');

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON }).click();
  const popup = await popupPromise;

  await popup.getByRole('textbox', { name: MICROSOFT_EMAIL_INPUT }).fill(msEmail);
  await popup.getByRole('button', { name: 'Next' }).click();

  await popup.getByRole('textbox', { name: MICROSOFT_PASSWORD_INPUT }).fill(msPassword);
  await popup.getByRole('button', { name: 'Sign in' }).click();

  await popup.locator('label').click();
  await popup.getByRole('button', { name: 'Yes' }).click();

  await page.waitForURL(`${BASE_URL}/**`, { timeout: DASHBOARD_TIMEOUT });
  await page.waitForLoadState('domcontentloaded');
}

async function openDestinationTemplatePicker(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select destination template/i }).click();
  await expect(page.getByRole('heading', { name: /Select Destination Template/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByRole('textbox', { name: /Search files/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
}

async function searchKnownTemplate(page: Page): Promise<void> {
  await openDestinationTemplatePicker(page);
  await page.getByRole('textbox', { name: /Search files/i }).fill('CSR_Table_Trimmed.docx');
  await page.getByRole('button', { name: /Expand CSR/i }).click();
  await expect(page.getByRole('checkbox', { name: /Select CSR_Table_Trimmed\.docx/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
}

async function openSourcePicker(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select source documents/i }).click();
  await expect(page.getByRole('heading', { name: /Select Source Documents/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByRole('textbox', { name: /Search files/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
}

async function searchKnownSource(page: Page): Promise<void> {
  await openSourcePicker(page);
  await page.getByRole('textbox', { name: /Search files/i }).fill('Protocol Example (28Sep2023)_trimmed.docx');
  await page.getByRole('button', { name: /Expand Protocol/i }).click();
  await expect(page.getByRole('checkbox', { name: /Select Protocol Example/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
}

// AW_00 remains the existing setup dependency through AW_00_auth.setup.ts.
// This file consolidates workbook coverage for AW_01 through AW_10 into one
// reportable flow while leaving the current individual spec files untouched.
test.describe('AW_00-AW_10: Consolidated Foundation Workflow', () => {
  test.describe.configure({ retries: 2, timeout: 300_000 });

  test.describe('AW_01-AW_02 Authentication', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('AW_01-AW_02: Login & Authentication', async ({ page }) => {
      await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(new RegExp(`${BASE_URL}/signin`));
      await expect(page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON })).toBeVisible({
        timeout: UI_TIMEOUT,
      });

      await loginWithMicrosoft(page);

      await expect(page).not.toHaveURL(/\/signin/);
      await expect(
        page.getByRole('heading', { name: /Services/i })
          .or(page.getByRole('button', { name: /Open AgileMapping/i }))
          .first()
      ).toBeVisible({ timeout: DASHBOARD_TIMEOUT });
    });
  });

  test('AW_03: Client Selection & Integration', async ({ page }) => {
    await openDashboard(page);

    await page.getByRole('button', { name: 'ORG' }).click();
    await expect(page.getByRole('dialog', { name: /Select Client/i })).toBeVisible({
      timeout: UI_TIMEOUT,
    });

    const sharepointPagePromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: /Organization Default Use/i }).getByRole('link').click();
    const sharepointPage = await sharepointPagePromise;

    await sharepointPage.waitForLoadState('domcontentloaded');
    await expect(sharepointPage.locator('#DeltaPlaceHolderPageTitleInTitleArea')).toContainText(
      'My Organization'
    );
    await sharepointPage.close();

    await expect(page.locator('tbody')).toContainText('Organization');
    await page.getByRole('button', { name: /Close Select Client/i }).click();
    await expect(page.getByRole('button', { name: 'ORG', exact: true })).toBeVisible({
      timeout: UI_TIMEOUT,
    });
  });

  test('AW_04: Agile Mapping Access', async ({ page }) => {
    await openAgileMapping(page);

    await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible({
      timeout: UI_TIMEOUT,
    });
  });

  test('AW_05: File Name Validation', async ({ page }) => {
    await openAgileMapping(page);

    const fileNameInput = page.getByRole('textbox', { name: /Enter desired output filename/i });
    const startTrainingButton = page.getByRole('button', { name: /Start Training/i });
    const errorMessage = page.getByText(
      /Please enter a name that doesn.t include any of these characters/i
    );

    await fileNameInput.fill('Invalid*File?Name');
    await expect(errorMessage).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(startTrainingButton).toBeDisabled();

    await fileNameInput.fill('Valid_File_Name_01');
    await expect(errorMessage).not.toBeVisible();
    await expect(startTrainingButton).toBeEnabled();

    await fileNameInput.fill('ProjectTestFile');
    await expect(startTrainingButton).toBeEnabled();

    await page.getByRole('button', { name: /Select destination template/i }).click();
    await expect(page.getByRole('dialog', { name: /Select Destination Template/i })).toBeVisible({
      timeout: UI_TIMEOUT,
    });
  });

  test('AW_06: Destination template picker opens', async ({ page }) => {
    await openAgileMapping(page);
    await openDestinationTemplatePicker(page);

    await expect(page.getByRole('button', { name: /Select source provider/i })).toBeVisible({
      timeout: UI_TIMEOUT,
    });
    await expect(page.getByRole('tree').first()).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('AW_07: Selecting a destination template returns to Train Document', async ({ page }) => {
    await openAgileMapping(page);
    await searchKnownTemplate(page);

    const fileButton = page.getByRole('button', { name: /File: CSR_Table_Trimmed\.docx/i }).first();
    if (await isVisible(fileButton)) {
      await fileButton.click();
    }

    await expect(
      page.getByRole('button', { name: /Full Preview/i })
        .or(page.getByText(/Preview/i).first())
        .first()
    ).toBeVisible({ timeout: UI_TIMEOUT });

    await page.getByRole('checkbox', { name: /Select CSR_Table_Trimmed\.docx/i }).check();
    await page.getByRole('button', { name: /Select \[ENTER\]/i }).click();

    await expect(page.getByRole('button', { name: /CSR_Table_Trimmed\.docx/i }).first()).toBeVisible({
      timeout: UI_TIMEOUT,
    });
    await expect(page.getByRole('button', { name: /Start Training/i })).toBeVisible({
      timeout: UI_TIMEOUT,
    });
  });

  test('AW_08: Source selection dialog opens', async ({ page }) => {
    await openAgileMapping(page);
    await openSourcePicker(page);

    await page.getByRole('checkbox', { name: /Select Clinical Study Protocol_V4\.docx/i }).check();
    await page.getByRole('checkbox', { name: /Select ICF_SET0_TRIMMED\.docx/i }).check();

    await expect(page.getByText(/files selected/i)).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByRole('button', { name: /Done \[ENTER\]/i })).toBeEnabled({
      timeout: UI_TIMEOUT,
    });
  });

  test('AW_09: Selecting a source document returns to Train Document', async ({ page }) => {
    await openAgileMapping(page);
    await searchKnownSource(page);

    const fileButton = page
      .getByRole('button', { name: /File: Protocol Example \(28Sep2023\)_trimmed\.docx/i })
      .first();
    if (await isVisible(fileButton)) {
      await fileButton.click();
    }

    await expect(
      page.getByRole('button', { name: /Full Preview/i })
        .or(page.getByText(/Preview/i).first())
        .first()
    ).toBeVisible({ timeout: UI_TIMEOUT });

    await page.getByRole('checkbox', { name: /Select Protocol Example/i }).check();
    await page.getByRole('button', { name: /Done \[ENTER\]/i }).click();

    await expect(
      page.getByRole('button', { name: /Protocol Example \(28Sep2023\)_trimmed\.docx/i }).first()
        .or(page.getByRole('button', { name: /1 files?:/i }).first())
        .first()
    ).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('AW_10: Full Preview opens for the selected source document', async ({ page }) => {
    await openAgileMapping(page);
    await searchKnownSource(page);

    const fileButton = page
      .getByRole('button', { name: /File: Protocol Example \(28Sep2023\)_trimmed\.docx/i })
      .first();
    if (await isVisible(fileButton)) {
      await fileButton.click();
    }

    await page.getByRole('button', { name: /Full Preview/i }).click();

    await expect(page.getByLabel(/Full Preview/i)).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByRole('button', { name: /Close modal/i })).toBeVisible({
      timeout: UI_TIMEOUT,
    });
  });
});
