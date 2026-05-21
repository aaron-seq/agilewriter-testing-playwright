import { test } from '@playwright/test';
import { openAgileMapping } from './helpers/app-navigation';

test('Diagnose PDF Rendering Bug (AA-177)', async ({ page }) => {
  // Listen for console errors from the page
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  // Listen for iframe / network errors
  page.on('response', response => {
    const url = response.url();
    // Intercept PDF or generic document requests
    if (url.includes('.pdf') || url.includes('/document/') || response.headers()['content-type']?.includes('pdf')) {
      console.log(`[Network Response] URL: ${url}`);
      console.log(`[Network Response] Status: ${response.status()}`);
      console.log(`[Network Response] Content-Type: ${response.headers()['content-type']}`);
      console.log(`[Network Response] Content-Security-Policy: ${response.headers()['content-security-policy'] || 'NONE'}`);
      console.log(`[Network Response] X-Frame-Options: ${response.headers()['x-frame-options'] || 'NONE'}`);
    }
  });

  // Flow to reach the PDF viewer
  // Since we don't know the exact PDF to click, we will just navigate to the picker and stop.
  // The actual diagnostic run should be performed by someone manually running this test
  // while pointing to a known PDF document in the system.
  
  await openAgileMapping(page);
  
  console.log('Diagnostic script ready. Proceed to open the PDF to capture headers.');
  
  // Wait indefinitely or a long time to allow manual diagnostic clicking
  await page.waitForTimeout(60_000);
});
