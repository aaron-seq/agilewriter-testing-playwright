# 04. Test Folder Guide

Why do we separate tests into different folders?

* **`tests/e2e/` (End-to-End)**
  * **Location:** `tests/AW_00_10_consolidated_flow.spec.ts` (Target: `tests/e2e/`)
  * **Purpose:** Verifies that a real user can complete a full document generation flow. 
  * **The Problem It Solves:** The API might return `200 OK`, but the "Submit" button on the UI might be covered by an invisible `<div>`. E2E tests launch a real browser and click the real button to catch this.

* **`tests/integration/`**
  * **Location:** `tests/integration/develop.integration.spec.ts`
  * **Purpose:** Verifies that `develop.sh` starts Docker, waits for a healthy state, validates `/api/env-status`, and supports clean teardown.
  * **The Problem It Solves:** Imagine `develop.sh` starts Docker correctly, but the Express server inside it crashes on boot. A Component test won't catch that because it only tests isolated JavaScript. An Integration test actually tries to talk to the live server after Docker starts.

* **`tests/component/`**
  * **Location:** `tests/helpers/__tests__/validateHealthEnv.spec.ts` (Target: `tests/component/`)
  * **Purpose:** Verifies internal logic functions without needing a browser or network connection.
  * **The Problem It Solves:** You wrote a function that checks an environment variable. Booting up Chrome, logging in, and uploading a document just to test string validation takes 5 minutes. A Component test directly calls the TypeScript function and finishes in 0.05 seconds.

* **`tests/api/`**
  * **Location:** `tests/api/`
  * **Purpose:** Verifies JSON endpoints directly.
  * **The Problem It Solves:** You want to ensure the `/run-test` endpoint properly rejects unauthorized users. Doing this via the UI is slow and flaky. API tests hit the endpoints directly using HTTP.

* **`tests/health/`**
  * **Location:** `tests/health_Ideaya.spec.ts` (Target: `tests/health/`)
  * **Purpose:** Verifies that client-specific templates and source folders exist and match the `.env` configuration.
  * **The Problem It Solves:** A client renames a SharePoint folder from `Templates` to `Old_Templates`. The code is fine, but the system breaks. Health scripts run against live client environments periodically to ensure the required files and folders are exactly where we expect them.
