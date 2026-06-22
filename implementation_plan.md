# SCC-592 — Migrate Local Storage to Google Cloud Storage

## ERB Change Management Analysis

---

## 1. REQUIREMENTS ANALYST

### Known Facts

Evidence gathered from codebase inspection:

| What writes to local storage | Where it writes | File that writes it |
|---|---|---|
| Step results (JSON) | `sessions/<ID>/step-results.json` or `reports/step-results.json` | [step-tracker.ts](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/tests/helpers/step-tracker.ts) |
| Screenshots (PNG) | `sessions/<ID>/screenshots/` or `reports/screenshots/` | [step-tracker.ts](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/tests/helpers/step-tracker.ts) |
| DOCX reports | `sessions/<ID>/<name>_Report.docx` or `reports/<name>_Report.docx` | [generate-word-report.js](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/generate-word-report.js) |
| Report manifest | `sessions/<ID>/report_manifest.json` or `reports/report_manifest.json` | [generate-word-report.js](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/generate-word-report.js) |
| Runtime config | `sessions/<ID>/runtime-config.json` | [test-runner-server.js](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/server/test-runner-server.js) |
| Accuracy reports (XLSX+JSON) | `reports/accuracy/` | [accuracy-report-writer.ts](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/tests/helpers/accuracy-report-writer.ts) |
| Auth state | `playwright/.auth/user.json` | Playwright setup project |

**Directory Classification:**

| Directory | Type | Ephemeral vs Persistent | User vs System |
|---|---|---|---|
| `sessions/` | Output | Ephemeral (TTL: 1 hour, cleaned by server) | System-generated |
| `reports/` | Output | Persistent (gitignored, accumulated) | System-generated |
| `reports/accuracy/` | Output | Persistent | System-generated |
| `raw_qa_files/` | Input | Persistent (user drops files here) | User-managed |
| `reference_files/` | Input | Persistent (reference data for scoring) | User-managed |
| `playwright/.auth/` | Config | Ephemeral (machine-specific login state) | System-generated |
| `test-results/` | Output | Ephemeral (Playwright internal traces) | System-generated |
| `playwright-report/` | Output | Ephemeral (Playwright HTML report) | System-generated |

### Unknown Facts — Clarification Required

> [!IMPORTANT]
> The following questions **must be answered** before implementation can proceed. Implementation is blocked until these are resolved.

1. **Bucket name**: What is the GCS bucket name? Does it already exist, or must it be created?
2. **What must persist long-term**: Do `sessions/` outputs (which are currently cleaned after 1 hour) need to persist in GCS? Or only the final `reports/` and `reports/accuracy/` outputs?
3. **Do inputs move to GCS?**: Should `raw_qa_files/` and `reference_files/` remain as local-only directories, or do they also need cloud storage?
4. **Retention policy**: How long should GCS objects be retained? 30 days? 90 days? Indefinitely?
5. **Access model**: Who accesses the bucket? Only the application? Or do stakeholders also need to download reports directly via signed URLs?
6. **Upload trigger**: Does upload happen automatically after report generation? Or is it user-initiated (e.g., a button in the UI)?
7. **Bucket access control**: Uniform bucket-level access? Or per-object ACLs?
8. **Environment separation**: One bucket for all environments? Or separate buckets for dev/QA/production?

### Assumptions

Only assumptions supported by evidence:

1. **The GCS service account already exists.** Evidence: `sc-nlx-3a769a1deae5.json` is present in the project root with `project_id: "sc-nlx"` and `client_email: "agilewriter-automation-testing@sc-nlx.iam.gserviceaccount.com"`.
2. **The application runs as a Docker container in production.** Evidence: `Dockerfile`, `docker-compose.production.yml`, `deploy.sh` all exist and are functional.
3. **Local development should continue to work without GCS.** Evidence: The task explicitly states "preserve local development workflow".

### Risks of Wrong Assumptions

| Assumption | What breaks if wrong |
|---|---|
| Bucket already exists | `Storage.bucket()` calls fail with 404. All uploads fail silently or crash. |
| Service account has write permission | Upload attempts fail with 403 Forbidden. Reports appear generated locally but never reach GCS. |
| Local dev doesn't need GCS | If GCS is required everywhere, local developers need service account keys and network access, making onboarding harder. |
| Sessions are ephemeral | If someone needs session data after the 1-hour TTL, it's gone from both local disk AND GCS. |

---

## 2. RESEARCHER

### Findings

**Current Storage Architecture:**
- All storage is local filesystem via Node.js `fs` module
- Two modes: session-scoped (`sessions/<UUID>/`) and legacy (`reports/`)
- Session cleanup is handled by `setTimeout` in [test-runner-server.js:157-166](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/server/test-runner-server.js#L157-L166)
- Docker volumes mount `./sessions`, `./reports`, `./reference_files`, `./raw_qa_files` into `/app/` paths

**GCS Service Account:**
- File: `sc-nlx-3a769a1deae5.json` (project: `sc-nlx`)
- Email: `agilewriter-automation-testing@sc-nlx.iam.gserviceaccount.com`

> [!CAUTION]
> **CRITICAL SECURITY FINDING**: The file `sc-nlx-3a769a1deae5.json` contains a **private key** and is **NOT in `.gitignore`**. It is currently untracked by git (not committed), but this is a ticking time bomb. If anyone runs `git add .`, this key will be committed to the repository and pushed to both GitHub and Bitbucket. **This must be added to `.gitignore` immediately, regardless of whether SCC-592 proceeds.**

**GCS SDK:**
- Package: `@google-cloud/storage` (official Google SDK)
- Authentication: Uses `GOOGLE_APPLICATION_CREDENTIALS` env var pointing to the service account JSON key, or Application Default Credentials
- Supports: upload, download, signed URLs (v4), lifecycle policies, uniform bucket-level access

**Report Download Path:**
- The server's `/download-report` endpoint reads `.docx` files from the session directory ([test-runner-server.js:619-668](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/server/test-runner-server.js#L619-L668))
- The accuracy download endpoint serves from `reports/accuracy/` ([test-runner-server.js:851-864](file:///c:/Users/Aaron%20Sequeira/Agile%20Writer%20Test/server/test-runner-server.js#L851-L864))

### Known Pitfalls
1. **GCS is eventually consistent for overwrites** — uploading the same object twice in quick succession may return stale data
2. **Service account keys are long-lived credentials** — they don't expire and must be rotated manually
3. **Network latency** — GCS uploads add 100-500ms per file depending on size and region
4. **Docker volume mounts** — If we still write locally first, then upload, the Docker volume setup stays unchanged. If we write directly to GCS, the volume mounts become unnecessary for output dirs.

### Recommended Standards
- Use `GOOGLE_APPLICATION_CREDENTIALS` env var (not hardcoded paths)
- Use uniform bucket-level access (no per-object ACLs)
- Use signed URLs for external download access (15-minute expiry)
- Use lifecycle policies for automatic cleanup (matching the 1-hour session TTL)

---

## 3. ROOT CAUSE INVESTIGATOR

### 5 Whys

1. **Why do we need GCS?** — Because reports and session data are stored on the local filesystem of a VM/container.
2. **Why is local filesystem a problem?** — Because when the VM is restarted or the container is recreated, all data is lost.
3. **Why does restarting lose data?** — Because Docker containers are ephemeral by default. Volume mounts only persist to the host disk.
4. **Why is host disk persistence not enough?** — Because the host VM itself can be reprovisioned, and there is no backup or replication.
5. **Why is there no backup?** — Because no durable storage layer (like GCS) was integrated from the start — local filesystem was the simplest initial approach.

### Causal Chain

```text
Root Cause:   No durable storage layer in the architecture
     |
     v
Symptom:      Reports/sessions lost on container or VM restart
     |
     v
Contributing: Docker volumes only persist to host disk
Contributing: No automatic backup mechanism
Contributing: Session TTL cleanup deletes data after 1 hour locally
```

### What breaks when...
- **VM is restarted?** → All session data, reports, and accuracy results disappear
- **Multiple concurrent runs happen?** → Currently handled by UUID-based session isolation. GCS won't change this.
- **Bucket is unavailable?** → If GCS is the only storage, reports are lost. If we write-local-then-upload, reports survive locally even if upload fails.

---

## 4. ARCHITECT

### Option A — Minimal Change (Upload DOCX only)

Move only the final DOCX report to GCS after generation. Everything else stays local.

| Aspect | Detail |
|---|---|
| Files impacted | `generate-word-report.js`, `.env.example`, `.gitignore` |
| Est. LOC changed | ~40 |
| Dependencies | `@google-cloud/storage` |
| Migration | None — additive only |
| Operational impact | Very low |
| Security impact | GCS key management required |
| Test impact | 1-2 new tests |
| Maintenance cost | Low |

### Option B — Balanced Approach (Reports + Accuracy to GCS)

Move `reports/*.docx` and `reports/accuracy/*.xlsx` to GCS. Keep sessions, inputs, and auth local.

| Aspect | Detail |
|---|---|
| Files impacted | `generate-word-report.js`, `server/test-runner-server.js`, `tests/helpers/accuracy-report-writer.ts`, `.env.example`, `.gitignore` |
| Est. LOC changed | ~120 |
| Dependencies | `@google-cloud/storage` |
| Migration | None — additive only |
| Operational impact | Moderate — download endpoints need GCS fallback |
| Security impact | GCS key management required |
| Test impact | 5-8 new tests |
| Maintenance cost | Moderate |

### Option C — Strategic Approach (All Persistent Outputs to GCS)

Move all persistent runtime outputs (`sessions/`, `reports/`, `reports/accuracy/`) to GCS with lifecycle policies. Inputs stay local.

| Aspect | Detail |
|---|---|
| Files impacted | `generate-word-report.js`, `server/test-runner-server.js`, `tests/helpers/step-tracker.ts`, `tests/helpers/accuracy-report-writer.ts`, `global-setup.js`, `.env.example`, `.gitignore`, `docker-compose.production.yml` |
| Est. LOC changed | ~250 |
| Dependencies | `@google-cloud/storage` |
| Migration | Session directory structure changes |
| Operational impact | High — step-tracker writes to GCS on every step |
| Security impact | GCS key management, more data in cloud |
| Test impact | 10-15 new tests |
| Maintenance cost | High |

### Option D — Hybrid Approach (Write Local, Upload Durable)

Write everything locally first (preserving current behavior), then upload only the durable outputs (DOCX, accuracy reports, manifests) to GCS as a post-processing step. Transient debug data (screenshots, step-results.json, test-results/) stays local only.

| Aspect | Detail |
|---|---|
| Files impacted | New `utils/gcs-uploader.js`, `generate-word-report.js`, `server/test-runner-server.js`, `.env.example`, `.gitignore` |
| Est. LOC changed | ~100 |
| Dependencies | `@google-cloud/storage` |
| Migration | None — additive only |
| Operational impact | Low — local workflow unchanged |
| Security impact | GCS key management required |
| Test impact | 5-8 new tests |
| Maintenance cost | Low-Moderate |

---

## 5. DEVIL'S ADVOCATE

### Option A — Minimal Change

| Question | Answer | Risk |
|---|---|---|
| What breaks? | Nothing — purely additive | 🟢 Low |
| What scales poorly? | Only DOCX reports are durable. Accuracy reports are still lost on VM restart. | 🟡 Medium |
| What assumptions fail? | If stakeholders need accuracy reports in GCS too, this is insufficient. | 🟡 Medium |
| What edge cases exist? | GCS upload fails silently — report exists locally but not in cloud | 🟢 Low |
| Hidden complexity? | Almost none | 🟢 Low |
| Technical debt? | Half-migrated storage (some in GCS, some not) | 🟡 Medium |
| Future features harder? | Adding more GCS uploads later requires revisiting the same files | 🟢 Low |

### Option B — Balanced Approach

| Question | Answer | Risk |
|---|---|---|
| What breaks? | Download endpoints must handle "file in GCS, not local" | 🟡 Medium |
| What scales poorly? | Two download paths (local for dev, GCS for prod) must be maintained | 🟡 Medium |
| What assumptions fail? | If sessions need GCS too, this is still insufficient | 🟢 Low |
| What edge cases exist? | Race condition: user clicks download before GCS upload completes | 🟡 Medium |
| Hidden complexity? | Server must know whether to serve from local or GCS | 🟡 Medium |
| Technical debt? | Moderate — clear separation between local and cloud | 🟢 Low |
| Future features harder? | No — good foundation for expansion | 🟢 Low |

### Option C — Strategic Approach

| Question | Answer | Risk |
|---|---|---|
| What breaks? | step-tracker writes to GCS on every step — if GCS is down, the entire test run fails | 🔴 High |
| What scales poorly? | Network I/O on every step (~500ms * 30 steps = 15 seconds added per test run) | 🔴 High |
| What assumptions fail? | If network is unreliable, tests become flaky for infrastructure reasons | 🔴 High |
| What edge cases exist? | Screenshot uploads (large PNGs) can timeout | 🟡 Medium |
| Hidden complexity? | Session isolation must work across GCS object paths, not just local dirs | 🟡 Medium |
| Technical debt? | Low — fully migrated | 🟢 Low |
| Future features harder? | No — clean architecture | 🟢 Low |

**Mitigation for 🔴 risks:** Write locally first, upload async. But that's essentially Option D.

### Option D — Hybrid Approach

| Question | Answer | Risk |
|---|---|---|
| What breaks? | Nothing — local workflow is unchanged, upload is additive | 🟢 Low |
| What scales poorly? | Dual storage (local + GCS) uses more disk temporarily | 🟢 Low |
| What assumptions fail? | If local disk is full, writes still fail (but that's the current behavior too) | 🟢 Low |
| What edge cases exist? | Upload fails — report exists locally but not in GCS. Must be retried or flagged. | 🟡 Medium |
| Hidden complexity? | Upload logic must be fire-and-forget or queued | 🟢 Low |
| Technical debt? | Some — local files accumulate until cleaned | 🟢 Low |
| Future features harder? | No — can easily add more upload targets later | 🟢 Low |

---

## 6. ECONOMIC REVIEWER

| Criteria | Option A | Option B | Option C | Option D |
|---|---|---|---|---|
| Engineering Cost | Very Low (~2h) | Low (~4h) | High (~12h) | Low (~4h) |
| Complexity Cost | Trivial | Moderate | High | Low |
| Future Maintenance | Low | Moderate | High (GCS in hot path) | Low |
| Expected Benefit | Partial (DOCX only) | Good (reports + accuracy) | Complete | Good (reports + accuracy) |
| ROI Score | 7/10 | 8/10 | 5/10 (cost too high) | **9/10** |

**Rejected:** Option C. The complexity of putting GCS in the step-tracker hot path is disproportionate to the benefit. The risk of making test runs flaky due to network I/O is unacceptable.

---

## 7. DECISION COUNCIL

| Criteria | Option A | Option B | Option C | Option D |
|---|---|---|---|---|
| Risk | 🟢 Low | 🟡 Medium | 🔴 High | 🟢 Low |
| Complexity | 🟢 Low | 🟡 Medium | 🔴 High | 🟢 Low |
| Maintainability | 🟡 Medium | 🟢 Good | 🟢 Good | 🟢 Good |
| Scalability | 🟡 Limited | 🟢 Good | 🟢 Excellent | 🟢 Good |
| Performance | 🟢 No impact | 🟢 Minimal | 🔴 15s+ added | 🟢 Minimal |
| Testability | 🟢 Easy | 🟢 Easy | 🟡 Complex | 🟢 Easy |
| Time to Deliver | 🟢 2h | 🟢 4h | 🔴 12h+ | 🟢 4h |
| Future Flexibility | 🟡 Limited | 🟢 Good | 🟢 Excellent | 🟢 Good |

### Winner: Option D — Hybrid Approach

**Why it wins:**
- Zero disruption to current workflow (write locally first, upload after)
- Lowest risk — if GCS upload fails, reports still exist locally
- Easy rollback — remove the upload call, everything works as before
- Natural extension point — adding more upload targets later is trivial
- Preserves local development workflow without requiring GCS access

**Why the alternatives lose:**
- **A** is too limited — accuracy reports are also important
- **B** requires modifying download endpoints to serve from GCS, adding complexity to the server
- **C** puts GCS in the test execution hot path, creating a network dependency that makes tests flaky

---

## 8. QA GUARDIAN — RED Phase Tests

> [!IMPORTANT]
> These are the failing tests that must be written **before** implementation. They define the contract.

```typescript
// Location: tests/helpers/__tests__/gcsUploader.spec.ts

import { test, expect } from '@playwright/test';

// ── Happy Paths ──

test('uploads a file to GCS and returns the object path', async () => {
  // Given a local file exists
  // When uploadToGcs(localPath, remotePath) is called
  // Then it returns the GCS object path
  // And the object exists in the bucket
  expect(true).toBe(false); // RED
});

test('uploads DOCX report after generation completes', async () => {
  // Given generate-word-report.js has finished writing a .docx
  // When the upload hook fires
  // Then the DOCX appears in GCS under reports/<sessionId>/
  expect(true).toBe(false); // RED
});

test('uploads accuracy report after scoring completes', async () => {
  // Given accuracy-report-writer has written .xlsx and .json
  // When the upload hook fires
  // Then both files appear in GCS under accuracy/
  expect(true).toBe(false); // RED
});

// ── Edge Cases ──

test('handles upload when GCS_BUCKET is not configured', async () => {
  // Given GCS_BUCKET env var is empty
  // When uploadToGcs is called
  // Then it logs a warning and returns gracefully (no crash)
  // And the local file still exists
  expect(true).toBe(false); // RED
});

test('handles upload when GOOGLE_APPLICATION_CREDENTIALS is not set', async () => {
  // Given no GCS credentials are available
  // When uploadToGcs is called
  // Then it logs a warning and returns gracefully (no crash)
  expect(true).toBe(false); // RED
});

// ── Negative Cases ──

test('does not crash when local file does not exist', async () => {
  // Given localPath points to a non-existent file
  // When uploadToGcs is called
  // Then it logs a warning and returns gracefully
  expect(true).toBe(false); // RED
});

test('does not crash when GCS bucket is unreachable', async () => {
  // Given the bucket name is invalid or network is down
  // When uploadToGcs is called
  // Then it catches the error, logs it, and returns gracefully
  // And the local file still exists (no data loss)
  expect(true).toBe(false); // RED
});

// ── Security Cases ──

test('does not expose GCS credentials in logs', async () => {
  // Given a GCS operation fails
  // When the error is logged
  // Then no private key, client email, or project ID appears in the log output
  expect(true).toBe(false); // RED
});

// ── Regression Tests ──

test('local report generation still works without GCS configured', async () => {
  // Given GCS_BUCKET is not set
  // When generate-word-report.js runs
  // Then report.docx is generated locally exactly as before
  // And report_manifest.json is generated locally
  expect(true).toBe(false); // RED
});

test('existing download endpoint still serves local files', async () => {
  // Given a session has a local .docx file
  // When /download-report?sessionId=xxx is called
  // Then the file is served from local disk (backward compatible)
  expect(true).toBe(false); // RED
});
```

---

## 9. IMPLEMENTER (Design Only — Awaiting Approval)

The implementation will create one new utility module and modify two existing files:

### [NEW] `utils/gcs-uploader.js`
- Thin wrapper around `@google-cloud/storage`
- Exports: `uploadToGcs(localPath, remotePath)` and `isGcsConfigured()`
- Reads `GCS_BUCKET` and `GOOGLE_APPLICATION_CREDENTIALS` from env
- Graceful degradation: if either is missing, logs a warning and returns without crashing
- ~60 LOC

### [MODIFY] `generate-word-report.js`
- After successful DOCX write (line 557), call `uploadToGcs()` to push the report to GCS
- Upload is fire-and-forget (does not block report generation success)
- ~10 LOC added

### [MODIFY] `server/test-runner-server.js`
- After accuracy report generation (line 793), call `uploadToGcs()` for the `.xlsx` and `.json` files
- ~10 LOC added

### [NEW] `.env.example` additions
```
# ── GCS Storage (SCC-592) ──
# GCS_BUCKET=your-bucket-name
# GOOGLE_APPLICATION_CREDENTIALS=./path-to-service-account-key.json
```

### [MODIFY] `.gitignore`
```
# GCS service account keys — NEVER commit
*.json
!package.json
!package-lock.json
!tsconfig.json
!report_manifest.json
```
Or more targeted:
```
sc-nlx-*.json
```

---

## 10. CONSEQUENCE ANALYSIS BOARD

| Change | Immediate | Short-Term | Long-Term | Rollback |
|---|---|---|---|---|
| Add `@google-cloud/storage` dependency | Bundle size increases ~2MB | New dependency to maintain | SDK updates needed periodically | `npm uninstall @google-cloud/storage` |
| Add `utils/gcs-uploader.js` | New file, no behavior change without env vars | Developers must understand GCS config | Becomes the standard upload utility | Delete the file |
| Modify `generate-word-report.js` | DOCX uploaded to GCS after generation | Reports accumulate in bucket | Bucket lifecycle policy needed | Remove the `uploadToGcs()` call |
| Modify `server/test-runner-server.js` | Accuracy reports uploaded to GCS | Results accessible from any machine | Bucket lifecycle policy needed | Remove the `uploadToGcs()` call |
| Add `GOOGLE_APPLICATION_CREDENTIALS` to env | Credential management required | Key rotation becomes a process | Consider Workload Identity Federation | Remove env var |

**Operational:** GCS costs are negligible ($0.02/GB/month for Standard storage). A typical DOCX report is ~50KB.

**Security:** The service account key (`sc-nlx-3a769a1deae5.json`) must NEVER be committed. Adding it to `.gitignore` is a **prerequisite** for this work.

**Performance:** Upload adds ~200-500ms per file. Since it happens after report generation (not during test execution), test performance is unaffected.

**Developer Experience:** Local development is completely unchanged. Without `GCS_BUCKET` set, the uploader is a no-op.

**Rollback Complexity:** One commit. Remove the `uploadToGcs()` calls and the `utils/gcs-uploader.js` file. Local behavior is unaffected.

---

## 11. DOCUMENTATION REVIEWER

Documentation updates will be added to `docs/05_Development/01_How_AgileWriter_Testing_Works.md` covering:
- Updated output pipeline diagram (showing GCS upload step)
- New env vars (`GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`)
- Rollback procedure (remove env vars → GCS upload stops → local behavior resumes)

---

## 12. LESSONS LEARNED (Framework — To Be Completed After Implementation)

- What was learned
- What assumptions were incorrect
- What surprised us
- Future preventive actions
- Reusable patterns (the `gcs-uploader.js` pattern can be reused for any future cloud storage needs)
- Anti-patterns discovered

---

## IMPLEMENTATION GUARDRAILS — STOP CONDITIONS

> [!CAUTION]
> **Implementation is BLOCKED until the following are resolved:**

1. **Bucket name** — What GCS bucket should be used?
2. **Retention policy** — How long should reports be kept in GCS?
3. **Access model** — Do stakeholders need direct download access (signed URLs)? Or is the server the only consumer?
4. **Do inputs move?** — Should `raw_qa_files/` and `reference_files/` move to GCS, or stay local-only?
5. **Environment separation** — One bucket for all environments, or separate buckets?

> [!WARNING]
> **IMMEDIATE ACTION REQUIRED (regardless of SCC-592):**
> The GCS service account key file `sc-nlx-3a769a1deae5.json` is in the project root and is **NOT in `.gitignore`**. It contains a private key. If anyone runs `git add .`, this key will be committed and pushed to GitHub and Bitbucket. **This must be added to `.gitignore` immediately.**

---

## ROLLBACK STRATEGY

**Rollback is a single commit:**
1. Remove `uploadToGcs()` calls from `generate-word-report.js` and `server/test-runner-server.js`
2. Remove `utils/gcs-uploader.js`
3. Remove `@google-cloud/storage` from `package.json`
4. Remove `GCS_BUCKET` and `GOOGLE_APPLICATION_CREDENTIALS` from `.env`

**Effect:** Application reverts to local-only storage. No data loss. No behavior change. No migration needed.

**Local disk fallback:** Even with GCS configured, all files are written locally first. If GCS upload fails, the local file is still available.

---

## DEPENDENCY REVIEW

| Package | `@google-cloud/storage` |
|---|---|
| Why needed | Official GCS SDK — only supported way to interact with GCS from Node.js |
| Alternatives | Raw HTTP to GCS JSON API (too complex), `gsutil` CLI (not embeddable in Node.js) |
| Maintenance | Actively maintained by Google Cloud team |
| Security | Audited by Google, used by millions of applications |
| Bundle impact | ~2MB added to `node_modules` (not shipped to browser) |
| Decision | **Approved** — the only reasonable choice |
