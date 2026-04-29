/**
 * global-setup.js — Runs before the entire Playwright test suite
 *
 * WHAT IT DOES:
 *   Cleans up old report files from previous test runs.
 *   Creates fresh reports/ and reports/screenshots/ directories.
 *
 * WHY:
 *   - Prevents old step-results.json data from mixing with new run data
 *   - Ensures screenshots from previous runs don't consume disk space
 *   - Gives each test run a clean slate
 *
 * HOW IT'S TRIGGERED:
 *   Referenced in playwright.config.js via: globalSetup: require.resolve('./global-setup')
 *   Playwright calls this function once before any tests run.
 *
 * BASED ON: Inayat's feature/custom_report branch (commit b4c5a7f)
 */

const fs = require('fs');

module.exports = async (config) => {
  const REPORT_DIR = 'reports';

  // Remove the entire reports directory and all its contents
  if (fs.existsSync(REPORT_DIR)) {
    fs.rmSync(REPORT_DIR, { recursive: true, force: true });
    console.log('-----> Cleaned up old reports directory.');
  }

  // Create fresh directories for this run
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR + '/screenshots', { recursive: true });
  console.log('-----> Created fresh reports directory.');
};
