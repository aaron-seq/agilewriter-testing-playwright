> [!WARNING]
> **DEPRECATED DOCUMENT**
> This document is deprecated. Please refer to the new Testing and Developer Handbook located in `docs/05_Development/`.
> 
> * For codebase map/navigation, see `docs/05_Development/01_Navigation_Guide.md` and `02_Test_Folder_Guide.md`
> * For environment configuration, see `docs/05_Development/03_Local_Development.md`
> * For testing strategy, see `docs/05_Development/05_TDD_Guide.md` and `06_Creating_Tests.md`
> * For execution flows, see `docs/05_Development/07_Health_Scripts.md` and `09_Examples_and_Gotchas.md`

# Environment Configuration

## 1. Why This Exists

AgileWriter tests run against multiple environments (QA, UAT, Production) and require access to secure Microsoft SharePoint folders. We cannot hardcode URLs or passwords into the repository.

Instead, we use a local `.env` file. This file acts as the universal remote control for the test suite. This document explains what variables exist, how to set them up, and what happens when they are wrong.

> [!IMPORTANT]
> **Source of Truth Rule**
> `Environment_Configuration.md` is the ONLY canonical location for explaining environment variables. If you add a new variable to the codebase, you must document it here and add an empty stub to `.env.example`.

## 2. Mental Model

Think of the environment configuration as a strict bouncer at the door of a club:

1. **The Bouncer (`validateHealthEnv.ts`)**: Before any test runs, the bouncer checks your `.env` file against a strict list of requirements.
2. **The VIP List (`.env.example`)**: The template showing exactly what credentials you need to provide.
3. **Your ID (`.env`)**: Your local, secret file containing real passwords and URLs. This file is ignored by Git and never committed.

If your ID doesn't match the VIP list exactly, the bouncer rejects you instantly (in 0.01 seconds) rather than letting you into the club (launching the browser) and kicking you out 20 minutes later when a document upload fails.

## 3. Real Example: The Configuration Pipeline

Here is how a variable flows from your local file into the test logic:

```mermaid
flowchart TD
    A[.env (Local File)] -->|Loads into| B[process.env]
    B -->|Validated by| C[validateHealthEnv.ts]
    C -->|Mapped by| D[runtime-config.ts]
    D -->|Consumed by| E[Playwright Test Spec]
```

## 4. Step-by-Step Workflow: Managing Variables

### Setting Up Your Environment
1. Copy the template: `cp .env.example .env`
2. Open `.env` and fill in the required base variables:
   * `MS_EMAIL`: Your Microsoft SSO email
   * `MS_PASSWORD`: Your Microsoft SSO password
   * `BASE_URL`: The AgileWriter environment URL (e.g., `https://qa.agilewriter.com`)
3. Fill in the specific document variables for the tests you intend to run (e.g., `HEALTH_TEMPLATE_CSR`).

### Adding a New Variable
If you are developing a new feature and need a new variable:
1. Add the variable usage to your test or server code.
2. Add the variable to the strict validation mapping in `tests/helpers/validateHealthEnv.ts`.
3. Add a placeholder stub to `.env.example`.
4. Document the variable in the table below.

## 5. Verified Variables Reference

### Baseline Execution Variables
Required for *any* test to run.

| Variable | Purpose | Example | Primary Consumer |
| :--- | :--- | :--- | :--- |
| `MS_EMAIL` | Microsoft SSO username | `jane.doe@company.com` | Playwright Auth |
| `MS_PASSWORD` | Microsoft SSO password | `SuperSecret123!` | Playwright Auth |
| `BASE_URL` | Target AgileWriter environment | `https://qa.agilewriter.com` | Playwright Navigation |
| `APP_URL` | Specific sign-in routing URL | `https://login.agilewriter.com` | Playwright Auth |

### Context-Specific Variables
Required only for specific document types or reporting features.

| Variable | Purpose | Example | Primary Consumer |
| :--- | :--- | :--- | :--- |
| `TESTER_NAME` | Name injected into generated QA reports | `Jane Doe` | Report Generator |
| `TEST_ENV` | Environment tag for the generated reports | `QA` | Report Generator |
| `HEALTH_TEMPLATE_*` | Name of the template in SharePoint | `CSR_Template_v2.docx` | Health Scripts |
| `HEALTH_SOURCE_*` | Name of the source folder in SharePoint | `Study_101_Data` | Health Scripts |

## 6. Common Mistakes

* **Trailing Spaces**: `BASE_URL=https://qa.com ` (notice the space) will cause Playwright navigation to fail with a malformed URL error.
* **Committing `.env`**: Never use `git add .env`. It contains your raw Microsoft password.
* **Stale Configuration**: When pulling `main`, if a teammate added a new required variable to `.env.example`, your existing `.env` won't automatically update. Your tests will start failing until you manually copy the new variable over.

## 7. Troubleshooting

**Symptom**: `[validateHealthEnv] Missing required env vars`
* **Diagnosis**: You tried to run a test that requires specific folder paths, but your `.env` doesn't have them.
* **Fix**: Open `.env.example`, find the variables for the test you are trying to run, copy them to your `.env`, and fill them in.

**Symptom**: Playwright launches but immediately fails to log in to Microsoft.
* **Diagnosis**: Your `MS_EMAIL` or `MS_PASSWORD` is incorrect, or your password expired.
* **Fix**: Update the values in `.env`. Note that if you use Docker, you do not need to rebuild the container for `.env` changes to take effect, but you do need to restart it (`docker-compose down && docker-compose up`).

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
