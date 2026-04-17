# Health Report Walkthrough

## Purpose
This walkthrough explains how to configure and validate the Agile Writer health-report flow after the v3 reporting cleanup.

## 1. Configure `.env`
Copy [.env.example](C:\Users\Aaron Sequeira\Agile Writer Test\.env.example) to `.env` and fill in:

- `MS_EMAIL`
- `MS_PASSWORD`
- `BASE_URL`
- `TESTER_NAME`
- `TEST_ENV`
- `APP_URL`

For health reports, use the namespaced document keys only:

- `HEALTH_TEMPLATE_ICF_TRIMMED`, `HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED`, `HEALTH_SOURCES_ICF_TRIMMED`, `HEALTH_SOURCE_FOLDER_ICF_TRIMMED`, `HEALTH_OUTPUT_PREFIX_ICF_TRIMMED`
- `HEALTH_TEMPLATE_ICF_FULL`, `HEALTH_TEMPLATE_FOLDER_ICF_FULL`, `HEALTH_SOURCES_ICF_FULL`, `HEALTH_SOURCE_FOLDER_ICF_FULL`, `HEALTH_OUTPUT_PREFIX_ICF_FULL`
- `HEALTH_TEMPLATE_CSR`, `HEALTH_TEMPLATE_FOLDER_CSR`, `HEALTH_SOURCES_CSR`, `HEALTH_SOURCE_FOLDER_CSR`, `HEALTH_OUTPUT_PREFIX_CSR`
- `HEALTH_TEMPLATE_M264`, `HEALTH_TEMPLATE_FOLDER_M264`, `HEALTH_SOURCES_M264`, `HEALTH_SOURCE_FOLDER_M264`, `HEALTH_OUTPUT_PREFIX_M264`

This avoids the old cross-test contamination caused by one shared set of `HEALTH_*` values.

## 2. Compile-Only Validation
Use this pass when you want to verify code structure without consuming training time:

```powershell
npx tsc --noEmit
```

This is the default verification path for reporting/config changes.

## 3. Generate the Word Report
After a health-report run has created `reports/step-results.json`, generate the Word document with:

```powershell
npm run report
```

Output file:

- [AgileWriter_Validation_Report.docx](C:\Users\Aaron Sequeira\Agile Writer Test\reports\AgileWriter_Validation_Report.docx)

The report reads:

- `reports/step-results.json`
- namespaced health config from `.env`
- optional report metadata from `runtime-config.json`

## 4. How the Report Is Structured
The Word report now shows:

- an overall execution summary
- one section each for `ICF Trimmed`, `ICF Full`, `CSR`, and `M264`
- configured template name, source names, source folder, and output filename patterns
- separate critical-failure and soft-failure lists
- placeholder color snapshots from recorded steps
- a step timeline with status, type, duration, and timestamp

## 5. Critical vs Soft Failures
- `Critical` means the workflow cannot continue if that step fails.
  Examples: login, file selection, training stages, Apply All, Create Final Doc, download.
- `Soft` means the test should continue and capture more signal even if the check fails.
  Examples: preview rendering, optional integrations, color-count diagnostics, mapping-detail checks.

Soft failures still appear in the report and still count as test failures in Playwright. The difference is that the script continues running and collects more debugging information before finishing.

## 6. Output File Naming
Agile Writer generates server-side IDs at runtime, so the report shows output patterns instead of exact file URLs:

- `{prefix}_*_SB_raw_qa.xlsx`
- `{prefix}_*_SB_raw.docx`
- `{prefix}_*_SB_clean.docx`
- `{prefix}_*_SB.docx`

The prefix comes from the namespaced `HEALTH_OUTPUT_PREFIX_*` variable for the document type you are validating.
