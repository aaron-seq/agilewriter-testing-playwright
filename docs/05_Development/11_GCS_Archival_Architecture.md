# GCS Archival Architecture

## Overview
The Agile Writer Testing repository utilizes a **Hybrid Local-First Architecture** for generating test evidence, with Google Cloud Storage (GCS) serving as a durable, fail-soft archive.

All reports and accuracy outputs are generated on the local filesystem first. This maintains high performance and ensures that tests, local development, and CI environments are never blocked by cloud latency.

Once an artifact is fully generated on the local disk, a secondary detached process uploads the file to a GCS bucket.

## Managed Artifacts
The following durable outputs are uploaded to GCS:
- `.docx` Test Reports
- `report_manifest.json`
- `.xlsx` Accuracy Scorecards
- `.json` Accuracy Scorecards

Transient testing artifacts (e.g., screenshots, Playwright traces, intermediate test results) and local input files (e.g., `reference_files`, `raw_qa_files`) are **never** uploaded to GCS.

## Fail-Soft Guarantees
GCS uploads are strictly designed to be **fail-soft**.
If the `GOOGLE_APPLICATION_CREDENTIALS` or `GCS_BUCKET` are missing, unreachable, or invalid:
1. The GCS SDK will log a safe warning to the console.
2. The report generation process will **continue** and exit with code `0`.
3. The Express `/api/accuracy/score` endpoint will **continue** and return the local path immediately.

This ensures that the local repository workflow is completely immune to GCS network outages or authentication failures.

## Signed URLs
Currently, signed URLs are treated as a **future enhancement**. The UI continues to use local download endpoints (`/download-report` and `/api/accuracy/download/:filename`). GCS acts entirely as a post-generation backend archival process.

## Local Configuration
To configure GCS locally, the following environment variables are required in your `.env` file:
```ini
GCS_BUCKET=agilewriter-automation-testing-reports
GCS_ENV_PREFIX=dev/
GOOGLE_APPLICATION_CREDENTIALS=./sc-nlx-3a769a1deae5.json
```

> **CRITICAL SECURITY WARNING**: The service account JSON contains a private key. It MUST remain tracked by `.gitignore` (`sc-nlx-*.json`) and MUST NEVER be committed to the repository or logged in terminal outputs.
