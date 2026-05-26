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
    {
      name: 'smarter-tests',
      dependencies: ['setup'],
      testIgnore: /health_.*\.spec\.ts/,
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
});
