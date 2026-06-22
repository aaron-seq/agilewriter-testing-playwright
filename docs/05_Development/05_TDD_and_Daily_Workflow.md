# 05. TDD and Daily Workflow

### Typical Daily Workflow

**Morning**
1. `git pull`
2. `./develop.sh up`
3. Verify `/api/env-status`
4. Run a targeted test to ensure your baseline works

**During Development**
1. Write a failing test
2. Make the test pass
3. Refactor the code
4. Run the affected suite locally

**Before PR**
1. Run all relevant tests (`npx playwright test`)
2. Check the HTML report
3. Update documentation if anything changed
4. Attach evidence (screenshots/logs) to your PR

### TDD: The `validateHealthEnv` Example

Test-Driven Development (TDD) means writing the test *before* the code. 

**The Problem:** A developer forgets to add `HEALTH_TEMPLATE_IDEAYA` to their `.env` file.

**Without `validateHealthEnv()` (The Bad Way):**
1. Developer runs `health_Ideaya.spec.ts`.
2. Playwright boots up Chrome.
3. Playwright logs into Microsoft (takes 10 seconds).
4. Playwright navigates the UI, clicks menus, opens Agile Mapping (takes 45 seconds).
5. The test tries to search for `undefined` in the template picker.
6. **The test fails 2 minutes later with a confusing error:** `Cannot read properties of undefined`.

**With `validateHealthEnv()` (The TDD Way):**
1. Developer runs `health_Ideaya.spec.ts`.
2. **Test fails in less than 0.1 seconds.**
3. Developer immediately sees: `Error: Missing HEALTH_TEMPLATE_IDEAYA`.

### How We Built It Using TDD

1. **RED:** We wrote the test first. We passed an empty object to the function and asserted it threw an error. The test failed because the function was empty.
   ```typescript
   // Location: tests/helpers/__tests__/validateHealthEnv.spec.ts
   test('throws with var name when Ideaya var is missing', () => {
     delete process.env.HEALTH_TEMPLATE_IDEAYA;
     expect(() => validateHealthEnv('ideaya')).toThrow('HEALTH_TEMPLATE_IDEAYA');
   });
   ```

2. **GREEN:** We wrote the simplest code to make the test pass.
   ```typescript
   // Location: utils/validateHealthEnv.ts
   export function validateHealthEnv(client) {
     if (!process.env.HEALTH_TEMPLATE_IDEAYA) {
       throw new Error('Missing HEALTH_TEMPLATE_IDEAYA');
     }
   }
   ```

3. **REFACTOR:** We improved the code to use a dynamic mapping object so it supports dozens of clients easily, ensuring the test stayed green.
