import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  // Recording...
  await page.goto('https://app-v2-rc1-aw.smarter.codes/signin');
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Microsoft Logo Sign In with' }).click();
  const page1 = await page1Promise;
  await page.goto('https://app-v2-rc1-aw.smarter.codes/');
  await page.getByRole('button', { name: 'Open AgileMapping' }).click();
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).click();
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).click();
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill('" * : < > ? / \\ |');
  await expect(page.getByRole('alert')).toContainText('Please enter a name that doesn\'t include any of these characters: " * : < > ? / \\ |.');
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).click();
  await page.getByRole('textbox', { name: 'Enter desired output filename' }).fill('sample_naming_case');
  await expect(page.getByRole('button', { name: 'Start Training [Alt+G]' })).toBeVisible();
});