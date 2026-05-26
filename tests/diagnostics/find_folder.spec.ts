import { test } from '@playwright/test';
import { openAgileMapping } from '../helpers/app-navigation';

test('Find Ideaya Template Folder', async ({ page }) => {
  await openAgileMapping(page);
  await page.getByRole('button', { name: /Select destination template/i }).click();
  await page.waitForTimeout(5000);
  
  const texts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .map(b => b.textContent?.trim() || '')
      .filter(t => t.includes('Expand'));
  });
  console.log('Available Expand buttons:', texts);
});
