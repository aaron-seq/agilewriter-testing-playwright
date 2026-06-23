import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000/admin-console');
});

test('status toggle button is clickable', async ({ page }) => {
  const toggleButton = page.getByRole('button', {
    name: /set user paras\.r@smarter\./i,
  });

  await expect(toggleButton).toBeVisible();
  await expect(toggleButton).toBeEnabled();
});

test('clicking status toggle changes user status', async ({ page }) => {
  const toggleButton = page.getByRole('button', {
    name: /set user paras\.r@smarter\./i,
  });

  const currentState = await toggleButton.textContent();

  await toggleButton.click();

  if (currentState?.includes('Active')) {
    await expect(toggleButton).toContainText('Inactive');
  } else {
    await expect(toggleButton).toContainText('Active');
  }
});