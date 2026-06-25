// playwright.config.js
const { defineConfig } = require('@playwright/test');
require('dotenv').config();

module.exports = defineConfig({
  globalSetup: require.resolve('./global-setup'),
  reporter: 'html',
  timeout: 600_000,
  expect: {
    timeout: 30_000,
  },
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL,
    headless: process.env.CI ? true : false,
    actionTimeout: 30_000,
    navigationTimeout: 120_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /AW_00_10_consolidated_flow\.spec\.ts/,
    },
    // Health scripts run independently — they handle their own auth recovery
    // via openDashboard() → recoverDashboardSession() in app-navigation.ts.
    //
    // ROOT CAUSE FIX (2026-05-22):
    // Prior to this project block, health_*.spec.ts files were matched by
    // 'smarter-tests', which declares dependencies: ['setup']. This forced
    // Playwright to run the full AW_00_10_consolidated_flow.spec.ts suite
    // (9 serial tests) before every health script, adding 10–20 minutes of
    // mandatory overhead. If any AW_00-10 test failed after retries,
    // Playwright silently skipped ALL health scripts via its dependency
    // mechanism — causing them to appear broken with no actionable error.
    //
    // Confirmed via: npx playwright test tests/health_CSR.spec.ts --list
    // Before fix: 10 tests listed (9 setup + 1 health)
    // After fix:   1 test listed (health only)
    {
      name: 'health',
      testMatch: /health_.*\.spec\.ts/,
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
    // Diagnostic / investigative scripts — one-off debugging tools with no
    // assertions. Excluded from normal runs and the UI dropdown. Run explicitly:
    //   npx playwright test --project=diagnostics --headed
    //   npx playwright test tests/diagnostics/diagnose_pdf.spec.ts --headed
    {
      name: 'diagnostics',
      testDir: 'tests/diagnostics',
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
    // SCC-556: Infrastructure tests — shell/bash scripts, no browser, no auth.
    //   npx playwright test tests/infrastructure/deploy.spec.ts
    {
      name: 'infrastructure',
      testDir: 'tests/infrastructure',
    },
    // SCC-556: Unit / helper tests — file I/O, xlsx, string functions, no browser.
    //   npx playwright test tests/helpers/__tests__/accuracyScorer.spec.ts
    {
      name: 'unit',
      testDir: 'tests/helpers/__tests__',
    },
    // SCC-556: Standalone tests — on-demand scoring and Docker integration,
    // no browser, no auth. Run explicitly by file path.
    //   npx playwright test tests/accuracy.spec.ts
    //   npx playwright test tests/integration/develop.integration.spec.ts
    {
      name: 'standalone',
      testMatch: /(accuracy\.spec\.ts|integration\/)/,
    },
    // E2E tests that require authenticated browser sessions (AW_11_to_20*).
    // All other test categories are carved out via testIgnore and routed to
    // their own dependency-free projects above.
    //
    // SCC-556: Expanded testIgnore to prevent AW_00_10 from running when
    // non-E2E tests are targeted. Follows the SCC-174 health isolation pattern.
    {
      name: 'smarter-tests',
      dependencies: ['setup'],
      testIgnore: /(health_.*\.spec\.ts|diagnostics\/|infrastructure\/|helpers\/__tests__\/|integration\/|accuracy\.spec\.ts)/,
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
});
