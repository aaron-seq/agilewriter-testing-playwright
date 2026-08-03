# Automation Validation Tests

Playwright test suite for Agile Writer. It validates document generation, runs
health checks against live environments, and scores placeholder-replacement
accuracy.

**Docs:** this file (setup & run) · [Adding tests](docs/ADDING_TESTS.md) · [How it works](docs/DEVELOPER.md)

---

## Setup

Requires Node.js 18+ and Git.

```bash
git clone https://bitbucket.org/smartercodes-repo/automation-validation-tests.git
cd automation-validation-tests
npm install
npx playwright install
```

Copy `.env.example` to `.env` and fill it in. At minimum:

```env
MS_EMAIL=your-email@smarter.codes
MS_PASSWORD=your-password
BASE_URL=https://app-v2-rc1-aw.smarter.codes
PLACEHOLDER_REGEX=<\s*([^<>]+?)\s*>
```

Health suites need extra variables — see [Health suites](#health-suites) below.

---

## Running tests

```bash
npm test              # unit + infrastructure + api — no browser, no credentials
npm run test:e2e      # browser E2E (logs in first)
npm run test:health   # all health suites
npm run test:py       # benchmarking_automation pytest suite
```

Or target anything directly:

```bash
npx playwright test tests/health_CSR.spec.ts
npx playwright test --project=unit --list      # see what would run
npx playwright test --ui                       # visual runner
npx playwright show-report                     # open the last HTML report
```

### What needs what

| Group | Command | Needs |
|---|---|---|
| `unit` | `npx playwright test --project=unit` | nothing |
| `api` | `npx playwright test --project=api` | nothing (starts its own server) |
| `infrastructure` | `npx playwright test --project=infrastructure` | bash |
| `standalone` — accuracy | `npx playwright test tests/accuracy.spec.ts` | nothing |
| `standalone` — integration | `npx playwright test tests/integration/` | Docker running |
| `health` | `npm run test:health` | `.env` + live app |
| `smarter-tests` (E2E) | `npm run test:e2e` | `.env` + live app |
| `diagnostics` | `npx playwright test --project=diagnostics --headed` | `.env` + live app |

`unit`, `api`, `infrastructure` and `standalone` never launch a browser and
never trigger the login flow. Run them freely.

The Python suite in `benchmarking_automation/` is separate — see
[Adding tests](docs/ADDING_TESTS.md#5-adding-a-benchmarking-test) for its
one-time venv setup.

---

## Health suites

A health suite drives one full document-generation run end to end and writes a
DOCX report. Each needs its own variables in `.env`; a missing one fails
immediately with the exact names:

```
[validateHealthEnv] Missing required env vars for 'csr': HEALTH_TEMPLATE_CSR, ...
```

| Suite | Variable prefix |
|---|---|
| CSR | `HEALTH_*_CSR` |
| ICF Full | `HEALTH_*_ICF_FULL` |
| ICF Trimmed | `HEALTH_*_ICF_TRIMMED` |
| Ideaya | `HEALTH_*_IDEAYA` |
| Ideaya Preflight | `HEALTH_*_IDEAYA_PREFLIGHT` |
| Ideaya PRODTEST CSR | `HEALTH_*_IDEAYA_PRODTEST_CSR` |
| M264 | `HEALTH_*_M264` |

`.env.example` lists every variable per suite with its exact name. List the
suites with `npx playwright test --project=health --list`.

### Reading the report

Each run writes a DOCX to `sessions/<sessionId>/` with a step-by-step timeline.

`Overall Status` is `PASS` only when steps were recorded and none failed —
zero steps means the run crashed before starting, and reports `FAIL`.

Placeholder colours in the training workspace:

| Colour | Meaning |
|---|---|
| 🟢 Green | Replacement done |
| 🔵 Blue | Match found, not yet applied |
| 🟡 Yellow | Matching in progress |
| ⬜ Grey | Not matched |
| 🔴 Red | Replacement not found |

---

## Web runner

Run health checks from a browser instead of the CLI:

```bash
npm run server        # then open http://localhost:3000/ui
```

Pick a suite, click **Execute**, download the DOCX when it finishes. A hosted
instance also exists — ask your team lead for the URL, no local setup needed.

---

## Troubleshooting

**`Missing required env vars for '<suite>'`**
Add the named variables to `.env`. `.env.example` is the reference.

**`ENOENT: playwright/.auth/user.json`**
No saved login. Run `npm run test:e2e`, which logs in via the `setup` project
and writes the file. Health suites recover their own session and don't need it.

**Login fails** — check `MS_EMAIL`, `MS_PASSWORD`, `BASE_URL`, and that the
account can reach that environment.

**Browser won't launch** — `npx playwright install`.

**`Health spec not found in validation map`** — a new health spec wasn't
registered. See [Adding tests](docs/ADDING_TESTS.md#adding-a-health-suite).

**Suite count changed unexpectedly**
```bash
npx playwright test tests/helpers/__tests__/healthIsolation.spec.ts
```
This names the spec that went missing or appeared.

When reporting a problem, include the suite name, environment, error message,
and the HTML report or trace.
