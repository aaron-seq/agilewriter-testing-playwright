# 08. Local Debugging Guide

When a test fails, you need to know why quickly. Here are your best tools.

### 1. Watch the Browser (`--headed`)
By default, tests run invisibly (headless). To watch Playwright click around:
```bash
npx playwright test tests/AW_00_10_consolidated_flow.spec.ts --headed
```

### 2. Pause the Test (`await page.pause()`)
If you don't know why a test is failing on line 45, insert a pause right before it:
```typescript
await page.goto('/dashboard');
await page.pause(); // The browser will stop here!
await page.getByRole('button', { name: 'Submit' }).click();
```
This opens the Playwright Inspector, allowing you to explore the DOM and try out selectors in real-time.

### 3. View the HTML Report (`show-report`)
If a test fails in CI or locally, Playwright saves an HTML report containing error logs and screenshots.
```bash
npx playwright show-report
```
*Look for the red step. Playwright highlights exactly which line of code failed and usually includes a screenshot of the browser at the moment of failure.*

### 4. Verbose Debugging (`--debug`)
If you want to step through the test line-by-line using the inspector from the very beginning:
```bash
npx playwright test my-test.spec.ts --debug
```
