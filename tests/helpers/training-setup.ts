// tests/helpers/training-setup.ts
import { Page } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://app-v2-rc1-aw.smarter.codes';

/**
 * Shared training setup helper used by AW_13 through AW_19.
 *
 * Pipeline:
 * 1. Navigate to BASE_URL
 * 2. SSO auth via Microsoft (cookie-based — completes instantly if session is valid)
 * 3. Open AgileMapping
 * 4. Fill output filename
 * 5. Select destination template  → CSR_Table_Trimmed.docx  (SharePoint > CSR folder)
 * 6. Select source documents      → Protocol Example (28Sep2023)_trimmed.docx
 * 7. Click Start Training
 * 8. Wait for workspace ready:
 *    a. URL transitions to /train?id=...
 *    b. "Connecting to SharePoint" loading message visible
 *    c. "Generating interactive document preview" visible
 *    d. "Create Final Doc" button visible           (primary workspace ready signal)
 *    e. "Apply All [Alt+Y]" button visible          (secondary workspace ready signal)
 *    f. First placeholder button visible            (confirms placeholders rendered)
 *
 * Timeouts:
 *   - Auth redirect:            60 seconds
 *   - URL transition to /train: 60 seconds
 *   - Loading workspace:        30 seconds
 *   - Doc preview generation:   60 seconds
 *   - Create Final Doc button: 120 seconds
 *   - Apply All button:       1_800_000ms (30 minutes) — training pipeline hard ceiling
 *   - Placeholder visible:      120 seconds (after Apply All appears)
 */
export async function runTrainingSetup(page: Page): Promise<void> {
  // ── 1. Navigate ──────────────────────────────────────────────────────────
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');

  // ── 2. Auth ──────────────────────────────────────────────────────────────
  // Cookie-based SSO — if user.json storageState is loaded, this resolves
  // instantly without showing a popup. If session expired, it triggers SSO flow.
  await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();

  await page.waitForURL(
    (url: URL) =>
      url.href.startsWith(BASE_URL) && !url.href.includes('/signin'),
    { timeout: 60_000 }
  );
  await page.waitForLoadState('domcontentloaded');

  // ── 3. Open AgileMapping ──────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Open AgileMapping' }).click();

  // ── 4. Fill output filename ───────────────────────────────────────────────
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill(
    'AW_test_' + Date.now()
  );

  // ── 5. Select destination template ───────────────────────────────────────
  // Source: test-1.spec.ts lines 13–20 (recorder)
  await page.getByRole('button', { name: 'Select destination template [' }).click();

  // Wait for search box to appear inside the template picker
  await page.waitForSelector(
    'input[aria-label="Search files"], [role="textbox"][aria-label="Search files"]',
    { state: 'visible', timeout: 30_000 }
  );

  await page.getByRole('textbox', { name: 'Search files' }).fill('CSR_Table_Trimmed.docx');
  await page.getByRole('button', { name: 'Expand CSR' }).click();
  await page.getByRole('checkbox', { name: 'Select CSR_Table_Trimmed.docx' }).check();
  await page.getByRole('button', { name: 'Select [ENTER]' }).click();

  // ── 6. Select source documents ────────────────────────────────────────────
  // Source: test-1.spec.ts lines 22–30 (recorder)
  await page.getByRole('button', { name: 'Select source documents [Alt+' }).click();

  // Wait for search box to appear inside the source picker
  await page.waitForSelector(
    'input[aria-label="Search files"], [role="textbox"][aria-label="Search files"]',
    { state: 'visible', timeout: 30_000 }
  );

  await page.getByRole('textbox', { name: 'Search files' }).fill(
    'Protocol Example (28Sep2023)_trimmed.docx'
  );
  await page.getByRole('button', { name: 'Expand Protocol' }).click();
  await page.getByRole('checkbox', { name: 'Select Protocol Example (' }).check();
  await page.getByRole('button', { name: 'Done [ENTER]' }).click();

  // ── 7. Start Training ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Start Training [Alt+G]' }).click();
  console.log('[training-setup] Start Training clicked, waiting for /train URL...');

  // ── 8a. URL transition ────────────────────────────────────────────────────
  await page.waitForURL(/.*\/train\?id=.*/, { timeout: 60_000 });
  console.log('[training-setup] /train URL confirmed:', page.url());

  // ── 8b. Connecting to SharePoint loading message ──────────────────────────
  await page
    .getByText(/Connecting to SharePoint/i)
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {
      // Not always visible if loading is very fast — safe to skip
      console.log('[training-setup] "Connecting to SharePoint" not seen — likely loaded fast');
    });

  // ── 8c. Generating interactive document preview ───────────────────────────
  await page
    .getByText(/Generating interactive document preview/i)
    .waitFor({ state: 'visible', timeout: 60_000 })
    .catch(() => {
      console.log('[training-setup] "Generating interactive document preview" not seen — likely loaded fast');
    });
  console.log('[training-setup] Document preview generation stage visible');

  // ── 8d. Create Final Doc button ───────────────────────────────────────────
  // Primary signal that the workspace UI has fully mounted
  await page
    .getByRole('button', { name: /Create\s*Final\s*Doc/i })
    .waitFor({ state: 'visible', timeout: 120_000 });
  console.log('[training-setup] "Create Final Doc" button visible — workspace mounted');

  // ── 8e. Apply All button ──────────────────────────────────────────────────
  // Secondary signal — appears only after the training AI pipeline finishes.
  // Hard ceiling: 30 minutes. Training is typically 5–10 min on this environment.
  await page
    .getByRole('button', { name: 'Apply All [Alt+Y]' })
    .waitFor({ state: 'visible', timeout: 1_800_000 });
  console.log('[training-setup] "Apply All" button visible — AI training pipeline complete');

  // ── 8f. First placeholder button ─────────────────────────────────────────
  // Confirms placeholder buttons have rendered in the template preview panel.
  // These are the buttons tests click to open Mapping Controls.
  await page
    .getByRole('button', { name: /Sponsor.*Name/ })
    .first()
    .waitFor({ state: 'visible', timeout: 120_000 });
  console.log('[training-setup] Placeholder buttons visible — setup complete ✅');
}