/**
 * global-setup.js — Runs before the entire Playwright test suite
 *
 * WHAT IT DOES:
 *   Cleans up stale step-results.json from the previous run so old data
 *   never leaks into the new report.
 *
 * SESSION MODE (SESSION_ID env var is set):
 *   The session directory (sessions/<SESSION_ID>/) is created by the server
 *   before Playwright starts and contains runtime-config.json which must be
 *   preserved. Only step-results.json is deleted so the tracker starts fresh.
 *
 * LEGACY MODE (no SESSION_ID):
 *   The entire reports/ directory is wiped and recreated as before.
 *
 * HOW IT'S TRIGGERED:
 *   Referenced in playwright.config.js via: globalSetup: require.resolve('./global-setup')
 *   Playwright calls this function once before any tests run.
 *
 * BASED ON: Inayat's feature/custom_report branch (commit b4c5a7f)
 */

const fs = require('fs');
const path = require('path');

module.exports = async (config) => {
  const SESSION_ID = process.env.SESSION_ID || null;

  if (SESSION_ID) {
    // ── Session mode ────────────────────────────────────────────────────────
    // The session directory already exists (created by test-runner-server.js).
    // Only remove step-results.json — runtime-config.json must stay intact.
    const sessionDir = path.join(__dirname, 'sessions', SESSION_ID);
    const stepFile = path.join(sessionDir, 'step-results.json');

    if (fs.existsSync(stepFile)) {
      fs.rmSync(stepFile);
      console.log(`-----> Cleared stale step-results.json for session ${SESSION_ID}.`);
    }

    // Ensure a screenshots sub-directory exists inside the session folder
    const screenshotDir = path.join(sessionDir, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    console.log(`-----> Session ${SESSION_ID} ready for fresh run.`);
  } else {
    // ── Legacy mode ─────────────────────────────────────────────────────────
    // No session — wipe and recreate the reports/ directory as before.
    const REPORT_DIR = 'reports';

    if (fs.existsSync(REPORT_DIR)) {
      fs.rmSync(REPORT_DIR, { recursive: true, force: true });
      console.log('-----> Cleaned up old reports directory.');
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.mkdirSync(REPORT_DIR + '/screenshots', { recursive: true });
    console.log('-----> Created fresh reports directory.');
  }
};
