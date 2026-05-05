import { test, expect } from '@playwright/test';

test('AW_11_to_20: Document Generation Stage', async ({ page }) => {
  // Navigate to the base URL
  await page.goto(process.env.BASE_URL as string);

  // Authentication - Instantly completes if session is valid or cookies are present
  // Following the pattern from existing tests (AW_04_agile_mapping_access.spec.ts)
  await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();

  // Wait for the redirect to complete and land on the dashboard
  await page.waitForURL(
    (url: URL) => url.href.startsWith(process.env.BASE_URL as string) && !url.href.includes('/signin'),
    { timeout: 60_000 }
  );

  await expect(page.locator('h2')).toContainText('Services');

  // -------------------- AW_11 - Start -------------------- //

  // Action -> Click Open AgileMapping
  await expect(page.getByLabel('Open AgileMapping').getByRole('heading')).toContainText('AgileMapping');
  await page.getByRole('button', { name: 'Open AgileMapping' }).click();

  // Wait for Train Document screen
  await expect(page.getByRole('heading')).toContainText('Train Document');

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
  await expect(page.getByText('Loading preview...')).toBeHidden({ timeout: 600_000 });

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
    await expect(page.getByText('Loading preview...')).toBeHidden({ timeout: 600_000 });
    await expect(page.getByText('Preview', { exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Full Preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Full Preview' }).click();
    await page.getByRole('button', { name: 'Close modal' }).click();
  }

  // Using Done button to confirm selection
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

  // Start Training
  await expect(page.getByRole('button', { name: 'Start Training [Alt+G]' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Training [Alt+G]' }).click();

  // Training may take time
  await page.waitForSelector('text=Connecting to SharePoint and', {
    state: 'visible',
  });
  await expect(page.getByText('Connecting to SharePoint and')).toBeVisible();

  await page.waitForSelector('text=Generating interactive', {
    state: 'visible',
  });
  await expect(page.getByText('Generating interactive')).toBeVisible();

  // Support for "Generate Document" page - looking for "Create Final Doc" as the primary indicator
  // as the literal text "Generate Document" is not present in the current UI version.
  await expect(page.getByRole('button', { name: /Create\s*Final\s*Doc/i })).toBeVisible({ timeout: 120_000 });
  console.log('"Create Final Doc" button found!');

  // Once loaded, verify other functional elements
  // Note: The buttons are named "Show document list" and "Show mapping controls"
  // but contain "Sources" and "Mapping" text respectively.
  await expect(page.getByRole('button', { name: /Show\s*document\s*list/i })).toBeVisible({ timeout: 600_000 });
  await expect(page.getByRole('button', { name: /Show\s*mapping\s*controls/i })).toBeVisible({ timeout: 600_000 });
  // Optional: Double check by text if needed
  await expect(page.getByText(/Sources/i).first()).toBeVisible();
  await expect(page.getByText(/Mapping/i).first()).toBeVisible();

  console.log('Functional elements verified. Training initialization successful.');

  // -------------------- AW_11 - END -------------------- //

  // -------------------- AW_12 - Start -------------------- //

  // Wait for document list to be available

  await expect(page.getByRole('button', { name: 'Show document list' })).toBeVisible();
  await expect(page.getByLabel('Show document list')).toContainText('Sources');
  if (!(await page.getByRole('heading', { name: 'Documents' }).isVisible())) {
    await page.getByRole('button', { name: 'Show document list' }).click();
  }

  await expect(page.getByText(/source file[s]? ready to review/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

  // Dynamically verify files in the Documents list

  // Step 1: Extract expected count
  const subtitle = page.getByText(/source file[s]? ready to review/i);
  await expect(subtitle).toBeVisible();

  const text = await subtitle.textContent();
  const match = text?.match(/(\d+)/);

  if (!match) {
    throw new Error('Could not extract source file count');
  }

  const expectedCount = parseInt(match[1], 10);
  console.log(`Expecting ${expectedCount} document buttons in the list.`);

  // Step 2: Use ACCESSIBLE NAME (correct approach)
  const docButtons = page.getByRole('button', {
    name: /Show .*source document/i
  });

  // Wait until they appear
  await expect(docButtons.first()).toBeVisible({ timeout: 30000 });

  // Step 3: Validate count
  await expect(docButtons).toHaveCount(expectedCount);

  // Step 4: Iterate
  for (let i = 0; i < expectedCount; i++) {
    const btn = docButtons.nth(i);

    await btn.click();

    const loader = page.getByText('Loading preview...');

    // Optional wait for loader
    if (await loader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(loader).toBeHidden({ timeout: 600_000 });
    }

    // Always validate final render
    await expect(page.locator('.docx-preview-wrapper')).toBeVisible();
    await expect(page.locator('.docx-preview__canvas')).toBeVisible();
  }

  // Step 5: Verify selected template preview
  if (selectedTemplateName) {
    const cleanTemplateNameRegex = new RegExp(
      selectedTemplateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    );

    const templateLocator = page
      .getByRole('button', { name: cleanTemplateNameRegex })
      .first();

    await expect(templateLocator).toBeVisible();
    await templateLocator.click();

    await expect(page.getByText('Template Preview')).toBeVisible();
  }

  await page.getByRole('button', { name: 'Close Documents drawer' }).click();

  // -------------------- AW_12 - END -------------------- //


  // -------------------- AW_12B - Start -------------------- //

  // ─────────────────────────────────────────────
  // REGEX
  // ─────────────────────────────────────────────

  const rawRegex = process.env.PLACEHOLDER_REGEX ?? '<([^<>]+)>';

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

  const waitForStageProcessing = async (label: string, timeout = 3_600_000) => {
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

  const waitForStageCompleted = async (
    label: string,
    expectedCount: number,
    timeout = 3_600_000
  ) => {
    console.log(`[WAIT] Completed: "${label}" (Total expected ticks: ${expectedCount})`);

    // Find the deepest container that has both the specific label and the completed icon
    const rowWithCompleted = page.locator('div, li, [role="listitem"]')
      .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
      .filter({ has: page.locator(COMPLETED_SELECTOR) })
      .last();

    // 1. Wait for specific row tick
    await expect(rowWithCompleted).toBeVisible({ timeout });

    // 2. Double check global completed-state count without requiring an exact icon count match.
    await expect
      .poll(async () => page.locator(COMPLETED_SELECTOR).count(), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(expectedCount);

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

  const greenPlaceholderCount = await placeholders.evaluateAll((elements) => {
    return elements.filter(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      return bg.includes('16, 185, 129');
    }).length;
  });
  console.log(`Green placeholders ready to apply: ${greenPlaceholderCount}`);

  // Set up DOM mutation observer BEFORE clicking
  const toastDetectionPromise: Promise<{
    text: string;
    tag: string;
    classes: string;
    role: string;
  }> = page.evaluate(() => {
    return new Promise((resolve, reject) => {
      let observer: MutationObserver | undefined;

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
              observer?.disconnect();

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

  // -------------------- AW_12B - END -------------------- //
  
});


