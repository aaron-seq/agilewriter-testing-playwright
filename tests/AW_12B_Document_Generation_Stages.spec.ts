// @ts-check
import { test, expect } from '@playwright/test';

const MICROSOFT_SIGN_IN_BUTTON = /Sign In with Microsoft/i;

test('AW_12B_Document_Generation_Stages', async ({ page }) => {
  // Increase test timeout to 10 minutes (600,000ms) for long-running document generation processes
  test.setTimeout(600_000);

  // ─────────────────────────────────────────────
  // LOGIN & NAVIGATION
  // ─────────────────────────────────────────────

  await page.goto(process.env.BASE_URL as string);
  const signInButton = page.getByRole('button', { name: MICROSOFT_SIGN_IN_BUTTON });
  if (await signInButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await signInButton.click();
  }
  await page.waitForURL(
    (url: URL) =>
      url.href.startsWith(process.env.BASE_URL as string) &&
      !url.href.includes('/signin'),
    { timeout: 60_000 }
  );

  await expect(page.locator('h2')).toContainText('Services');
  await expect(
    page.getByLabel('Open AgileMapping').getByRole('heading')
  ).toContainText('AgileMapping');

  await page.getByRole('button', { name: 'Open AgileMapping' }).click();
  await expect(page.getByRole('heading')).toContainText('Train Document');

  // ─────────────────────────────────────────────
  // SETUP: Filename, Template, Source
  // ─────────────────────────────────────────────

  page.once('dialog', d => d.dismiss());
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill('AW_12_09_test');
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).press('Enter');

  await page.getByRole('button', { name: 'Select destination template [' }).click();
  await page.getByRole('textbox', { name: 'Search files' }).fill('CSR_Table_Trimmed.docx');
  await page.getByRole('button', { name: 'Expand CSR' }).click();
  await page.getByRole('checkbox', { name: 'Select CSR_Table_Trimmed.docx' }).check();
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();
  await page.getByRole('textbox', { name: 'Search files' }).fill('Protocol Example (28Sep2023)_trimmed.docx');
  await page.getByRole('button', { name: 'Expand Protocol' }).click();
  await page.getByRole('checkbox', { name: 'Select Protocol Example (' }).check();
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

  await page.getByRole('button', { name: 'Start Training [Alt+G]' }).click();
  await expect(page.getByText('Connecting to SharePoint and')).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Show document list' })
  ).toBeVisible({ timeout: 120_000 });

  // ─────────────────────────────────────────────
  // REGEX
  // ─────────────────────────────────────────────

  const rawRegex = process.env.PLACEHOLDER_REGEX ?? '';
  if (!rawRegex) throw new Error('PLACEHOLDER_REGEX not set in .env');

  const cleanedPattern = rawRegex
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\/|\/[gimsuy]*$/g, '')
    .replace(/;$/, '');

  const placeholderRegex = new RegExp(cleanedPattern);
  console.log('Compiled regex:', placeholderRegex);

  // ─────────────────────────────────────────────
  // WAIT FOR WORKSPACE & PLACEHOLDERS
  // ─────────────────────────────────────────────

  await expect(
    page.getByRole('button', { name: 'Show mapping controls' })
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Create Final Doc [Alt+G]' })
  ).toBeDisabled({ timeout: 60_000 });

  const placeholders = page.locator('.doc-placeholder');

  await expect.poll(
    async () => {
      const c = await placeholders.count();
      console.log(`Waiting for .doc-placeholder … found ${c}`);
      return c;
    },
    { timeout: 120_000, intervals: [2_000, 3_000, 5_000, 5_000] }
  ).toBeGreaterThan(0);

  const count = await placeholders.count();
  expect(count).toBeGreaterThan(0);
  console.log('Total placeholder count:', count);

  // ─────────────────────────────────────────────
  // BUILD PLACEHOLDER LIST
  // ─────────────────────────────────────────────

  const placeholderButtons: {
    element: ReturnType<typeof placeholders.nth>;
    text: string;
    extracted: string;
  }[] = [];

  for (let i = 0; i < count; i++) {
    const el = placeholders.nth(i);
    const raw =
      (await el.getAttribute('data-placeholder-text')) ??
      (await el.getAttribute('data-placeholder')) ?? '';
    const decoded = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const match = decoded.match(placeholderRegex);
    if (match) {
      placeholderButtons.push({ element: el, text: decoded, extracted: match[1].trim() });
    }
  }

  console.log('Matched count:', placeholderButtons.length);

  // ─────────────────────────────────────────────
  // COLOR VERIFICATION HELPERS
  // ─────────────────────────────────────────────

  // Raw RGB/A values corresponding to the CSS color tokens
  const GREY_PATTERN = '156, 163, 175, 0.2';
  const YELLOW_PATTERN = '246, 234, 59, 0.18';
  const BLUE_PATTERN = '59, 130, 246, 0.18';
  const GREEN_PATTERN = '16, 185, 129, 0.2';
  const RED_PATTERN = '239, 68, 68'; // Standard tailwind --color-red-500

  /**
   * Builds an exact regex matching computed CSS rgba() or rgb() strings,
   * cleanly allowing variable browser spacing.
   */
  const buildColorRegex = (patterns: string[]) => {
    const escaped = patterns.map((p: string) => p.replace(/,\s*/g, '\\s*,\\s*').replace(/\./g, '\\.'));
    return new RegExp(`rgba?\\(\\s*(?:${escaped.join('|')})\\s*\\)`);
  };

  /**
   * Iterate over every loaded placeholder and verify its computed `.doc-placeholder`
   * background color matches one of the expected CSS arrays for this stage.
   */
  const verifyPlaceholderColors = async (stageName: string, expectedPatterns: string[]) => {
    console.log(`[VERIFY] Checking ${stageName} placeholder colors...`);
    const regex = buildColorRegex(expectedPatterns);
    
    // We expect the elements to be graphically visible/boxed
    const count = await placeholders.count();
    for (let i = 0; i < count; i++) {
       const locator = placeholders.nth(i);
       // Check that it's visibly rendered as a box
       await expect(locator).toBeVisible();
       // Assert it has achieved the exact mandated background color
       await expect(locator).toHaveCSS('background-color', regex, { timeout: 15_000 });
    }
    console.log(`[DONE] ${stageName} color verification passed ✓`);
  };

  // ─────────────────────────────────────────────
  // STAGE HELPERS
  // ─────────────────────────────────────────────

  const ALL_STAGES = [
    'Indexing Sources',
    'Finding Placeholder Matches',
    'Populating Placeholders'
  ];

  const COMPLETED_SELECTOR = '[aria-label="Completed"], img[alt="Completed"], [title="Completed"]';
  const PROCESSING_SELECTOR = '[aria-label="Processing"], img[alt="Processing"], [title="Processing"]';

  const waitForStageProcessing = async (label, timeout = 120_000) => {
    console.log(`[WAIT] Processing: "${label}"`);
    
    // Find the deepest container that has both the specific label and the processing icon
    const rowWithProcessing = page.locator('div, li, [role="listitem"]')
      .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
      .filter({ has: page.locator(PROCESSING_SELECTOR) })
      .last();

    // It's possible the stage completed fast and skipped "Processing" entirely
    const rowWithCompleted = page.locator('div, li, [role="listitem"]')
      .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
      .filter({ has: page.locator(COMPLETED_SELECTOR) })
      .last();

    await expect(rowWithProcessing.or(rowWithCompleted)).toBeVisible({ timeout });
    console.log(`[DONE] Processing (or Completed): "${label}" ✓`);
  };

const waitForStageCompleted = async (label, expectedCount, timeout = 1200_000) => {
    console.log(`[WAIT] Completed: "${label}" (Total expected ticks: ${expectedCount})`);
    
    // Find the deepest container that has both the specific label and the completed icon
    const rowWithCompleted = page.locator('div, li, [role="listitem"]')
      .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
      .filter({ has: page.locator(COMPLETED_SELECTOR) })
      .last();
    
    // 1. Wait for specific row tick
    await expect(rowWithCompleted).toBeVisible({ timeout});
    
    // 2. Double check global tick count to ensure no early skip
    await expect(page.locator(COMPLETED_SELECTOR)).toHaveCount(expectedCount, { timeout});
    
    console.log(`[DONE] Completed: "${label}" ✓`);
  };

  // ─────────────────────────────────────────────
  // STAGE VERIFICATION SEQUENCE
  // ─────────────────────────────────────────────

  // STAGE 1
  await waitForStageProcessing('Indexing Sources', 1200_000);
  await waitForStageCompleted('Indexing Sources', 1);
  await verifyPlaceholderColors('Stage 1 (Indexing)', [GREY_PATTERN]);

  // STAGE 2
  await waitForStageProcessing('Finding Placeholder Matches', 1200_000);
  await waitForStageCompleted('Finding Placeholder Matches', 2);
  // Add GREEN_PATTERN: If the application progresses autonomously, it runs into a race condition
  // where placeholders might already be marked "Replacement done" (Green) before 
  // Playwright finishes verifying the intermediate Yellow state.
  await verifyPlaceholderColors('Stage 2 (Matching)', [YELLOW_PATTERN, GREY_PATTERN, RED_PATTERN, GREEN_PATTERN]);

  // STAGE 3
  await waitForStageProcessing('Populating Placeholders', 1200_000);
  await waitForStageCompleted('Populating Placeholders', 3);
   await verifyPlaceholderColors('Stage 3 (Populating)', [YELLOW_PATTERN, GREY_PATTERN, RED_PATTERN, GREEN_PATTERN, BLUE_PATTERN]);

  // ─────────────────────────────────────────────
  // FINAL GATE: No spinners remaining
  // ─────────────────────────────────────────────

  console.log('FINAL GATE: Ensuring no processing icons remain...');
  await expect(page.locator(PROCESSING_SELECTOR)).not.toBeVisible({ timeout: 15_000 });
  await expect(page.locator(COMPLETED_SELECTOR)).toHaveCount(3);

  // ─────────────────────────────────────────────
  // APPLY ALL
  // ─────────────────────────────────────────────

  // The expected count is the number of placeholders that turned green after stage 3
  const expectedCount = await placeholders.evaluateAll((elements) => {
    return elements.filter(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      // Match the RGB part of GREEN_PATTERN: '16, 185, 129'
      return bg.includes('16, 185, 129');
    }).length;
  });
  console.log(`Green placeholders ready to apply: ${expectedCount}`);

  const toastText = `Applied all ${expectedCount} mappings.`;
  // const toastLocator = page.getByText(toastText, { exact: false });

  // CRITICAL FIX: You MUST start listening for the popup BEFORE you click the button!
  // const toastPromise = toastLocator.waitFor({ state: 'attached', timeout: 60_000 });
  await page.getByRole('button', { name: 'Apply All [Alt+Y]' }).click();
  await expect(page.getByText(`${toastText}`)).toBeVisible();
  // await expect(page.getByText("Applied all 2 mappings.")).toBeVisible();
  // await toastPromise;
  // await expect(toastLocator).toBeVisible();
  
  // Final (Post-Apply) color check
  await verifyPlaceholderColors('Final (Post-Apply)', [GREEN_PATTERN, GREY_PATTERN, RED_PATTERN, BLUE_PATTERN]);

  // ─────────────────────────────────────────────
  // POST-ALL-STAGES & APPLY: "Create Final Doc" must be ENABLED
  // ─────────────────────────────────────────────

  await expect(
    page.getByRole('button', { name: 'Create Final Doc [Alt+G]' })
  ).toBeEnabled({ timeout: 60_000 });
});
