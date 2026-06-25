# GCS Archival Architecture

## Overview
The Agile Writer Testing repository utilizes a **Hybrid Local-First Architecture** for generating test evidence, with Google Cloud Storage (GCS) serving as a durable, fail-soft archive.

All reports and accuracy outputs are generated on the local filesystem first. This maintains high performance and ensures that tests, local development, and CI environments are never blocked by cloud latency.

Once an artifact is fully generated on the local disk, a secondary detached process uploads the file to a GCS bucket.

**GCS is archival only.** It is not a synchronous UI data source. Local writes remain the source of truth. The UI continues to serve files from local disk via Express endpoints.

## Managed Artifacts
The following durable outputs are uploaded to GCS:
- `.docx` Test Reports
- `report_manifest.json`
- `.xlsx` Accuracy Scorecards
- `.json` Accuracy Scorecards

Transient testing artifacts (e.g., screenshots, Playwright traces, intermediate test results) and local input files (e.g., `reference_files`, `raw_qa_files`) are **never** uploaded to GCS.

## Bucket Object Layout

Objects are stored under the environment prefix set by `GCS_ENV_PREFIX` (e.g. `dev/`). The actual object-key tree looks like this:

```
gs://agilewriter-automation-testing-reports/
└── dev/                                        ← GCS_ENV_PREFIX
    ├── <session-uuid>/                         ← from generate-word-report.js
    │   ├── run_YYYYMMDD_HHMM_Report.docx
    │   └── report_manifest.json
    └── accuracy/                               ← from /api/accuracy/score
        ├── accuracy-report-YYYYMMDD-HHMMSS.xlsx
        └── accuracy-report-YYYYMMDD-HHMMSS.json
```

DOCX reports and manifests are partitioned by session UUID because each test run produces a unique session. Accuracy artifacts are grouped under `accuracy/` because they are not session-scoped.

This layout is intentional. It mirrors the local filesystem structure and avoids an extra abstraction layer. Since GCS is archival only, the bucket tree does not need to match a user-facing folder hierarchy.

## IAM Prerequisites

Before uploads will succeed, the GCS service account must have the correct bucket-level IAM role.

**Minimum required role:** `Storage Object Creator` (`roles/storage.objectCreator`)

To grant this permission:
```bash
gcloud storage buckets add-iam-policy-binding gs://agilewriter-automation-testing-reports \
  --member="serviceAccount:YOUR_SA_EMAIL@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectCreator"
```

If this role is missing, uploads will fail with a `403 Permission Denied` error. The fail-soft design ensures this does **not** break local report generation or accuracy scoring — the upload simply logs a warning and the workflow continues.

## Fail-Soft Guarantees

GCS upload failure must be **fail-soft and non-blocking**. This is an architectural invariant, not a suggestion.

If `GOOGLE_APPLICATION_CREDENTIALS` or `GCS_BUCKET` are missing, unreachable, or invalid:
1. The GCS SDK will log a sanitized warning to the console.
2. The report generation process will **continue** and exit with code `0`.
3. The Express `/api/accuracy/score` endpoint will **continue** and return the local path immediately.

### Execution Context Rules

| Context | Upload behavior | Why |
|---|---|---|
| `generate-word-report.js` (standalone script) | `await` the upload, wrapped in `try/catch` | Prevents Node from exiting before the upload socket completes. The `try/catch` guarantees exit code stays `0` on failure. |
| `server/test-runner-server.js` (Express route) | Fire-and-forget (`Promise.all(...).catch(...)`) | Prevents the HTTP response from being blocked by cloud latency. The UI receives its response immediately. |

### What "fail-soft" means in practice

- Local DOCX is generated → ✅ always
- Local accuracy XLSX/JSON is generated → ✅ always
- Upload to GCS succeeds → only if IAM, network, and credentials are all correct
- Upload to GCS fails → log warning, return `null`, continue

**The local workflow must never fail because of GCS.** If it does, that is a bug.

## Security Rules

Three rules that must remain enforced:

1. **The service-account key must stay out of the build context.** The `.dockerignore` file excludes `sc-nlx-*.json` because `COPY . .` in the Dockerfile would otherwise bake a local key file into an image layer.

2. **Logs must only print a sanitized summary of GCS failures.** Google SDK error messages (especially 403 responses) embed the service account email in the error body. The uploader uses regex redaction to replace `*.iam.gserviceaccount.com` addresses with `[REDACTED_SA]` before logging.

3. **The service-account file name must remain generic in docs and config.** Repository files should say `your-service-account-key.json`, not the actual key filename. The real filename is known only to `.gitignore` and `.dockerignore` via the pattern `sc-nlx-*.json`.

> **CRITICAL SECURITY WARNING**: The service account JSON contains a private key. It MUST remain tracked by `.gitignore` (`sc-nlx-*.json`) and `.dockerignore` and MUST NEVER be committed to the repository, baked into Docker images, or logged in terminal outputs.

### Docker Container Behavior

Inside Docker containers, GCS uploads will log `[GCS] Upload failed` warnings and return `null`. This is expected. The `.dockerignore` correctly excludes the service account key file from the image, but the `env_file` directive in `docker-compose.local.yml` still injects `GOOGLE_APPLICATION_CREDENTIALS` from the host's `.env`. As a result, `isGcsConfigured()` returns `true` inside the container, the uploader attempts the upload, and the Google SDK throws an authentication error because the credentials file does not exist at the expected path inside the container. The fail-soft `try/catch` catches this error, logs a redacted warning, and returns `null`. The container continues to operate normally.

This is not a bug. Production containers should receive credentials via workload identity or a mounted secret (SCC-464 scope), not by baking key files into the image.

## Signed URLs
Currently, signed URLs are treated as a **future enhancement**. The UI continues to use local download endpoints (`/download-report` and `/api/accuracy/download/:filename`). GCS acts entirely as a post-generation backend archival process.

## Local Configuration
To configure GCS locally, add the following environment variables to your `.env` file:
```ini
GCS_BUCKET=agilewriter-automation-testing-reports
GCS_ENV_PREFIX=dev/
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account-key.json
```

If these variables are absent, the uploader silently skips. Local development works without GCS credentials.

## Troubleshooting

### PowerShell shows `NativeCommandError` but the script succeeded

PowerShell treats any output to stderr as an error, even when the Node process exit code is `0`. If you see a `NativeCommandError` alongside `[GCS] Upload failed`, check the actual exit code:

```powershell
node generate-word-report.js; echo "Exit code: $LASTEXITCODE"
```

If `$LASTEXITCODE` is `0`, the script succeeded. The GCS upload failed gracefully and the local report was generated correctly. The stderr output is a warning, not a failure.

### Uploads fail with 403

The service account does not have `storage.objects.create` permission on the bucket. See the [IAM Prerequisites](#iam-prerequisites) section above.

### Uploads silently skip

The `GCS_BUCKET` or `GOOGLE_APPLICATION_CREDENTIALS` environment variable is missing from `.env`. This is expected behavior for local development without GCS credentials.

