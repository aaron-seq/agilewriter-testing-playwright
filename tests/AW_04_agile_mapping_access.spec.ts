import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { openAgileMapping } from './helpers/app-navigation';
dotenv.config();

// test.use({ video: 'on' }); // Options: 'on', 'retain-on-failure', or 'on-first-retry'

test('AW_04: Agile Mapping Access', async ({ page }) => {
  await openAgileMapping(page);

  // Verify -> Train Document page is displayed
  // Checking for a heading that says "Train Document". Alternatively, we could check the URL.
  await expect(page.getByRole('heading', { name: /Train\s*Document/i })).toBeVisible();

  // Optional: Also assert that the URL contains the expected path (update '/train-document' if it's different)
  // await expect(page).toHaveURL(/.*train-document/);
});
