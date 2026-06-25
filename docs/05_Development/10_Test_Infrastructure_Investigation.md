# Test Infrastructure Investigation

## Purpose

This document records the Track B investigation that runs in parallel with
SCC-464. It is separate from production deployment architecture and must not
block SCC-464 research/design work.

## Findings

### Playwright bootstrap issue

Observed issue:

```text
Cannot find module '@playwright/test'
```

Current repo facts:

- `@playwright/test` exists in `package.json` devDependencies.
- `package-lock.json` contains `@playwright/test`.
- Root `playwright.config.js` exists.
- In this checkout, `npm list @playwright/test --depth=0` reports
  `@playwright/test@1.58.2`.

Conclusion:

Treat the observed `Cannot find module '@playwright/test'` error as a
bootstrap/environment issue until reproduced in a clean setup.

Likely checks:

- Confirm `npm ci` was run from the repository root.
- Confirm `node_modules/` exists locally when running outside Docker.
- Confirm the command is executed from the repository root.
- Confirm no stale global Playwright invocation is being used.
- Confirm Docker-based workflows do not rely on host `node_modules/`.

### AW_00_10 auto-execution behavior

Current repo facts:

- Root `playwright.config.js` defines a `setup` project matching
  `AW_00_10_consolidated_flow.spec.ts`.
- The `smarter-tests` project depends on `setup`.
- Helper and infrastructure specs currently list under `smarter-tests`.
- Health specs are isolated under the `health` project and do not pull in
  `AW_00_10` when listed directly.

Observed list behavior:

```text
npx playwright test tests/health_CSR.spec.ts --list
```

Lists only the health test.

```text
npx playwright test tests/helpers/__tests__/healthIsolation.spec.ts --list
```

Lists the `setup` project first, including AW_00_10 tests, followed by the
helper tests.

```text
npx playwright test tests/infrastructure/develop.spec.ts --list
```

Lists the `setup` project first, including AW_00_10 tests, followed by the
infrastructure tests.

Conclusion:

Unexpected AW_00_10 execution is plausible for helper and infrastructure specs
because they are assigned to `smarter-tests`, which depends on `setup`.

### Playwright HTML reporter lock during list commands

Observed during investigation:

```text
Error in reporter Error: EBUSY: resource busy or locked, copyfile ... playwright-report/index.html
```

The test list was still printed, but the HTML reporter tried to update
`playwright-report/index.html`. For diagnostic list commands, prefer
`--reporter=list` to avoid touching the HTML report directory.

## Recommendation

Create a separate follow-up ticket to decide whether helper and infrastructure
specs need their own Playwright project without `dependencies: ['setup']`.

Candidate project shape:

- `name: 'infrastructure'`
- `testMatch` includes `tests/infrastructure/**/*.spec.ts` and
  `tests/helpers/__tests__/**/*.spec.ts`
- no dependency on `setup`
- no browser auth state requirement unless a test explicitly needs it

Do not make this change inside SCC-464 production architecture work unless ERB
explicitly scopes it.

## Validation Commands Used

```bash
npm list @playwright/test --depth=0
npx playwright test tests/health_CSR.spec.ts --list --reporter=list
npx playwright test tests/helpers/__tests__/healthIsolation.spec.ts --list --reporter=list
npx playwright test tests/helpers/__tests__/healthIsolation.spec.ts --list --no-deps --reporter=list
npx playwright test tests/infrastructure/develop.spec.ts --list --reporter=list
```
