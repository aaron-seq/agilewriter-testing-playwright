import { test, expect, Locator, Page } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { openDashboard, openAgileMapping, isVisible, clickIfVisible, confirmPickerDialog } from './helpers/app-navigation';
import { initTracker, saveResults, trackStep, trackSoftStep } from './helpers/step-tracker';

const MICROSOFT_SIGN_IN_BUTTON = /Sign In with Microsoft/i;
const MICROSOFT_EMAIL_INPUT = /someone@synterex\.com|email|phone|skype|sign in/i;
const MICROSOFT_PASSWORD_INPUT = /enter the password|password/i;
const UI_TIMEOUT = 60_000;
const DASHBOARD_TIMEOUT = 120_000;
const BASE_URL = runtimeConfig.baseUrl;
const FOLDER_NAME = runtimeConfig.folder || 'QA Testing';
const SOURCE_PROVIDER_BUTTON = /Select source provider|Source:\s*Sharepoint/i;
const QA_TEMPLATE_NAME = 'ICF_SET0_TRIMMED.docx';
const QA_SOURCE_NAME = 'Protocol Example (28Sep2023)_trimmed.docx';
const TEMPLATE_FILE_CANDIDATES = [
  ...(runtimeConfig.template ? [runtimeConfig.template] : []),
  QA_TEMPLATE_NAME, 'CSR_Table_Trimmed.docx', 'output.docx',
];
const SOURCE_FILE_CANDIDATES = [
  ...(runtimeConfig.source ? [runtimeConfig.source] : []),
  QA_SOURCE_NAME,
  'Protocol Example (28Sep2023).docx',
  'Clinical Study Protocol_V4.docx',
  'ICF_SET0_TRIMMED.docx',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Credentials are supplied by runtimeConfig, which reads from runtime-config.json (UI)
// or falls back to .env automatically — no manual env var extraction needed.

function microsoftEmailField(page: Page): Locator {
  return page
    .getByRole('textbox', { name: MICROSOFT_EMAIL_INPUT })
    .or(page.locator('input[name="loginfmt"]'))
    .or(page.locator('input[type="email"]'))
    .or(page.locator('input[type="text"]'))
    .first();
}

function microsoftPasswordField(page: Page): Locator {
  return page
    .getByRole('textbox', { name: MICROSOFT_PASSWORD_INPUT })
    .or(page.locator('input[name="passwd"]'))
    .or(page.locator('input[type="password"]'))
    .first();
}



async function loginWithMicrosoft(page: Page): Promise<void> {
  const msEmail = runtimeConfig.email;
  const msPassword = runtimeConfig.password;

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');

  await expect(microsoftEmailField(popup)).toBeVisible({ timeout: DASHBOARD_TIMEOUT });
  await microsoftEmailField(popup).fill(msEmail);
  await popup.getByRole('button', { name: 'Next' }).click();

  await expect(microsoftPasswordField(popup)).toBeVisible({ timeout: DASHBOARD_TIMEOUT });
  await microsoftPasswordField(popup).fill(msPassword);
  await popup.getByRole('button', { name: 'Sign in' }).click();

  const staySignedInCheckbox = popup.locator('input[type="checkbox"]').first();
  if (await isVisible(staySignedInCheckbox, 5_000)) {
    await staySignedInCheckbox.uncheck().catch(() => undefined);
  }

  const yesButton = popup.getByRole('button', { name: 'Yes' });
  if (await isVisible(yesButton, 10_000)) {
    await yesButton.click();
  }

  await page.waitForURL(`${BASE_URL}/**`, { timeout: DASHBOARD_TIMEOUT });
  await page.waitForLoadState('domcontentloaded');
}

async function returnHome(page: Page): Promise<void> {
  const homeLink = page.getByRole('link', { name: /Go to home/i });
  if (await isVisible(homeLink, 10_000)) {
    await homeLink.click();
  } else {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  }

  await expect(
    page.getByRole('button', { name: /Open AgileMapping/i })
      .or(page.getByRole('tab', { name: /Services/i }))
      .first()
  ).toBeVisible({ timeout: DASHBOARD_TIMEOUT });
}

/**
 * Runs a dashboard-scoped block and always lands back on the dashboard.
 *
 * trackSoftStep() promises "if this fails, the NEXT step can still run". That
 * only holds if the page is usable afterwards. A drawer helper that throws
 * half-way leaves its drawer open on top of the dashboard, so the next click
 * — on a tab the drawer is covering — times out, turning one soft failure into
 * a hard one several lines later.
 *
 * Only for blocks that start and end on the dashboard. Do NOT use it around
 * steps inside the training workspace: returning home there abandons a
 * 20–45 minute training run.
 */
async function withDashboardReset(page: Page, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } finally {
    // Best-effort: never let cleanup replace the real failure message.
    await returnHome(page).catch(() => undefined);
  }
}

async function switchProviderIfAvailable(page: Page, optionName: RegExp): Promise<boolean> {
  const providerButton = page.getByRole('button', { name: SOURCE_PROVIDER_BUTTON });
  if (!(await isVisible(providerButton, 5_000))) {
    return false;
  }

  await providerButton.click();
  const option = page.getByRole('option', { name: optionName }).first();
  if (!(await isVisible(option, 3_000))) {
    await page.keyboard.press('Escape').catch(() => undefined);
    return false;
  }

  await option.click();
  await expect(providerButton).toBeVisible({ timeout: UI_TIMEOUT });
  return true;
}

async function goToQaTestingFolder(page: Page): Promise<void> {
  const searchBox = page.getByRole('textbox', { name: /Search files/i });
  await expect(searchBox).toBeVisible({ timeout: UI_TIMEOUT });
  await searchBox.fill(FOLDER_NAME);

  await expect(
    page.getByRole('button', { name: new RegExp(`^Folder:\\s*${escapeRegExp(FOLDER_NAME)}`, 'i') })
  ).toBeVisible({ timeout: UI_TIMEOUT });

  const expandFolder = page.getByRole('button', { name: new RegExp(`Expand ${FOLDER_NAME}`, 'i') });
  const collapseFolder = page.getByRole('button', { name: new RegExp(`Collapse ${FOLDER_NAME}`, 'i') });
  if (!(await isVisible(collapseFolder, 2_000))) {
    await expect(expandFolder).toBeVisible({ timeout: UI_TIMEOUT });
    await expandFolder.click();
  }
  await expect(collapseFolder).toBeVisible({ timeout: UI_TIMEOUT });
}

async function searchFileInPicker(page: Page, fileName: string): Promise<void> {
  const searchBox = page.getByRole('textbox', { name: /Search files/i });
  await expect(searchBox).toBeVisible({ timeout: UI_TIMEOUT });
  await searchBox.fill(fileName);
}

async function resolvePickerFile(
  page: Page,
  candidates: string[]
): Promise<{ checkbox: Locator; fileName: string }> {
  const searchBox = page.getByRole('textbox', { name: /Search files/i });
  await expect(searchBox).toBeVisible({ timeout: UI_TIMEOUT });

  for (const candidate of candidates) {
    await searchBox.fill(candidate);
    const folderButton = page.getByRole('button', {
      name: new RegExp(`^Folder:\\s*${escapeRegExp(FOLDER_NAME)}`, 'i'),
    });
    if (!(await isVisible(folderButton, 10_000))) {
      continue;
    }
    await goToQaTestingFolder(page);

    const folderItem = page
      .getByRole('treeitem', { name: new RegExp(`Folder:\\s*${escapeRegExp(FOLDER_NAME)}`, 'i') })
      .first();
    const checkbox = folderItem
      .getByRole('checkbox', { name: new RegExp(`Select .*${escapeRegExp(candidate)}`, 'i') })
      .first();

    if (await isVisible(checkbox, 5_000)) {
      const ariaLabel = (await checkbox.getAttribute('aria-label')) || `Select ${candidate}`;
      return {
        checkbox,
        fileName: ariaLabel.replace(/^Select\s+/i, '').trim(),
      };
    }
  }

  await searchBox.fill('');
  await goToQaTestingFolder(page);

  const folderItem = page
    .getByRole('treeitem', { name: new RegExp(`Folder:\\s*${escapeRegExp(FOLDER_NAME)}`, 'i') })
    .first();
  const checkboxes = await folderItem.getByRole('checkbox').all();
  for (const checkbox of checkboxes) {
    const ariaLabel = (await checkbox.getAttribute('aria-label')) || '';
    if (!ariaLabel || /Select All|QA Testing/i.test(ariaLabel)) {
      continue;
    }

    return {
      checkbox,
      fileName: ariaLabel.replace(/^Select\s+/i, '').trim(),
    };
  }

  throw new Error(`No selectable files were found for candidates: ${candidates.join(', ')}`);
}

async function previewSelectedFileIfAvailable(page: Page, fileName: string): Promise<void> {
  const fileButton = page
    .getByRole('button', { name: new RegExp(`File: .*${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') })
    .first()
    .or(page.getByRole('button', { name: new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first())
    .first();

  if (!(await isVisible(fileButton, 5_000))) {
    return;
  }

  await fileButton.click();
  const loader = page.getByText(/Loading preview/i);
  if (await isVisible(loader, 3_000)) {
    await expect(loader).toBeHidden({ timeout: UI_TIMEOUT });
  }

  await expect(
    page.locator('.docx-preview-wrapper')
      .or(page.locator('.docx-preview__canvas'))
      .or(page.getByText(/Preview/i).first())
      .first()
  ).toBeVisible({ timeout: UI_TIMEOUT });
}

async function openDestinationTemplatePicker(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select destination template/i }).click();
  await expect(
    page.getByRole('heading', { name: /Select Destination Template/i })
      .or(page.getByRole('dialog', { name: /Select Destination Template/i }))
      .first()
  ).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByRole('button', { name: SOURCE_PROVIDER_BUTTON })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
}

async function selectQaTestingTemplate(page: Page, confirmSelection: boolean): Promise<string> {
  await openDestinationTemplatePicker(page);
  let fileName = QA_TEMPLATE_NAME;

  try {
    const resolved = await resolvePickerFile(page, TEMPLATE_FILE_CANDIDATES);
    fileName = resolved.fileName;
    await previewSelectedFileIfAvailable(page, fileName);
    await resolved.checkbox.check();
  } catch {
    await searchFileInPicker(page, FOLDER_NAME);
    await goToQaTestingFolder(page);
    const resolved = await resolvePickerFile(page, TEMPLATE_FILE_CANDIDATES);
    fileName = resolved.fileName;
    await previewSelectedFileIfAvailable(page, fileName);
    await resolved.checkbox.check();
  }

  await expect(
    page.getByRole('button', { name: /Full Preview/i })
      .or(page.getByText(/Preview/i).first())
      .or(page.locator('.docx-preview__canvas'))
      .first()
  ).toBeVisible({ timeout: UI_TIMEOUT });

  await page.getByRole('button', { name: /Full Preview/i }).click();
  await expect(page.getByLabel(/Full Preview/i)).toBeVisible({ timeout: UI_TIMEOUT });
  await page.getByRole('button', { name: /Close modal/i }).click();

  if (confirmSelection) {
    await confirmPickerDialog(
      page,
      /Select \[ENTER\]/i,
      page.getByRole('dialog', { name: /Select Destination Template/i })
        .or(page.getByRole('dialog', { name: /Select Source/i }))
    );
  }

  return fileName;
}

async function openSourcePicker(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Select source documents/i }).click();
  await expect(
    page.getByRole('heading', { name: /Select Source Documents/i })
      .or(page.getByRole('dialog', { name: /Select Source Documents/i }))
      .first()
  ).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByRole('button', { name: SOURCE_PROVIDER_BUTTON })).toBeVisible({
    timeout: UI_TIMEOUT,
  });

  const loadingIndicator = page.getByText(/Loading\.\.\.|Loading content/i).first();
  if (await isVisible(loadingIndicator, 3_000)) {
    await expect(loadingIndicator).toBeHidden({ timeout: UI_TIMEOUT });
  }
}

async function selectQaTestingSource(page: Page, confirmSelection: boolean): Promise<string> {
  await openSourcePicker(page);
  let fileName = QA_SOURCE_NAME;

  try {
    const resolved = await resolvePickerFile(page, SOURCE_FILE_CANDIDATES);
    fileName = resolved.fileName;
    await previewSelectedFileIfAvailable(page, fileName);
    await resolved.checkbox.check();
  } catch {
    await searchFileInPicker(page, FOLDER_NAME);
    await goToQaTestingFolder(page);
    const resolved = await resolvePickerFile(page, SOURCE_FILE_CANDIDATES);
    fileName = resolved.fileName;
    await previewSelectedFileIfAvailable(page, fileName);
    await resolved.checkbox.check();
  }

  await expect(
    page.locator('.docx-preview-wrapper')
      .or(page.locator('.docx-preview__canvas'))
      .or(page.getByText(/Preview/i).first())
      .first()
  ).toBeVisible({ timeout: UI_TIMEOUT });

  if (confirmSelection) {
    await confirmPickerDialog(
      page,
      /Done \[ENTER\]/i,
      page.getByRole('dialog', { name: /Select Destination Template/i })
        .or(page.getByRole('dialog', { name: /Select Source/i }))
    );
  }

  return fileName;
}

async function openUploadDrawerAndClose(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Upload/i }).click();
  await expect(page.getByRole('button', { name: /Browse Files/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await page.getByRole('button', { name: /Close Upload Files drawer/i }).click();
}

async function openSystemGuidanceDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Configure system guidance/i }).click();
  await expect(page.getByRole('textbox', { name: /System Prompt/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByRole('button', { name: /Reset to Default/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await page.getByRole('button', { name: /^Cancel$/i }).click();
}

async function openActivitiesAndFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Open activities/i }).click();
  await expect(page.getByRole('heading', { name: /Activities/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByText(/Stay up to date with recent/i)).toBeVisible({ timeout: UI_TIMEOUT });

  if (await isVisible(page.getByRole('button', { name: /Load more/i }).first(), 3_000)) {
    await page.getByRole('button', { name: /Load more/i }).first().click();
  }

  for (const filterName of [/ongoing/i, /completed/i, /all/i]) {
    const filterButton = page.getByRole('button', { name: filterName }).first();
    if (await isVisible(filterButton, 3_000)) {
      await filterButton.click();
    }
  }

  await page.getByRole('button', { name: /Close Activities drawer/i }).click();
}

async function openSettingsAndAdminConsole(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Open menu/i }).click();
  await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByRole('switch', { name: /Dark mode/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(page.getByRole('switch', { name: /High contrast/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });

  await page.getByRole('button', { name: /Open admin console/i }).click();
  await expect(page.getByRole('heading', { name: /Organization Users/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });

  for (const section of [
    { button: /Branding/i, heading: /Branding/i },
    { button: /Configuration/i, heading: /Configuration/i },
    { button: /Usage/i, heading: /Usage/i },
    { button: /About/i, heading: /About/i },
  ]) {
    await page.getByRole('button', { name: section.button }).click();
    await expect(page.getByRole('heading', { name: section.heading })).toBeVisible({
      timeout: UI_TIMEOUT,
    });
  }

  await returnHome(page);
}

async function openClientsAndProjectsDrawers(page: Page): Promise<void> {
  await page.getByRole('tab', { name: /Clients/i }).click();
  await expect(page.getByRole('button', { name: /Add Client/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await page.getByRole('button', { name: /Add Client/i }).click();
  await expect(page.getByRole('heading', { name: /Add New Client/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await page.getByRole('button', { name: /Close Add New Client drawer/i }).click();

  await page.getByRole('tab', { name: /Projects/i }).click();
  await expect(page.getByRole('heading', { name: /Regulatory Project Management/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });
  await expect(
    page.getByRole('button', { name: /Add Project/i })
      .or(page.getByRole('button', { name: /Add Your First Project/i }))
      .first()
  ).toBeVisible({ timeout: UI_TIMEOUT });

  const addProjectButton = page
    .getByRole('button', { name: /Add Project/i })
    .or(page.getByRole('button', { name: /Add Your First Project/i }))
    .first();
  await addProjectButton.click();
  await expect(page.getByRole('heading', { name: /Add New Project Timeline/i })).toBeVisible({
    timeout: UI_TIMEOUT,
  });

  await clickIfVisible(page.getByRole('button', { name: /^Cancel$/i }), 3_000);
  await clickIfVisible(page.getByRole('button', { name: /Close Add New Project/i }), 3_000);
}

async function visitServiceAndReturn(
  page: Page,
  serviceButton: RegExp,
  expectedHeading: RegExp
): Promise<void> {
  await returnHome(page);
  // Reset afterwards too: if the service page never renders its heading, the
  // half-loaded service view would otherwise block the next service check.
  await withDashboardReset(page, async () => {
    await page.getByRole('button', { name: serviceButton }).click();
    await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible({
      timeout: DASHBOARD_TIMEOUT,
    });
  });
}

test.describe('Agile Writer E2E Flow (AW_00 to AW_10)', () => {
  test.describe.configure({ mode: 'serial', retries: 2, timeout: DASHBOARD_TIMEOUT * 4 });
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.beforeAll(() => {
    initTracker();
  });

  test.afterAll(() => {
    saveResults();
  });

  test.describe('AW_01-AW_02 Authentication', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('AW_01-AW_02: Login & Authentication', async ({ page }) => {
      await trackStep(page, 'AW_01-AW_02: Login & Authentication',
        'Navigate to sign-in page', 'Sign-in page is displayed', async () => {
          await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded' });
          await expect(page).toHaveURL(new RegExp(`${BASE_URL}/signin`));
          await expect(page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON })).toBeVisible({
            timeout: UI_TIMEOUT,
          });
        });

      await trackStep(page, 'AW_01-AW_02: Login & Authentication',
        'Complete Microsoft SSO login', 'User is authenticated and dashboard loads', async () => {
          await loginWithMicrosoft(page);
          await openDashboard(page);
          await expect(
            page.getByRole('heading', { name: /Services/i })
              .or(page.getByRole('button', { name: /Open AgileMapping/i }))
              .first()
          ).toBeVisible({ timeout: DASHBOARD_TIMEOUT });

          await page.context().storageState({
            path: 'playwright/.auth/user.json'
          });
        });
    });
  });

  test('AW_03: Client Selection & Integration', async ({ page }) => {
    await trackSoftStep(page, 'AW_03: Client Selection & Integration',
      'Open client selection dialog', 'Client selection dialog is displayed', async () => {
        await openDashboard(page);
        await page.getByRole('button', { name: /^ORG$/i }).click();
        await expect(page.getByRole('dialog', { name: /Select Client/i })).toBeVisible({
          timeout: UI_TIMEOUT,
        });
      });

    await trackSoftStep(page, 'AW_03: Client Selection & Integration',
      'Verify Organization Default', 'Organization Default button is visible', async () => {
        await expect(page.getByRole('button', { name: /Organization Default Use/i })).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await page.getByRole('button', { name: /Close Select Client/i }).click();
      });

    await trackSoftStep(page, 'AW_03: Client Selection & Integration',
      'Open Activities, Settings, Clients drawers', 'All dashboard drawers open and close', async () => {
        await withDashboardReset(page, async () => {
          await openActivitiesAndFilters(page);
          await openSettingsAndAdminConsole(page);
          await openClientsAndProjectsDrawers(page);
        });
      });

    await page.getByRole('tab', { name: /Services/i }).click();
    await expect(page.getByRole('button', { name: /Open AgileMapping/i })).toBeVisible({
      timeout: UI_TIMEOUT,
    });
  });

  test('AW_04: Agile Mapping Access', async ({ page }) => {
    await openDashboard(page);
    await page.getByRole('tab', { name: /Services/i }).click();

    // These are non-critical: other services should work but don't block us
    await trackSoftStep(page, 'AW_04: Agile Mapping Access',
      'Verify Redaction service', 'Redaction service opens correctly', async () => {
        await visitServiceAndReturn(page, /Open Redaction/i, /Redact Document/i);
      });

    await trackSoftStep(page, 'AW_04: Agile Mapping Access',
      'Verify Publishing service', 'Publishing service opens correctly', async () => {
        await visitServiceAndReturn(page, /Open Publishing/i, /Document Publishing/i);
      });

    await trackSoftStep(page, 'AW_04: Agile Mapping Access',
      'Verify RFP service', 'RFP service opens correctly', async () => {
        await visitServiceAndReturn(page, /Open Request For Proposal/i, /Request For Proposal/i);
      });

    // This is CRITICAL: AgileMapping must work
    await trackStep(page, 'AW_04: Agile Mapping Access',
      'Open AgileMapping module', 'Train Document screen is displayed', async () => {
        await returnHome(page);
        await page.getByRole('button', { name: /Open AgileMapping/i }).click();
        await expect(page.getByRole('heading', { name: /Train Document/i })).toBeVisible({
          timeout: UI_TIMEOUT,
        });
      });

    await trackSoftStep(page, 'AW_04: Agile Mapping Access',
      'Verify upload instructions text', 'Upload & select input files text visible', async () => {
        await expect(page.getByText(/Upload & select input files/i)).toBeVisible({
          timeout: UI_TIMEOUT,
        });
      });
  });

  test('AW_05: File Name Validation', async ({ page }) => {
    await openAgileMapping(page);

    const fileNameInput = page.getByRole('textbox', { name: /Enter desired output filename/i });
    const startTrainingButton = page.getByRole('button', { name: /Start Training/i });
    const errorMessage = page.getByText(
      /Please enter a name that doesn.t include any of these characters/i
    );

    // Soft: validation message is nice to check but not blocking
    await trackSoftStep(page, 'AW_05: File Name Validation',
      'Enter invalid file name', 'System shows error and disables Start Training', async () => {
        await fileNameInput.fill('Invalid*File?Name');
        await expect(errorMessage).toBeVisible({ timeout: UI_TIMEOUT });
        await expect(startTrainingButton).toBeDisabled();
      });

    // Critical: must accept valid filenames to proceed
    await trackStep(page, 'AW_05: File Name Validation',
      'Enter valid file name', 'System accepts valid name and enables Start Training', async () => {
        await fileNameInput.fill('Valid_File_Name_01');
        await expect(errorMessage).not.toBeVisible();
        await expect(startTrainingButton).toBeVisible({ timeout: UI_TIMEOUT });
      });

    await fileNameInput.fill(`AW00_10_${Date.now()}`);
    await expect(fileNameInput).toHaveValue(/AW00_10_/);
  });

  test('AW_06: Destination template picker opens', async ({ page }) => {
    await openAgileMapping(page);
    await openDestinationTemplatePicker(page);
    const expectedProvider = process.env.HEALTH_TEMPLATE_PROVIDER || 'Sharepoint';

    // Soft: Veeva is a nice-to-have check
    await trackSoftStep(page, 'AW_06: Destination Template Picker',
      'Check Veeva provider', 'Veeva provider tab is accessible', async () => {
        await switchProviderIfAvailable(page, /Veeva/i);
        await page.getByRole('button', { name: /^Close$/i }).click();
      });

    // Critical: SharePoint template picker must work
    await trackStep(page, 'AW_06: Destination Template Picker',
      'Verify SharePoint template picker', 'Search box and file tree are visible', async () => {
        await openDestinationTemplatePicker(page);

        // Fix 1 — Provider guard: the soft step above may have left Veeva selected.
        const providerButton = page.getByRole('button', { name: SOURCE_PROVIDER_BUTTON });
        const providerText = await providerButton.innerText();
        if (!new RegExp(expectedProvider, 'i').test(providerText)) {
          await switchProviderIfAvailable(page, new RegExp(expectedProvider, 'i'));
        }

        // Fix 2 — Wait for either the file tree to load or the error state to appear.
        // This prevents a race condition after provider switch and replaces the opaque
        // 60-second timeout with an immediate, actionable failure message.
        const fileTree = page.getByRole('checkbox').first()
          .or(page.getByRole('tree').first())
          .first();
        const loadError = page.getByText('Failed to load files');

        await Promise.race([
          fileTree.waitFor({ state: 'visible', timeout: UI_TIMEOUT }),
          loadError.waitFor({ state: 'visible', timeout: UI_TIMEOUT }),
        ]);

        if (await loadError.isVisible()) {
          throw new Error(
            '[AW_06] File listing API returned "Failed to load files". ' +
            `Provider: ${await providerButton.innerText()}. ` +
            'The template picker dialog opened correctly but the file provider API ' +
            'did not return a file tree. Check the provider connector on staging ' +
            'before re-running.'
          );
        }

        await expect(page.getByRole('textbox', { name: /Search files/i })).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await expect(
          page.getByRole('checkbox').first()
            .or(page.getByRole('tree').first())
            .first()
        ).toBeVisible({ timeout: UI_TIMEOUT });
      });
  });

  test('AW_07: Selecting a destination template returns to Train Document', async ({ page }) => {
    await openAgileMapping(page);

    await trackStep(page, 'AW_07: Template Selection',
      'Select template and verify', 'Selected template name appears on Train Document screen', async () => {
        const selectedTemplateName = await selectQaTestingTemplate(page, true);
        await expect(
          page.getByRole('button', { name: new RegExp(escapeRegExp(selectedTemplateName), 'i') })
            .or(page.getByText(new RegExp(escapeRegExp(selectedTemplateName), 'i')))
            .first()
        ).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await expect(page.getByRole('button', { name: /Start Training/i })).toBeVisible({
          timeout: UI_TIMEOUT,
        });
      });
  });

  test('AW_08: Source selection dialog opens', async ({ page }) => {
    await openAgileMapping(page);

    // Critical: Source picker must open with Clinical tab
    await trackStep(page, 'AW_08: Source Selection Dialog',
      'Verify source picker Clinical tab', 'Clinical tab is visible', async () => {
        await openSourcePicker(page);
        await expect(page.getByRole('tab', { name: /^Clinical$/i })).toBeVisible({ timeout: UI_TIMEOUT });
      });

    // Soft: Non-Clinical tab, Veeva, Upload drawer are nice-to-have
    await trackSoftStep(page, 'AW_08: Source Selection Dialog',
      'Verify Non-Clinical tab', 'Non-Clinical tab is visible', async () => {
        await expect(page.getByRole('tab', { name: /^Non-Clinical$/i })).toBeVisible({
          timeout: UI_TIMEOUT,
        });
      });

    await trackSoftStep(page, 'AW_08: Source Selection Dialog',
      'Check Veeva provider in sources', 'Veeva provider is accessible in source picker', async () => {
        await switchProviderIfAvailable(page, /Veeva/i);
        await switchProviderIfAvailable(page, /Sharepoint default/i);
      });

    await trackSoftStep(page, 'AW_08: Source Selection Dialog',
      'Check Upload drawer', 'Upload drawer opens and closes', async () => {
        await openUploadDrawerAndClose(page);
      });
  });

  test('AW_09: Selecting a source document returns to Train Document', async ({ page }) => {
    await openAgileMapping(page);

    await trackStep(page, 'AW_09: Source Selection',
      'Select source and verify', 'Selected source document name is visible', async () => {
        const selectedSourceName = await selectQaTestingSource(page, true);
        await expect(
          page.getByRole('button', { name: new RegExp(escapeRegExp(selectedSourceName), 'i') })
            .or(page.getByText(new RegExp(escapeRegExp(selectedSourceName), 'i')))
            .first()
        ).toBeVisible({ timeout: UI_TIMEOUT });
      });
  });

  test('AW_10: Full Preview opens for the selected source document', async ({ page }) => {
    await openAgileMapping(page);
    await selectQaTestingSource(page, false);

    // Soft: Preview is nice-to-have, not blocking
    await trackSoftStep(page, 'AW_10: Full Preview',
      'Open and verify full preview', 'Full preview modal opens and closes correctly', async () => {
        await page.getByRole('button', { name: /Full Preview/i }).click();
        await expect(page.getByLabel(/Full Preview/i)).toBeVisible({ timeout: UI_TIMEOUT });
        await page.getByRole('button', { name: /Close modal/i }).click();
      });

    await page.getByRole('button', { name: /Done \[ENTER\]/i }).click();

    // Soft: System guidance is an optional feature check
    await trackSoftStep(page, 'AW_10: System Guidance',
      'Verify system guidance available', 'Configure system guidance button is visible', async () => {
        await expect(page.getByRole('button', { name: /Configure system guidance/i })).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await openSystemGuidanceDialog(page);
      });
  });
});
