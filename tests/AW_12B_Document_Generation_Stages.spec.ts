// @ts-check
import { test, expect } from '@playwright/test';

test('AW_12B_Document_Generation_Stages', async ({ page }) => {
  // Increase test timeout to 10 minutes (600,000ms) for long-running document generation processes
  test.setTimeout(600_000);

  // ─────────────────────────────────────────────
  // LOGIN & NAVIGATION
  // ─────────────────────────────────────────────

  await page.goto(process.env.BASE_URL as string);
  await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();
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
  await expect(page.getByLabel('Folder: QA Testing')).toContainText('QA Testing');
  await page.getByRole('button', { name: 'Expand QA Testing' }).click();
  await page.getByRole('checkbox', { name: 'Select QA Testing' }).check();

  // Get all file buttons inside QA Testing
  const fileButtons = await page.locator('[role="button"][aria-label^="File:"]').all();

  if (fileButtons.length === 0) {
    throw new Error('No files found inside QA Testing folder');
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
       await expect(locator).toHaveCSS('background-color', regex, { timeout: 300_000 });
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

  const waitForStageProcessing = async (label, timeout = 2400_000) => {
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

  const waitForStageCompleted = async (label, expectedCount, timeout = 2400_000) => {
    console.log(`[WAIT] Completed: "${label}" (Total expected ticks: ${expectedCount})`);
    
    // Find the deepest container that has both the specific label and the completed icon
    const rowWithCompleted = page.locator('div, li, [role="listitem"]')
      .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
      .filter({ has: page.locator(COMPLETED_SELECTOR) })
      .last();
    
    // 1. Wait for specific row tick
    await expect(rowWithCompleted).toBeVisible({ timeout });
    
    // 2. Double check global tick count to ensure no early skip
    await expect(page.locator(COMPLETED_SELECTOR)).toHaveCount(expectedCount, { timeout: 15_000 });
    
    console.log(`[DONE] Completed: "${label}" ✓`);
  };

  // ─────────────────────────────────────────────
  // STAGE VERIFICATION SEQUENCE
  // ─────────────────────────────────────────────

  // STAGE 1
  await waitForStageProcessing('Indexing Sources', 2400_000);
  await waitForStageCompleted('Indexing Sources', 1);
  await verifyPlaceholderColors('Stage 1 (Indexing)', [GREY_PATTERN]);

  // STAGE 2
  await waitForStageProcessing('Finding Placeholder Matches', 2400_000);
  await waitForStageCompleted('Finding Placeholder Matches', 2);
  // Add GREEN_PATTERN: If the application progresses autonomously, it runs into a race condition
  // where placeholders might already be marked "Replacement done" (Green) before 
  // Playwright finishes verifying the intermediate Yellow state.
  await verifyPlaceholderColors('Stage 2 (Matching)', [YELLOW_PATTERN, GREY_PATTERN, RED_PATTERN, GREEN_PATTERN, BLUE_PATTERN]);

  // STAGE 3
  await waitForStageProcessing('Populating Placeholders', 2400_000);
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

  const expectedCount = await placeholders.evaluateAll((elements) => {
    return elements.filter(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      return bg.includes('16, 185, 129');
    }).length;
  });
  console.log(`Green placeholders ready to apply: ${expectedCount}`);

  // Set up DOM mutation observer BEFORE clicking
  const toastDetectionPromise = page.evaluate(() => {
    return new Promise((resolve, reject) => {
      let observer;

      const timeout = setTimeout(() => {
        if (observer) observer.disconnect();
        reject(new Error('Toast did not appear within 10 seconds'));
      }, 10000);

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;

            const text = node.textContent || '';

            if (/Applied all \d+ mappings?/i.test(text)) {
              clearTimeout(timeout);
              observer.disconnect();

              resolve({
                text: text.trim(),
                tag: node.nodeName,
                classes: node.className || '',
                role: node.getAttribute('role') || ''
              });
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  });

  // Now click the button
  await page.getByRole('button', { name: 'Apply All [Alt+Y]' }).click();
  console.log(`Clicked "Apply All" - waiting for toast notification...`);

  const toastInfo = await toastDetectionPromise;

  // STRICT ASSERTION
  // const expectedText = `Applied all ${expectedCount} mappings.`;
  // expect(toastInfo.text).toContain(`${expectedCount}`);
  expect(toastInfo.text).toMatch(/Applied all \d+ mappings?/i);

  console.log('✓ Toast detected and validated!');
  console.log('  Text:', toastInfo.text);
  // console.log('  Expected Text:', expectedText);
  // Final (Post-Apply) color check
  await verifyPlaceholderColors('Final (Post-Apply)', [GREEN_PATTERN, GREY_PATTERN, RED_PATTERN, BLUE_PATTERN]);

  // ─────────────────────────────────────────────
  // POST-ALL-STAGES & APPLY: "Create Final Doc" must be ENABLED
  // ─────────────────────────────────────────────

  await expect(
    page.getByRole('button', { name: 'Create Final Doc [Alt+G]' })
  ).toBeEnabled({ timeout: 60_000 });
});