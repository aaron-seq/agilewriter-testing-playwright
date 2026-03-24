// playwright.config.js
const { defineConfig } = require('@playwright/test');
require('dotenv').config();

module.exports = defineConfig({
  reporter: 'html',
  timeout: 120000,
  use: {
    baseURL: process.env.BASE_URL,
    headless: false,
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