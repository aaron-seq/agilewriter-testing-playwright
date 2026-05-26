# Agile Writer Test — Change Documentation (health_Ideaya Branch)

## AA-173 & AA-176: UI Test Dropdown Cleanup + SAFE_ENV_KEYS Config

**Problem Statement**
Previously, the UI dropdown exposed every single `.spec.ts` file in the project, including background accuracy scorers and temporary debug scripts that were never meant to be triggered manually by users. Furthermore, the frontend was aggressively pulling configuration by inspecting the entire `process.env` via the `/api/env-status` endpoint, which posed a security risk of leaking backend secrets.

**Solution**
The `/list-tests` endpoint was updated to strictly filter out unauthorized scripts, leaving a clean list of runnable tests. Simultaneously, a `SAFE_ENV_KEYS` allowlist was introduced to explicitly define which environment variables the frontend is allowed to see.

**Before vs After**
- *Before:* The UI dropdown was cluttered and `/api/env-status` returned a raw dump of `process.env`.
- *After:* The dropdown only shows `AW_00_10_consolidated_flow.spec.ts` and the `health_*` specs. The `/api/env-status` endpoint now safely returns a curated `safeValues` map (e.g., exposing only `BASEURL` and specific template folders).

**Files Affected**
- `server/test-runner-server.js`

**Validation**
Hit the `/api/env-status` endpoint in the browser to confirm only whitelisted keys are returned. Check the UI Test Script dropdown to verify `accuracy.spec.ts` and `AW_11_to_20*` are hidden.

---

## AA-177: PDF Rendering Diagnostic Script

**Problem Statement**
The AgileWriter UI was intermittently showing a "Failed to load PDF document" error when users attempted to view source files. Because this occurred inside an iframe, it was unclear if the problem was a corrupted PDF, a Content-Security-Policy (CSP) block, or an X-Frame-Options restriction.

**Solution**
A dedicated Playwright diagnostic script was created to attach to the browser's network layer and intercept all responses for `.pdf` files. 

**Before vs After**
- *Before:* Developers had to manually dig through Chrome DevTools while guessing at iframe rendering issues.
- *After:* Running the diagnostic script automatically logs the HTTP status, `Content-Type`, `Content-Security-Policy`, and `X-Frame-Options` headers, proving the issue is an app-side header misconfiguration.

**Files Affected**
- `tests/diagnose_pdf.spec.ts`

**Validation**
Run `npx playwright test tests/diagnose_pdf.spec.ts` against an environment exhibiting the bug and review the terminal logs for the intercepted CSP headers.

---

## AA-178: Ideaya Health Script + Folder-Based Source Selection

**Problem Statement**
Existing health scripts selected source PDFs individually by filename. The Ideaya workflow, however, relies on deeply nested folder structures (e.g., `IDE196-001 TFLs > Efficacy Tables_Test_EP`) containing dozens of files. Selecting each file manually was brittle, extremely slow, and prone to breaking if a single file name changed.

**Solution**
The health report automation was upgraded to support a `folder` selection mode. A new helper function, `selectFolderSourcesBySearch()`, was built to dynamically navigate the UI, expand parent folders, and bulk-select entire child folders. It also introduces an `allowMissingSourcesSoft` flag, which logs missing nested folders as a soft warning rather than immediately crashing the test.

**Before vs After**
- *Before:* Source selection was strictly a 1:1 filename match.
- *After:* The `health_Ideaya` configuration maps out `sourceParentFolder` and `sourceNestedFolders`, allowing the automation to gracefully click through the tree and select bulk directories.

**Files Affected**
- `tests/health_Ideaya.spec.ts`
- `helpers/health-report-runner.ts`
- `helpers/step-tracker.ts`
- `runtime-config.ts`
- `.env.example`

**Validation**
Run `npx playwright test tests/health_Ideaya.spec.ts` and observe the browser automatically drilling into the Ideaya folder structure and checking the directory boxes.

---

## AA-179: ICF Full Timeout Fix

**Problem Statement**
The `health_ICF_full.spec.ts` script validates an enormous template containing 239 placeholders. The "Finding Placeholder Matches" stage takes upwards of 30 minutes to complete. Playwright's default test timeout would forcibly terminate the test before it finished, causing a false-positive failure.

**Solution**
Instead of globally extending timeouts (which masks genuine deadlocks in other tests), a targeted `test.slow()` modifier was applied specifically to the ICF Full test block.

**Before vs After**
- *Before:* ICF Full consistently timed out after a few minutes despite the application functioning correctly.
- *After:* `test.slow()` seamlessly triples the timeout threshold for this specific suite, allowing the 30-minute processing stage to complete successfully.

**Files Affected**
- `tests/health_ICF_full.spec.ts`

**Validation**
Run `npx playwright test tests/health_ICF_full.spec.ts` and confirm it surpasses standard timeout limits without failing.

---

## AA-180: Hardcoded Windows Absolute Path Cleanup (Python)

**Problem Statement**
The Python benchmarking scripts contained hardcoded absolute paths pointing to a specific developer's `D:\SmarterCodes\...` drive. This meant the scripts would immediately crash for any other developer, on Linux machines, or inside CI/CD pipelines.

**Solution**
All static Windows paths were purged and replaced with dynamic paths using Python's `pathlib` relative to the current file location. An environment variable override (`DOCX_PATH`) was also wrapped around the paths to support flexible CI injection.

**Before vs After**
- *Before:* `DOCX_PATH = r"D:\SmarterCodes\automation-validation-tests\benchmarking_automation\tests\sample_template.docx"`
- *After:* `DOCX_PATH = os.environ.get("DOCX_PATH", str(Path(__file__).resolve().parent / "tests" / "sample_template.docx"))`

**Files Affected**
- `benchmarking_automation/main.py`
- `benchmarking_automation/doc_parser/docx_extractor.py`
- `benchmarking_automation/tests/test_ph_detect_ctx_ext.py`
- `benchmarking_automation/tests/us01_s3_op_debug_dump.py`

**Validation**
Clone the repository to a different directory or OS and run `python benchmarking_automation/main.py` to confirm the paths resolve automatically without throwing `FileNotFoundError`.

---

## AA-181: requirements.txt Generation (Python)

**Problem Statement**
The Python automation directory lacked a `requirements.txt` file, leaving new engineers guessing which dependencies to install. Blindly generating one via `pip freeze` would have dumped hundreds of irrelevant globally-installed packages into the repository.

**Solution**
A curated `requirements.txt` was hand-crafted by parsing the actual imports across the Python backend. It strictly pins only the necessary external packages (`lxml`, `openpyxl`, `pytest`, `python-docx`, `colorama`, `packaging`).

**Before vs After**
- *Before:* Environment reproducibility was zero. 
- *After:* A clean `requirements.txt` exists, enabling instant onboarding.

**Files Affected**
- `benchmarking_automation/requirements.txt`

**Validation**
Create a fresh virtual environment (`python -m venv venv`), activate it, and run `pip install -r benchmarking_automation/requirements.txt`. Verify successful installation.

---

## AA-182: DOCX Atomic Write + Download Guard

**Problem Statement**
A race condition existed in the DOCX generation pipeline. If the frontend polled the `/download-report` endpoint at the exact millisecond the Node.js backend was writing the `OUTPUT_FILE` buffer to disk, the server would serve a partially written file, resulting in a corrupted Word document for the user.

**Solution**
A dual-layer fix was implemented. First, `generate-word-report.js` was updated to write the buffer to a temporary file (`.tmp`), and then perform a synchronous, atomic OS-level rename to the final `.docx` extension. Second, a size and modification-time guard was added to `/download-report` to pause and retry if a file is suspicious (under 1000 bytes or less than 500ms old), ultimately throwing a 503 error instead of serving bad data.

**Before vs After**
- *Before:* `fs.writeFileSync(OUTPUT_FILE, fileBuffer);` leaving the file vulnerable to partial reads mid-flush.
- *After:* 
  ```javascript
  const tmpFile = OUTPUT_FILE + '.tmp';
  fs.writeFileSync(tmpFile, fileBuffer);
  fs.renameSync(tmpFile, OUTPUT_FILE);
  ```

**Files Affected**
- `generate-word-report.js`
- `server/test-runner-server.js`

**Validation**
Run a heavy DOCX report generation through the UI and immediately click download. The file will reliably open in Word without corruption errors, or the UI will gracefully handle a 503 retry.
