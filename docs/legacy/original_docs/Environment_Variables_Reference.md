Document Status: Historical
Superseded By: TBD
Reason Preserved: Original implementation retained

# Environment Variables Reference

<!-- ADDED May 2026 -->

This document is the single source of truth for every environment variable used in the AgileWriter Automation Suite. Variables are grouped by the component that reads them.

# Authentication & Base URL

These are required for every test run.

| Variable        | What It Does                                                   | Example Value                                  | Read By                                            |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| `MS_EMAIL`    | Microsoft SSO login email                                      | `user@synterex.com`                          | `app-navigation.ts`                              |
| `MS_PASSWORD` | Microsoft SSO login password                                   | `yourPassword123`                            | `app-navigation.ts`                              |
| `BASE_URL`    | Base URL for the AgileWriter application (without `/signin`) | `https://app-v2-rc1-aw.smarter.codes`        | `playwright.config.js`                           |
| `APP_URL`     | Full login URL for the application                             | `https://app-v2-rc1-aw.smarter.codes/signin` | `runtime-config.ts`, `generate-word-report.js` |

**⚠️ Never commit `MS_EMAIL` or `MS_PASSWORD` to Git.** Use the `.env.example` template.

# Report Generation

These control the metadata shown on generated Word reports.

| Variable              | What It Does                                                | Example Value           | Read By                     |
| --------------------- | ----------------------------------------------------------- | ----------------------- | --------------------------- |
| `TESTER_NAME`       | Name(s) displayed in the report header                      | `Aaron & Inayathulla` | `generate-word-report.js` |
| `TEST_ENV`          | Environment label shown in the report                       | `QA`                  | `generate-word-report.js` |
| `CI`                | When set to `true`, Playwright runs in headless mode      | `true`                | `playwright.config.js`    |
| `PLACEHOLDER_REGEX` | Regex pattern for detecting placeholder syntax in documents | `<\s*([^<>]+?)\s*>`   | `health-report-runner.ts` |

# Health Script Configuration

Each of the 4 health scripts (ICF Trimmed, ICF Full, CSR, M264) reads its own set of variables. If a variable is not set, the default value from `runtime-config.ts` is used.

## ICF Trimmed

| Variable                               | Default Value                         | Purpose                                   |
| -------------------------------------- | ------------------------------------- | ----------------------------------------- |
| `HEALTH_TEMPLATE_ICF_TRIMMED`        | `ICF_SET0_TRIMMED.docx`             | Name of the template file in SharePoint   |
| `HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED` | `Informed Consent Form`             | SharePoint folder containing the template |
| `HEALTH_SOURCES_ICF_TRIMMED`         | `Protocol Example (28Sep2023).docx` | Comma-separated source file names         |
| `HEALTH_SOURCE_FOLDER_ICF_TRIMMED`   | `Protocol`                          | SharePoint folder containing source files |
| `HEALTH_OUTPUT_PREFIX_ICF_TRIMMED`   | `ICF_Trimmed`                       | Prefix for the generated output filename  |

## ICF Full

| Variable                            | Default Value                         | Purpose                                   |
| ----------------------------------- | ------------------------------------- | ----------------------------------------- |
| `HEALTH_TEMPLATE_ICF_FULL`        | `ICF_SET0.docx`                     | Name of the template file in SharePoint   |
| `HEALTH_TEMPLATE_FOLDER_ICF_FULL` | `Informed Consent Form`             | SharePoint folder containing the template |
| `HEALTH_SOURCES_ICF_FULL`         | `Protocol Example (28Sep2023).docx` | Comma-separated source file names         |
| `HEALTH_SOURCE_FOLDER_ICF_FULL`   | `Protocol`                          | SharePoint folder containing source files |
| `HEALTH_OUTPUT_PREFIX_ICF_FULL`   | `ICF_Full`                          | Prefix for the generated output filename  |

## CSR

| Variable                       | Default Value                                                                                   | Purpose                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `HEALTH_TEMPLATE_CSR`        | `CSR_Template_20FEB2026.docx`                                                                 | Name of the template file in SharePoint   |
| `HEALTH_TEMPLATE_FOLDER_CSR` | `CSR`                                                                                         | SharePoint folder containing the template |
| `HEALTH_SOURCES_CSR`         | `Mock_CSR _Tables_30Oct25.rtf,Mock_CSR_Protocol.docx,Mock_CSR Key messages_with_heading.docx` | Comma-separated source file names         |
| `HEALTH_SOURCE_FOLDER_CSR`   | `CSR`                                                                                         | SharePoint folder containing source files |
| `HEALTH_OUTPUT_PREFIX_CSR`   | `CSR_Test`                                                                                    | Prefix for the generated output filename  |

## M264

| Variable                        | Default Value                                              | Purpose                                                                        |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `HEALTH_TEMPLATE_M264`        | `2.6.4 Template_Test.docx`                               | Name of the template file in SharePoint                                        |
| `HEALTH_TEMPLATE_FOLDER_M264` | `M264`                                                   | SharePoint folder for templates (**Note:** different from source folder) |
| `HEALTH_SOURCES_M264`         | `Absorption_PK Study in Dog.docx,Metabolism_Report.docx` | Comma-separated source file names                                              |
| `HEALTH_SOURCE_FOLDER_M264`   | `Module264`                                              | SharePoint folder for sources (**Note:** different from template folder) |
| `HEALTH_OUTPUT_PREFIX_M264`   | `M264_Test`                                              | Prefix for the generated output filename                                       |

**⚠️ M264 Gotcha:** The template and source files live in *different* SharePoint folders (`M264` for templates, `Module264` for sources). This is the only document type where the two folders differ.

# Session Isolation (Server-Injected)

These variables are set automatically by `test-runner-server.js` when running tests from the browser UI. You never need to set them manually.

| Variable       | What It Does                                                                                                                  | Set By                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `SESSION_ID` | Unique identifier for each UI-triggered run. When set, all output goes to `sessions/<SESSION_ID>/` instead of `reports/`. | `test-runner-server.js` |

# Accuracy Scorer

The accuracy scorer does **not** currently use any `.env` variables. All configuration (reference file path, raw QA file path, output directory) is passed in programmatically by either:

- The `accuracy.spec.ts` entry point (reads hardcoded defaults or command-line env vars)
- The server's `POST /api/accuracy/score` route (receives file paths from the UI)

If you need to run the scorer from the terminal with custom files, pass the paths as inline environment variables:

```bash
ACCURACY_RAW_QA_PATH="CSR_Test_raw_qa.xlsx" ACCURACY_REF_PATH="reference_files/ref_CSR.xlsx" ACCURACY_OUTPUT_DIR="reports/" npx playwright test tests/accuracy.spec.ts --reporter=line
```

# All Variables Read By `runtime-config.ts`

The `runtime-config.ts` file is the central configuration parser. It reads all `HEALTH_*` variables and exports them as a typed TypeScript object. If a variable is not set in `.env`, the default value shown in the tables above is used.

# Contacts

- **Aaron Sequeira:** All health script variables, accuracy scorer configuration, and this document.
- **Inayathulla:** Session isolation (`SESSION_ID`), server configuration, and report generation variables.
- **Anil:** Reference file contents and expected placeholder values.

## Server Startup & dotenv Resolution (Updated May 2026)

<!-- UPDATED May 2026 -->

### Problem Fixed

`require('dotenv').config()` without a path argument resolves `.env` relative to
`process.cwd()` — the directory the server process was started from. On Windows,
starting the server from inside the `server/` subdirectory caused dotenv to report
`injecting env (0)` (zero variables loaded) because `.env` lives at the project root,
not inside `server/`.

### Fix Applied

```js
// server/test-runner-server.js — line 8
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
```

`__dirname` always resolves to the `server/` directory regardless of where the process
was started, so `path.join(__dirname, '..', '.env')` always points to the project root
`.env` file.

### Where .env Lives

```
C:\Users\Aaron Sequeira\Agile Writer Test
├── .env                          ← LIVES HERE (project root)
├── server
│   └── test-runner-server.js     ← server starts here
├── tests
│   └── helpers
│       └── runtime-config.ts     ← reads .env via dotenv
```

### Required .env Variables (Minimum for Server to Run)

| Variable                           | Used By                   | Example Value                                      |
| ---------------------------------- | ------------------------- | -------------------------------------------------- |
| BASE_URL                           | All health scripts        | https://app-v2-rc1-aw.smarter.codes                |
| MS_EMAIL                           | Login step                | aaron@example.com                                  |
| MS_PASSWORD                        | Login step                | yourpassword                                       |
| HEALTH_TEMPLATE_CSR                | CSR health script         | CSR_Template_20FEB2026.docx                        |
| HEALTH_TEMPLATE_FOLDER_CSR         | CSR health script         | CSR                                                |
| HEALTH_SOURCES_CSR                 | CSR health script         | Mock_CSR_Tables_30Oct25.rtf,Mock_CSR_Protocol.docx |
| HEALTH_SOURCE_FOLDER_CSR           | CSR health script         | CSR                                                |
| HEALTH_TEMPLATE_ICF_TRIMMED        | ICF Trimmed health script | ICF_SET0_TRIMMED.docx                              |
| HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED | ICF Trimmed health script | QA Testing                                         |
| HEALTH_SOURCES_ICF_TRIMMED         | ICF Trimmed health script | Protocol Example (28Sep2023)_trimmed.docx          |
| HEALTH_SOURCE_FOLDER_ICF_TRIMMED   | ICF Trimmed health script | Protocol                                           |

