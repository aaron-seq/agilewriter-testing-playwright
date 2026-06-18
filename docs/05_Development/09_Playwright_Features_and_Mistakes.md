# 09. Playwright Features and Mistakes

### Common Playwright Mistakes

**Mistake:** Forgot `--no-deps`
* **Result:** Login flow runs unnecessarily for a simple math test.
* **Fix:** Use `--no-deps` for helper and component tests (`npx playwright test my-helper.spec.ts --no-deps`).

**Mistake:** Using stale `user.json`
* **Result:** Random Microsoft login failures or timeouts.
* **Fix:** Delete `playwright/.auth/user.json` to force a fresh login.

**Mistake:** Hardcoding Wait Times
* **Result:** Flaky tests (`await page.waitForTimeout(5000)`).
* **Fix:** Wait for states, not time (`await expect(button).toBeVisible()`).

### Playwright Cheat Sheet

Keep it simple. These are the most common functions we use:

* **`page.goto()`**
  Open a page.
* **`page.fill()`**
  Type text into a field.
* **`page.click()`**
  Click a button.
* **`page.waitForEvent('download')`**
  Wait for a file download.
* **`test.beforeEach()`**
  Run setup before every test.
* **`test.beforeAll()`**
  Run setup once for the whole suite.

### Advanced Features

* **Authentication Storage State**
  We use `playwright/.auth/user.json` to store your login session so you don't login before every single test.
* **`expect.poll()`**
  Useful for backend polling when you don't know exactly when an asynchronous job will finish.
* **`evaluateAll()`**
  Lets you run standard JavaScript inside the browser to extract complex data (like table rows) in one swoop.
