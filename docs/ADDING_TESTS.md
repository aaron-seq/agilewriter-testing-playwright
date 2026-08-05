# Adding tests

How to add a test to this repo. For setup and running, see the
[README](../README.md); for how the pieces fit together, see
[How it works](DEVELOPER.md).

---

## 1. Pick where it goes

The folder decides which Playwright project runs it, and that decides whether
it needs a browser and a login. Put it in the wrong place and a unit test will
drag the whole 9-test login flow along with it.

| Your test…                                         | Put it in                    | Project            | Browser / auth |
| --------------------------------------------------- | ---------------------------- | ------------------ | -------------- |
| calls a function, reads a file, parses xlsx         | `tests/helpers/__tests__/` | `unit`           | no             |
| tests code next to a module                         | `<module>/__tests__/`      | `unit`           | no             |
| sends HTTP to the web runner                        | `tests/api/`               | `api`            | no             |
| runs a shell script (`deploy.sh`, `develop.sh`) | `tests/infrastructure/`    | `infrastructure` | no             |
| needs Docker                                        | `tests/integration/`       | `standalone`     | no             |
| drives the app in a browser                         | `tests/`                   | `smarter-tests`  | yes            |
| is a full document-generation run                   | `tests/template-format-health-reports/` | `health` | yes |
| is a throwaway debugging script                     | `tests/diagnostics/`       | `diagnostics`    | yes            |

Any `__tests__/` folder anywhere in the repo routes to `unit` automatically —
that's the single rule in `playwright.config.js`.

After adding a file, confirm the routing before you write the body:

```bash
npx playwright test path/to/your.spec.ts --list
```

If you see `[setup]` or `AW_00_10_consolidated_flow` on a non-browser test, it
landed in the wrong project.

---

## 2. Write it

Everything is a normal Playwright spec — there's no custom harness.

**A unit test** (`tests/helpers/__tests__/myThing.spec.ts`):

```ts
import { test, expect } from '@playwright/test';
import { normalizePlaceholderName } from '../reference-file-loader';

test('strips surrounding angle brackets', () => {
  expect(normalizePlaceholderName('<Site_Name>')).toBe('site_name');
});
```

**A browser test** (`tests/my_feature.spec.ts`) — the login already happened in
the `setup` project, so start from a page:

```ts
import { test, expect } from '@playwright/test';
import { openAgileMapping } from './helpers/app-navigation';

test('mapping controls open', async ({ page }) => {
  await openAgileMapping(page);
  await expect(page.getByRole('heading', { name: 'Agile Mapping' })).toBeVisible();
});
```

Reach for `tests/helpers/app-navigation.ts` before writing your own
navigation — it already has `openDashboard`, `openAgileMapping`,
`navigateToFolder`, `confirmPickerDialog`, `waitForApplyAllToast`,
`clickIfVisible` and `dismissModalOverlay`, and they handle the session
recovery and modal-overlay cases you'd otherwise rediscover.

---

## 3. API tests

An API test sends HTTP straight at `server/test-runner-server.js` — no browser,
no login, no Playwright child process. They run in milliseconds instead of
minutes, so anything you can assert about a request or a response belongs here
rather than in a browser test.

Use one when you're checking:

- a status code or a JSON shape
- input validation — does a bad payload get rejected, with a useful message?
- that a response *doesn't* contain something (a password, a full file path)

Use a browser test only when the assertion is genuinely about the rendered UI.

They live in `tests/api/` and run as the `api` project:

```bash
npx playwright test --project=api
```

### Writing one

`tests/api/server-routes.spec.ts` is the working example. The pattern is
Playwright's `request` fixture — no HTTP client dependency:

```ts
import { test, expect } from '@playwright/test';

test('rejects a request with no testFile', async ({ request }) => {
  const response = await request.post(`${BASE}/run-test`, { data: {} });

  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain('testFile is required');
});
```

The spec starts its own server in `beforeAll` on port **3399** and kills it in
`afterAll`. That's deliberate: it doesn't collide with a dev server you have on
3000, and the suite doesn't silently pass because you forgot to start anything.
`waitForServer()` polls until the port answers, so tests never race the boot.

Adding a test to the existing file needs no setup — the server is already
running. A new file in `tests/api/` needs its own `beforeAll`/`afterAll`; copy
them, and use a different port if both files might run at once.

### The one rule

**Never let a test reach a route that starts real work.**

`POST /run-test` spawns a Playwright process and a 45-minute health run when
validation passes. So test its *rejection* paths only, with input that cannot
be accepted:

```ts
// Safe — this spec is not in HEALTH_SPEC_CONFIG_MAP, so it always 400s.
data: { testFile: 'health_DoesNotExist.spec.ts' }

// NOT safe — if the CSR vars happen to be set in .env, this starts a real run.
data: { testFile: 'health_CSR.spec.ts' }
```

The same applies to `POST /api/accuracy/score`, which writes report files.

Routes that are safe to call freely: `GET /list-tests`, `GET /api/env-status`,
`GET /api/accuracy/reference-files`, `GET /api/accuracy/raw-qa-files`,
`GET /api/accuracy/results`, `GET /stream` with an unknown session, and `GET /`.

### Asserting on what isn't there

Response-body assertions are the cheapest place to catch a leak, and the API
layer is where leaks surface:

```ts
const body = await response.text();
if (process.env.MS_PASSWORD) {
  expect(body).not.toContain(process.env.MS_PASSWORD);
}
```

Guard on the env var being set, so the test stays meaningful on a machine
without `.env` instead of passing vacuously.

---

## 4. Adding a health suite

A health suite is more wiring than a plain test, because the env contract, the
server, and the report all have to know about it. Four edits:

**1. Declare its required env vars** — `utils/validateHealthEnv.js`, the only
place they live:

```js
const REQUIRED_VARS = {
  // ...
  mySuite: [
    'HEALTH_TEMPLATE_MY_SUITE',
    'HEALTH_TEMPLATE_FOLDER_MY_SUITE',
    'HEALTH_SOURCES_MY_SUITE',
    'HEALTH_SOURCE_FOLDER_MY_SUITE',
  ],
};

const HEALTH_SPEC_CONFIG_MAP = {
  // ...
  'health_MySuite.spec.ts': 'mySuite',
};
```

**2. Add the config key to the type** — `utils/validateHealthEnv.ts`, one line
on the `HealthConfigKey` union. That file is a typed wrapper; don't copy
`REQUIRED_VARS` into it.

**3. Add the runtime config** — `runtime-config.ts`, so
`runtimeConfig.health.mySuite` resolves.

**4. Write the spec** — `tests/template-format-health-reports/health_MySuite.spec.ts`, copying the shape of
`tests/template-format-health-reports/health_CSR.spec.ts`:

```ts
test.describe('Health Report: My Suite', () => {
  test.describe.configure({ timeout: 2_700_000 });   // training time × 2 + overhead

  test.beforeAll(() => {
    initTracker();
    validateHealthEnv('mySuite');
  });
  test.afterAll(() => saveResults());

  test('My Suite - Full Health Check', async ({ page }) => {
    await runHealthReport(page, runtimeConfig.health.mySuite);
  });
});
```

Then document the variables in `.env.example`, and bump the expected count in
`tests/helpers/__tests__/healthIsolation.spec.ts` — it asserts the exact number
of health tests, so it will fail until you do. That failure is the feature: it
catches suites that silently disappear.

---

## 5. Adding a placeholder-extraction test

`placeholder_inventory/` is the Python side — it turns a `.docx` template into
a QA workbook. Tests live in `placeholder_inventory/tests/`.

```bash
npm run test:py        # 20 tests, about a second
```

Most tests build a throwaway `.docx` in `tmp_path` with the `_docx()` and
`_para()` helpers rather than committing fixtures. Note that `_para()` escapes
angle brackets — Word stores `<Sponsor>` as `&lt;Sponsor&gt;`, and a fixture
with raw `<` is invalid XML that the parser silently drops.

Two tests do use real templates, from `placeholder_inventory/fixtures/`. They
assert full recall against `reference_files/`, and they use the same
normalisation contract as `accuracy-scorer.ts` — collapse whitespace, strip
angle brackets, lowercase — because a stricter comparison reports failures the
product would never see.

---

## 6. Check it before you push

```bash
npx tsc --noEmit    # types
npm test            # unit + infrastructure + api, ~1 min, no credentials
npm run test:py     # pytest, if you touched placeholder_inventory
```

If you touched `playwright.config.js`, `projectIsolation.spec.ts` and
`healthIsolation.spec.ts` will tell you whether the routing still holds — they
shell out to `--list` and assert what lands where. Both run inside `npm test`.
