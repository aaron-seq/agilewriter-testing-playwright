# Adding a New Health Script

## 1. Why This Exists

When AgileWriter adds support for a new document type (e.g., an Investigator's Brochure), QA needs a way to automatically verify that the new document generation path works in every deployment.

This guide explains how to safely add a new Health Test to the repository without breaking existing tests, without polluting the UI dashboard, and while maintaining strict environment validation.

## 2. Mental Model

Adding a new test is a three-step process:
1. **The Lock**: You define the exact environment variables your test requires in `validateHealthEnv.ts`. If they aren't provided, your test refuses to run.
2. **The Key**: You add those variables to `runtime-config.ts` so the system knows how to read them from `.env`.
3. **The Engine**: You create the actual `.spec.ts` file in the `tests/` directory.

Because the UI dynamically interrogates the `tests/` folder for files matching `health_*.spec.ts`, you **do not** need to update the UI dashboard manually. Once you create the spec file, it automatically appears in the dropdown.

## 3. Real Example: Step-by-Step Workflow

Let's assume you are adding a new test for an "Investigator's Brochure" (IB).

### Step 1: Extend the Environment Validator (`utils/validateHealthEnv.ts`)

Every health test is protected by a guard. You must register your new test here first.

```typescript
// 1. Add your new key to the type
export type HealthConfigKey =
  | 'csr'
  | 'icfFull'
  | 'ib'; // <-- ADDED

// 2. Define the required variables
const REQUIRED_VARS: Record<HealthConfigKey, string[]> = {
  // ... existing configs
  ib: [ // <-- ADDED
    'HEALTH_TEMPLATE_IB',
    'HEALTH_TEMPLATE_FOLDER_IB',
    'HEALTH_SOURCES_IB',
    'HEALTH_SOURCE_FOLDER_IB',
  ],
};
```

### Step 2: Update the Runtime Configuration (`runtime-config.ts`)

Next, map those raw `.env` strings into a typed configuration object that Playwright will use.

```typescript
export const runtimeConfig = {
  health: {
    // ... existing configs
    ib: { // <-- ADDED
      templateName: process.env.HEALTH_TEMPLATE_IB || '',
      templateFolder: process.env.HEALTH_TEMPLATE_FOLDER_IB || '',
      sources: (process.env.HEALTH_SOURCES_IB || '').split(','),
      sourceFolder: process.env.HEALTH_SOURCE_FOLDER_IB || '',
    }
  }
}
```

### Step 3: Create the Spec File (`tests/health_IB.spec.ts`)

Finally, create the test. Use the standard template below. 

```typescript
import { test } from '@playwright/test';
import { runtimeConfig } from '../runtime-config';
import { initTracker, saveResults } from './helpers/step-tracker';
import { runHealthReport, HealthReportConfig } from './helpers/health-report-runner';
import { validateHealthEnv } from '../utils/validateHealthEnv';

test.describe('Health Report: IB', () => {
  // Set a timeout appropriate for IB generation (e.g. 20 minutes)
  test.describe.configure({ timeout: 1_200_000 });

  test.beforeAll(() => {
    initTracker();
    // THE GUARD: This MUST be the first thing your test does
    validateHealthEnv('ib');  
  });

  test.afterAll(() => {
    saveResults();
  });

  test('IB - Full Health Check', async ({ page }) => {
    const config: HealthReportConfig = runtimeConfig.health.ib;
    await runHealthReport(page, config);
  });
});
```

## 4. Common Mistakes

* **Forgetting `validateHealthEnv`**: If you forget to add the guard in `beforeAll()`, and an environment variable is missing, the test will launch Chromium, log in to Microsoft, open AgileWriter, and then crash halfway through when it tries to type `undefined` into the search box. The guard prevents this by failing instantly in 0.01 seconds.
* **Hardcoding values**: Never hardcode folder paths or file names in the `.spec.ts` file. Always route them through `.env` and `runtime-config.ts` so they can be changed without modifying code.
* **Naming convention**: Your file MUST be named `health_<SOMETHING>.spec.ts`. If you name it `ib_health.spec.ts`, the CLI and the UI Dashboard will ignore it.

## 5. Troubleshooting

**Symptom**: You added the script, but it doesn't show up in the UI dropdown.
* **Diagnosis**: The server caches the test list briefly, or your file is not named correctly.
* **Fix**: Ensure the file is in the `tests/` directory and matches the regex `/health_.*\.spec\.ts/`. Restart the `npm run server` process to force a re-discovery.

**Symptom**: `npm run server` crashes when someone clicks your test.
* **Diagnosis**: You have a syntax error in your new spec file. The `npx playwright test --list` command used by the server to discover tests actually compiles the TypeScript files. If one file fails to compile, the whole discovery process crashes.
* **Fix**: Run `npx playwright test tests/health_IB.spec.ts --project=health` locally to see the compilation error.

## 6. Key Takeaways

* Map your environment variables in `validateHealthEnv.ts` first.
* Route configuration through `runtime-config.ts`.
* Name the file `health_*.spec.ts` to ensure the dynamic UI dropdown finds it automatically.

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
