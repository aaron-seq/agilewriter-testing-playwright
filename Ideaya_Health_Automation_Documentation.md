# Ideaya Health Automation: Complete Technical Documentation

**Branch:** `health_Ideaya`
**Final Commit SHA:** `f4fb20e202641c1d3242970088826dc7f67fe801`
**Repository:** `https://bitbucket.org/smartercodes-repo/automation-validation-tests.git`
**Author:** Aaron Sequeira
**Date:** May 20, 2026
**Status:** Implementation Complete

---

## Table of Contents

1. [Background What Is This Work About?](#1-background)
2. [Why Ideaya Needed Special Treatment](#2-why-ideaya-needed-special-treatment)
3. [The Core Problem We Solved](#3-the-core-problem-we-solved)
4. [The Logic Why We Believe It Will Work](#4-the-logic--why-we-believe-it-will-work)
5. [Files Edited What, Why, and How](#5-files-edited--what-why-and-how)
6. [New File Created health_Ideaya.spec.ts](#6-new-file-created--health_ideayaspects)
7. [The Full Test Flow Step by Step](#7-the-full-test-flow--step-by-step)
8. [Consequences of These Changes](#8-consequences-of-these-changes)
9. [Merge Conflicts Why They Exist and What to Do](#9-merge-conflicts--why-they-exist-and-what-to-do)
10. [What Did NOT Change (Invariants)](#10-what-did-not-change-invariants)
11. [Validation Results](#11-validation-results)
12. [Glossary](#12-glossary)

---

## 1. Background

The AgileWriter automation suite runs end-to-end Playwright tests against the AgileWriter.ai platform. The platform allows users to select a Word/DOCX template, choose source clinical documents, run a training pipeline that maps placeholders in the template to matching sections in the sources, and then generate a final document.

Before this work, the suite had health scripts for several document types:

| Existing Script              | Document Type               | Source Selection Mode |
| ---------------------------- | --------------------------- | --------------------- |
| `health_ICF_trimmed.spec.ts` | ICF (Informed Consent Form) | File mode             |
| `health_ICF_full.spec.ts`    | ICF full version            | File mode             |
| `health_CSR.spec.ts`         | Clinical Study Report       | File mode             |
| `health_M264.spec.ts`        | Module 2.6.4                | File mode             |

None of these covered **Ideaya** documents. Ideaya is a clinical trial sponsor whose source documents live inside nested SharePoint folders rather than at the top-level file picker. This made the existing `selectSourcesBySearch()` helper which searches for individual files by name completely insufficient for Ideaya.

---

## 2. Why Ideaya Needed Special Treatment

### The Problem With File Mode

All existing health scripts use a shared helper function called `selectSourcesBySearch()`. This function:

1. Opens the source picker dialog
2. Searches for a file by its exact name
3. Clicks the matching file checkbox
4. Confirms the selection

This works perfectly when the source documents are accessible directly from the top-level search. However, Ideaya's documents are organized like this in SharePoint:

```
SharePoint Root
└── Ideaya/                        ← parent folder
    └── IND-123-Protocol/          ← source folder
        ├── Protocol_v1.docx
        ├── Protocol_v2.docx
        └── Appendix_A.pdf
```

When the file picker opens and you search for `Protocol_v1.docx`, it may not surface at the top level it is buried inside nested folders. This means:

- Searching by filename alone is unreliable
- The exact file names are not known statically in advance (they change per study)
- The correct approach is to **expand the folder tree** and select the entire study folder

### The Solution Folder Mode

Instead of selecting individual files, the Ideaya implementation selects an **entire folder**. This approach:

- Searches for the folder name (configured in `.env`)
- Expands the folder in the UI
- Selects the folder-level checkbox (which automatically includes all files inside it)
- Confirms with Done

This is called **folder mode** and it is the core architectural addition in this branch.

---

## 3. The Core Problem We Solved

Before this implementation, there was no automated health check for Ideaya documents. The risk was:

- Ideaya training runs could silently break without detection
- PDF fallback behavior for Ideaya sources was never tested
- Nested folder expansion paths had no automation coverage
- If a deployment broke Ideaya-specific flows, the test suite would not catch it

This implementation adds that coverage while:

- Keeping all existing scripts untouched
- Keeping the shared step-tracker untouched
- Using the same `.env.example` structure already in place
- Isolating all new logic so it cannot leak into other health scripts

---

## 4. The Logic: Why We Believe It Will Work

### 4.1 Folder Selection Is Deterministic

The folder name comes from `.env` via `runtimeConfig.sourceFolder` and `runtimeConfig.sourceParentFolder`. The test searches for that exact folder name in the SharePoint picker, which is the same UI all users interact with manually. If the folder exists in SharePoint and the test account has access to it, the search will surface it. This is the same determinism that existing file-mode scripts rely on — the only difference is the target is a folder, not a file.

### 4.2 The PDF Fallback Is Explicit

Ideaya source folders contain a mix of DOCX and PDF files. The AgileWriter UI has a known bug where PDF preview fails with "Failed to load PDF document" (tracked as AA-53 BUG subtask). Rather than letting this fail the entire test, the implementation handles it explicitly:

```
For each document button in the list:
  → If the filename ends in .pdf:
      → Soft-step: click it and wait for EITHER the preview wrapper OR the PDF error message
      → If error appears: log a warning and continue (do not fail)
      → continue (skip hard assertions for this file)
  → If the filename ends in .docx:
      → Hard-step: click it and expect the .docx-preview-wrapper to be visible
      → Hard-step: expect the .docx-preview__canvas to be visible
```

The `continue` statement after the PDF soft-step is critical — it ensures the hard DOCX assertions are never reached for PDF files. This is exactly what was missing in the earlier AW12 failure (the bug was that execution fell through to the hard assert even for PDF files).

### 4.3 Missing Folders Are Handled Locally

It is possible that the SharePoint environment accessed during a test run does not have the Ideaya folder configured, or the folder name in `.env` does not match any real folder. Rather than crashing the entire suite, the implementation:

- Checks whether `sourceFolder` is configured
- If not found after expanding, checks `sourceParentFolder` as a fallback
- If neither exists, logs a clear message and takes a diagnostic screenshot
- Marks the step as a soft failure so the rest of the suite can continue

This is deliberate a missing Ideaya folder is an environment configuration issue, not a code bug. The test should signal the problem clearly without blocking other health checks.

### 4.4 Isolation Prevents Regression

The entire folder-mode logic lives inside `selectFolderSourcesBySearch()` in `health-report-runner.ts`. This function is only called from `health_Ideaya.spec.ts`. The existing `selectSourcesBySearch()` function that all other scripts use is completely unchanged. Even if `selectFolderSourcesBySearch()` had a bug, it could only affect the Ideaya script — not ICF, CSR, or M264.

### 4.5 Step Tracker Remains the Source of Truth

The shared `step-tracker.ts` is the backbone of the entire automation framework. It manages how steps are recorded, classified as CRITICAL or SOFT, and reported. This implementation uses `trackStep` and `trackSoftStep` exactly as all other scripts do — no new tracking semantics, no new step categories, no modifications to the tracker itself. The Ideaya steps appear in reports the same way all other steps appear.

---

## 5. Files Edited — What, Why, and How

### 5.1 `runtime-config.ts`

**Why it was edited:**
The existing `HealthReportConfig` type only supported file-mode source selection parameters. Ideaya needed two new optional parameters to support folder-mode: `sourceFolder` and `sourceParentFolder`.

**What changed:**
Two optional fields were added to the `HealthReportConfig` interface:

```typescript
// Before (conceptual)
interface HealthReportConfig {
  reportName: string;
  templateName: string;
  templateFolder: string;
  sourceNames: string[]; // individual file names for file mode
  outputPrefix: string;
  expectedTrainingMinutes: number;
}

// After
interface HealthReportConfig {
  reportName: string;
  templateName: string;
  templateFolder: string;
  sourceNames: string[];
  sourceFolder?: string; // NEW — folder name for folder mode
  sourceParentFolder?: string; // NEW — fallback parent folder name
  outputPrefix: string;
  expectedTrainingMinutes: number;
}
```

**How it was done:**
The fields are optional (`?`) so no existing call sites needed to be updated. Scripts that do not pass `sourceFolder` continue to work identically through the existing `sourceNames` path.

**Consequence:**
TypeScript compilation passes without errors. Existing scripts are unaffected because optional fields with no default value simply resolve to `undefined`, which is ignored by the existing code paths.

---

### 5.2 `tests/helpers/health-report-runner.ts`

**Why it was edited:**
This is the shared runner that orchestrates the health report flow. It needed a new helper function to handle folder-mode source selection. The existing `selectSourcesBySearch()` function handles file-mode only.

**What changed:**
A new function `selectFolderSourcesBySearch()` was added. It:

1. Opens the source picker dialog
2. Types the folder name into the search box
3. Waits for the folder to appear in the tree
4. Attempts to expand `sourceFolder` (the primary folder)
5. If not found, attempts to expand `sourceParentFolder` (the fallback)
6. If neither is found, takes a screenshot and logs a warning (soft failure)
7. Checks the folder-level checkbox to select all files inside it
8. Clicks Done to confirm

The runner's main `runHealthReport()` function was also updated with a conditional branch:

```typescript
// Inside runHealthReport():
if (config.sourceFolder) {
  await selectFolderSourcesBySearch(
    page,
    config.sourceFolder,
    config.sourceParentFolder,
  );
} else {
  await selectSourcesBySearch(page, config.sourceNames);
}
```

**How it was done:**
The branch is a simple `if/else` guarded by whether `config.sourceFolder` is defined. Because it is optional, existing callers that do not pass `sourceFolder` always take the `else` branch (file mode), which calls the original unchanged function.

**Consequence:**
The existing `selectSourcesBySearch()` function is completely untouched. All existing health scripts continue to use it without any change. Only `health_Ideaya.spec.ts` passes `sourceFolder`, so only Ideaya ever enters the folder-mode branch.

---

### 5.3 `AgileWriter_Automation_Handbook.md`

**Why it was edited:**
This handbook is the central reference document for the automation suite. When a new health script is added, it must be registered in the handbook so other engineers know it exists, what it covers, and how to run it.

**What changed:**

- `health_Ideaya.spec.ts` was added to the **Part 1 script inventory** table with its purpose, scope, and run command
- `health_Ideaya.spec.ts` was added to the **Part 12 repository map** which lists all files in the `tests/` directory

**How it was done:**
Two sections of the markdown handbook were updated with the new entry, following the exact same format as existing entries for `health_ICF_trimmed.spec.ts`, `health_CSR.spec.ts`, and `health_M264.spec.ts`.

**Consequence:**
Any engineer reading the handbook will see Ideaya listed alongside the other health scripts and understand how to run it. No functional code was changed.

---

### 5.4 `.env.example`

**Why it was edited:**
The `.env.example` file is the template that engineers use to set up their local environment. Since Ideaya folder mode requires `SOURCE_FOLDER` and `SOURCE_PARENT_FOLDER` variables, these needed to be documented in the example file.

**What changed:**
Two new commented-out example entries were added:

```bash
# Folder name for Ideaya source selection (folder mode)
# SOURCE_FOLDER=IND-123-Protocol
# SOURCE_PARENT_FOLDER=Ideaya
```

**How it was done:**
Entries were added to the appropriate section of `.env.example` with clear comments explaining their purpose. They are commented out by default so they do not break existing setups.

**Consequence:**
Engineers setting up Ideaya runs will see exactly which variables to configure. Engineers not running Ideaya are unaffected — the commented entries do not create new required fields.

---

## 6. New File Created — `health_Ideaya.spec.ts`

This is the main deliverable of the branch. It is a Playwright test spec that runs the complete Ideaya health report pipeline end to end.

### Structure of the Test

The test is organized as a single Playwright test block with internally sequential steps tracked using `trackStep` (critical) and `trackSoftStep` (non-critical):

| Step ID | Label                        | Type     | What It Does                                                                        |
| ------- | ---------------------------- | -------- | ----------------------------------------------------------------------------------- |
| Init    | Navigation and login         | CRITICAL | Navigates to the app, authenticates via Microsoft SSO                               |
| H01     | Open AgileMapping            | CRITICAL | Opens the AgileMapping module                                                       |
| H02     | Enter output filename        | CRITICAL | Types a unique timestamped output filename                                          |
| H03     | Select template              | CRITICAL | Opens template picker, searches for Ideaya folder, selects first DOCX               |
| H04     | Select sources (folder mode) | CRITICAL | Calls `selectFolderSourcesBySearch()` to select the Ideaya source folder            |
| H05     | Start training               | CRITICAL | Clicks Start Training, waits for workspace to initialize                            |
| H06     | Document preview             | SOFT     | Opens Documents drawer, iterates each document button, verifies preview loads       |
| H06-PDF | PDF fallback                 | SOFT     | For PDF files: waits for preview OR error, logs warning if error, skips hard assert |
| H07     | Stage monitoring             | SOFT     | Waits for all 3 pipeline stages to complete (Indexing → Matching → Populating)      |
| H08     | Apply All                    | SOFT     | Clicks Apply All, validates toast confirmation, verifies placeholder colors         |
| H09     | Create Final Doc             | CRITICAL | Clicks Create Final Doc, waits for review screen to load                            |
| H10     | Save/Download                | SOFT     | Saves or downloads the generated document, validates filename                       |
| Post    | Save run config              | —        | Writes `last-run-config.json` to the reports directory for downstream tooling       |

### Why a Single Test Block?

The test runs sequentially inside a single `test()` block (not multiple `test()` calls) for a specific reason: the Ideaya training pipeline takes 10–40 minutes. If the test were split into multiple Playwright tests, each one would need to log in, start training, and wait for the workspace again. Using a single block means the browser session and workspace are shared across all steps, which is dramatically more efficient. Steps within the block use `trackStep` and `trackSoftStep` wrappers to record individual outcomes without requiring separate test blocks.

### The Placeholder Color Verification

One of the more technically complex parts of the test is verifying the **placeholder color progression** during the three pipeline stages. Placeholders in the AgileWriter template view are HTML elements with a `background-color` CSS property that changes based on their matching status:

| Color  | RGBA Value                 | Meaning                               |
| ------ | -------------------------- | ------------------------------------- |
| Grey   | `rgba(156, 163, 175, 0.2)` | Indexing in progress, not yet matched |
| Yellow | `rgba(246, 234, 59, 0.18)` | Match found, pending confirmation     |
| Green  | `rgba(16, 185, 129, 0.2)`  | Match confirmed, replacement done     |
| Blue   | `rgba(59, 130, 246, 0.18)` | Source added manually                 |
| Red    | `rgba(239, 68, 68)`        | No match found                        |

The test reads the computed CSS `background-color` of each `.doc-placeholder` element at each stage and verifies it matches the expected colors. Because stages can progress quickly, the stage 2 and 3 checks accept multiple colors (grey, yellow, green, red, blue) since some placeholders may have already advanced to a later state by the time the assertion runs.

---

## 7. The Full Test Flow — Step by Step

Here is the complete flow of what happens when `npx playwright test tests/health_Ideaya.spec.ts --headed` is run:

```
1. Browser opens
2. Navigate to AgileWriter base URL
3. Microsoft SSO login (reuses saved session cookie if valid)
4. Land on dashboard → verify "Services" heading visible
5. Click "Open AgileMapping"
6. "Train Document" screen appears
7. Enter output filename: "health_ideaya_{timestamp}"
8. Click "Select destination template"
   → Search box: type folder name from SOURCE_FOLDER env var
   → Expand folder in tree
   → Select first DOCX checkbox found inside the folder
   → Click "Select" to confirm
9. Click "Select source documents"
   → Search box: type source folder name
   → Attempt to expand SOURCE_FOLDER
   → If not found, attempt to expand SOURCE_PARENT_FOLDER
   → If neither found: screenshot + log warning + soft failure
   → Check folder-level checkbox (selects all files inside)
   → Click "Done"
10. Click "Start Training"
    → Wait for "Connecting to SharePoint..." text
    → Wait for "Generating interactive..." text
    → Wait for workspace to load (Create Final Doc button appears)
11. Open Documents drawer
    → Read "N source files ready to review"
    → Iterate each document button:
        → If PDF: soft check (preview OR error both acceptable)
        → If DOCX: hard check (.docx-preview-wrapper and canvas must appear)
12. Close Documents drawer
13. Click "Create Final Doc" (triggers pipeline)
14. Wait for placeholders to appear
15. Stage 1 — Indexing Sources:
    → Wait for Processing indicator
    → Wait for Completed indicator
    → Verify all placeholders are grey
16. Stage 2 — Finding Placeholder Matches:
    → Wait for Processing indicator
    → Wait for Completed indicator
    → Verify placeholders are yellow/grey/red/green/blue
17. Stage 3 — Populating Placeholders:
    → Wait for Processing indicator
    → Wait for Completed indicator
    → Verify placeholders are yellow/grey/red/green/blue
18. Final gate: verify no Processing indicators remain, exactly 3 Completed indicators
19. Count green (matched) placeholders
20. Click "Apply All"
    → Wait for toast: "Applied all mappings"
    → Verify placeholders turn green/grey/red/blue
21. Verify "Create Final Doc" button is now enabled
22. Click "Create Final Doc" (generate final document)
    → Wait for URL: /review?id=...
    → Wait for Review Screen heading or Save button
23. Click Save/Download
    → Verify downloaded file is .docx, .pdf, or .zip
    → Verify page shows download/save/success message
24. Write last-run-config.json to reports/ directory
25. Test complete
```

---

## 8. Consequences of These Changes

### Positive Consequences

- **Automated coverage for Ideaya** — the platform can now detect Ideaya-specific regressions automatically on every run
- **PDF failures are non-blocking** — the known AA-53 PDF rendering bug no longer crashes the Ideaya health check
- **Folder-mode is reusable** — the `selectFolderSourcesBySearch()` function can be used for any future client that organizes sources in folders
- **Zero regression risk to existing scripts** — the isolation means no existing test behavior changed

### Negative / Risk Consequences

- **Longer test run time** — the Ideaya pipeline typically takes 10–40 minutes due to large source files. This increases total suite time significantly. Consider running it in parallel or in a separate CI job
- **Environment dependency** — the test requires `SOURCE_FOLDER` and optionally `SOURCE_PARENT_FOLDER` to be correctly configured in `.env`. If misconfigured, the test soft-fails at source selection but still takes time to reach that point
- **SharePoint access dependency** — the test account must have read access to the Ideaya folder in SharePoint. If permissions change, the test will fail at source selection
- **No reference file yet** — the `raw_qa_files/` output generated by the test cannot be scored by the Python engine until an Ideaya reference file is created. This is a known pending item

---

## 9. Merge Conflicts Why They Exist and What to Do

### Why There Are Merge Conflicts

The merge conflicts are **not caused by the `health_Ideaya` branch**. They are caused by a separate set of upstream changes that were made directly to `main` (likely from the benchmarking/backend team) while this branch was being developed. Those changes restructured the Python backend repository in ways that conflict with in-flight work.

Here is a detailed breakdown of each conflict source:

---

### 9.1 `parser/` Renamed to `doc_parser/`

**What happened:**
The upstream team renamed the entire `parser/` directory to `doc_parser/` to better reflect that it handles document parsing specifically.

**Why it causes conflicts:**
If any in-flight branch (including this one, if it touched parser files) still references the old `parser/` path — in imports, configuration files, or CI scripts — those references will break. Git will also see a mass deletion of `parser/` files and a mass addition of `doc_parser/` files, which can confuse the merge algorithm into creating conflicts even if the file contents are identical.

**What to do:**
Before merging any branch into `main`, search the branch for all references to `parser/`:

```bash
grep -r "from.*parser" tests/ --include="*.ts"
grep -r "import.*parser" tests/ --include="*.ts"
```

If any references exist, update them to `doc_parser/`. Then verify Python imports in any affected `.py` files.

**Impact on `health_Ideaya`:**
This branch does not touch any parser files. The conflict risk here is for **other in-flight PRs** that do touch the parser. This branch can merge cleanly if no parser references exist in the TypeScript test files.

---

### 9.2 `normalizer/` Deleted

**What happened:**
The upstream team deleted the entire `normalizer/` directory. This directory previously contained helper functions used to normalize text extracted from documents before comparison.

**Why it causes conflicts:**
Any code that imports from `normalizer/` will break at runtime with a module not found error. This includes Python scripts that do `from normalizer import ...` and any TypeScript utilities that referenced normalizer helpers.

**What to do:**

```bash
grep -r "normalizer" . --include="*.py"
grep -r "normalizer" . --include="*.ts"
```

If any references exist, they must be updated to use the equivalent functionality from wherever it was moved to, or the logic must be inlined.

**Impact on `health_Ideaya`:**
This branch does not reference `normalizer/`. The risk is to other scripts or the Python scoring pipeline.

---

### 9.3 `conftest.py` Deleted

**What happened:**
The upstream team deleted `conftest.py`, which is a pytest configuration file that runs before all pytest tests. It typically defines fixtures, hooks, and report column customizations.

**Why it causes conflicts:**
pytest implicitly loads `conftest.py` from the project root on every run. If it is deleted:

- Any fixture defined in `conftest.py` that is used by existing tests will cause a `fixture not found` error
- Any pytest-html hooks (which customize report columns, add metadata to the HTML report, etc.) will silently stop working
- Report generation may produce incomplete or malformed HTML reports

**What to do:**
Check whether any existing pytest tests rely on fixtures from `conftest.py`:

```bash
grep -r "conftest" . --include="*.py"
```

Check if the deleted `conftest.py` had any `pytest_configure`, `pytest_runtest_makereport`, or `@pytest.fixture` definitions that are still needed. If so, the contents need to be migrated to a new location.

**Impact on `health_Ideaya`:**
This branch is entirely TypeScript/Playwright. It does not use pytest. However, if the Python scoring pipeline that processes `raw_qa_files/` output relies on pytest fixtures from `conftest.py`, that scoring pipeline will break until `conftest.py` is restored or its contents are migrated.

---

### 9.4 `placeholders/`, `models/`, and `tests/test_ph_detect_ctx_ext.py` Added

**What happened:**
Three new structural additions appeared in `main`:

- `placeholders/` — a new directory, likely containing placeholder detection logic
- `models/` — a new directory, likely containing machine learning model definitions or schema classes
- `tests/test_ph_detect_ctx_ext.py` — a new Python test for placeholder detection with context extraction

**Why it causes conflicts:**
These additions indicate the extraction engine is shifting from rule-based heuristics to model-based evaluation. Any code that previously called the old heuristic functions directly will need to be updated to use the new model-based interfaces. There is also a risk that older heuristic methods are now orphaned — still in the codebase but no longer called by anything, which creates dead code and potential confusion.

**What to do:**
Review the new `placeholders/` and `models/` interfaces. Confirm whether the Python scoring pipeline that processes `raw_qa_files/` from this branch is compatible with the new model-based approach, or whether it needs to be updated.

**Impact on `health_Ideaya`:**
The Playwright test itself is unaffected. However, the downstream Python scoring step — which takes `raw_qa_files/` output and scores it against a reference file — may need to be updated to work with the new model-based pipeline once an Ideaya reference file is created.

---

### Summary of Merge Risk Per File

| Changed Item                      | Type     | Risk Level                                | Affects `health_Ideaya`?      |
| --------------------------------- | -------- | ----------------------------------------- | ----------------------------- |
| `parser/` → `doc_parser/`         | Rename   | HIGH — breaks imports                     | No                            |
| `normalizer/` deleted             | Deletion | HIGH — breaks imports                     | No                            |
| `conftest.py` deleted             | Deletion | MEDIUM — breaks pytest hooks and fixtures | Indirectly (scoring pipeline) |
| `placeholders/` added             | Addition | LOW — additive only                       | Indirectly (future scoring)   |
| `models/` added                   | Addition | LOW — additive only                       | Indirectly (future scoring)   |
| `test_ph_detect_ctx_ext.py` added | Addition | LOW — additive only                       | No                            |

---

## 10. What Did NOT Change (Invariants)

These items were deliberately protected throughout the implementation. A reviewer can verify each one independently.

| Invariant                                       | How to Verify                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `step-tracker.ts` is unchanged                  | `git diff origin/main -- tests/helpers/step-tracker.ts` should show no changes                                                      |
| `selectSourcesBySearch()` is unchanged          | `git diff origin/main -- tests/helpers/health-report-runner.ts` should show only additions, not modifications to existing functions |
| `health_ICF_trimmed.spec.ts` behavior unchanged | Run `npx playwright test tests/health_ICF_trimmed.spec.ts --headed` — it passes                                                     |
| `health_ICF_full.spec.ts` behavior unchanged    | The file was not touched; file-mode path in runner is unmodified                                                                    |
| `health_CSR.spec.ts` behavior unchanged         | Same as above                                                                                                                       |
| `health_M264.spec.ts` behavior unchanged        | Same as above                                                                                                                       |
| No new required environment variables           | `.env.example` additions are commented out; no existing variable was modified                                                       |
| No Python backend changes                       | `git diff origin/main -- **/*.py` should show no changes from this branch                                                           |

---

## 11. Validation Results

All three validation commands were run on the final branch state before pushing.

| Command                                                         | Result               | Notes                                           |
| --------------------------------------------------------------- | -------------------- | ----------------------------------------------- |
| `npx tsc --noEmit`                                              | ✅ PASSED — 0 errors | Full TypeScript compilation clean               |
| `npx playwright test tests/health_Ideaya.spec.ts --headed`      | ✅ PASSED            | Folder mode, PDF fallback, all stages, download |
| `npx playwright test tests/health_ICF_trimmed.spec.ts --headed` | ✅ PASSED            | Confirms legacy file-mode path is unbroken      |

---

## 12. Glossary

| Term                                | Meaning                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **File mode**                       | Source selection method where individual files are searched and selected by name                     |
| **Folder mode**                     | Source selection method where an entire SharePoint folder is selected, including all files inside it |
| **`trackStep`**                     | Wrapper that records a CRITICAL step — if it fails, the test fails                                   |
| **`trackSoftStep`**                 | Wrapper that records a SOFT step — if it fails, the failure is logged but the test continues         |
| **`step-tracker.ts`**               | The shared module that implements `trackStep` and `trackSoftStep`                                    |
| **`selectSourcesBySearch()`**       | The original file-mode source selection helper, used by all legacy scripts                           |
| **`selectFolderSourcesBySearch()`** | The new folder-mode source selection helper, used only by `health_Ideaya.spec.ts`                    |
| **`HealthReportConfig`**            | TypeScript interface defining the configuration object passed to `runHealthReport()`                 |
| **`.doc-placeholder`**              | CSS class on template placeholder elements whose `background-color` reflects matching status         |
| **`raw_qa_files/`**                 | Directory where the health script writes its QA output for downstream Python scoring                 |
| **AA-53 BUG subtask**               | Tracked Jira bug for the known PDF preview failure in the AgileWriter UI                             |
| **`sourceFolder`**                  | The primary SharePoint folder name configured in `.env` for Ideaya                                   |
| **`sourceParentFolder`**            | The fallback parent folder name if `sourceFolder` is not found directly                              |
| **Merge base conflict**             | A conflict caused by two branches diverging from a common ancestor and making incompatible changes   |
