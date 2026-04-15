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
    headless: false,
    actionTimeout: 30_000,
    navigationTimeout: 120_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /AW_00_auth\.setup\.ts/,
    },
    {
      name: 'smarter-tests',
      dependencies: ['setup'],
      use: {
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
});
