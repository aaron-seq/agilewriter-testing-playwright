// playwright.config.js
const { defineConfig } = require('@playwright/test');
require('dotenv').config();

// Everything that must NOT be pulled into the authenticated E2E project.
// Kept as one constant so a new category is added in exactly one place.
const NON_E2E = /(health_.*\.spec\.ts|diagnostics[\\/]|infrastructure[\\/]|__tests__[\\/]|integration[\\/]|api[\\/]|accuracy\.spec\.ts)/;

module.exports = defineConfig({
  globalSetup: require.resolve('./global-setup'),
  reporter: 'html',
  timeout: 600_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL,
    headless: process.env.CI ? true : false,
    actionTimeout: 30_000,
    navigationTimeout: 120_000,
  },
  projects: [
    // Logs in once and writes playwright/.auth/user.json for the E2E project.
    { name: 'setup', testMatch: /AW_00_10_consolidated_flow\.spec\.ts/ },

    // Health suites recover their own session via openDashboard(), so they must
    // NOT depend on 'setup' — a failure there used to silently skip them all.
    {
      name: 'health',
      testMatch: /health_.*\.spec\.ts/,
      use: { storageState: 'playwright/.auth/user.json' },
    },

    // No browser, no auth, no credentials — safe to run anywhere.
    { name: 'unit', testMatch: /__tests__[\\/].*\.spec\.ts/ },
    { name: 'infrastructure', testDir: 'tests/infrastructure' },
    // HTTP against the web runner. Starts its own server on port 3399.
    { name: 'api', testDir: 'tests/api' },
    { name: 'standalone', testMatch: /(accuracy\.spec\.ts|integration[\\/])/ },

    // One-off debugging tools, no assertions. Excluded from normal runs:
    //   npx playwright test --project=diagnostics --headed
    {
      name: 'diagnostics',
      testDir: 'tests/diagnostics',
      use: { storageState: 'playwright/.auth/user.json' },
    },

    // Authenticated browser E2E (AW_11_to_20*, components, style_trainer).
    {
      name: 'smarter-tests',
      dependencies: ['setup'],
      testIgnore: NON_E2E,
      use: { storageState: 'playwright/.auth/user.json' },
    },
  ],
});
