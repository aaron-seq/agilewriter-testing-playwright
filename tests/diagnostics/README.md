# Diagnostic Scripts

One-off debugging and investigative tools for the Agile Writer test suite.
**These are NOT regression tests.** They contain no `expect()` assertions and
will never fail CI. They exist to help engineers manually investigate specific
issues when needed.

---

## How to run

Run all diagnostics:

```bash
npx playwright test --project=diagnostics --headed
```

Run a single script:

```bash
npx playwright test tests/diagnostics/diagnose_pdf.spec.ts --headed
npx playwright test tests/diagnostics/find_folder.spec.ts --headed
npx playwright test tests/diagnostics/find_ideaya_folder.spec.ts --headed
```

> **Note:** These scripts are designed for `--headed` mode so you can
> visually interact with the browser during the investigation.

---

## What each script does

### `diagnose_pdf.spec.ts`
- **Jira:** AA-177 (PDF rendering bug investigation)
- **Purpose:** Attaches browser console error listeners and network response
  interceptors for PDF URLs. Captures `Content-Security-Policy`,
  `X-Frame-Options`, and status codes for any PDF-related network requests.
- **When to use:** When PDF documents fail to render in the AgileWriter
  preview pane and you need to capture the HTTP headers to diagnose
  CSP or framing issues.
- **How it works:** Navigates to AgileMapping via stored auth, then waits
  60 seconds for you to manually navigate to a PDF document.

### `find_folder.spec.ts`
- **Jira:** Ideaya environment variable fix
- **Purpose:** Dumps all "Expand" button labels from the SharePoint file
  tree in the destination template picker.
- **When to use:** When you need to discover the exact SharePoint folder
  name for a new `HEALTH_TEMPLATE_FOLDER_*` environment variable — the
  folder name must match what the UI renders, which may differ from what
  you see in SharePoint directly.
- **How it works:** Opens AgileMapping → clicks "Select destination
  template" → scrapes all Expand button text from the DOM.

### `find_ideaya_folder.spec.ts`
- **Jira:** Ideaya environment variable fix
- **Purpose:** Performs a full standalone login (not using stored auth),
  navigates to the SharePoint document picker, and scrapes all DOM elements
  containing the word "Template". Saves a full-page screenshot.
- **When to use:** When stored auth doesn't work or you need to verify
  folder visibility from a fresh login session.
- **How it works:** Logs in from scratch using `BASEURL`,
  `TEST_USER_EMAIL`, and `TEST_USER_PASSWORD` env vars. Screenshot saved
  to `diagnostics/ideaya_folder_search.png`.

---

## Why these are separate from regular tests

These scripts are excluded from:
- The **UI test dropdown** (`/list-tests` only reads top-level `tests/`)
- The **`smarter-tests`** project (via `testIgnore` in `playwright.config.js`)
- The **`health`** project (via `testMatch` pattern)
- The **`setup`** project (via `testMatch` pattern)

They are only reachable via the `diagnostics` project or by specifying
the file path directly. This keeps them available for future debugging
without cluttering the normal test workflow.
