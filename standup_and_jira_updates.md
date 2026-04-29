# Standup, JIRA, Error Analysis & Script Comparison

---

## 📅 Daily Standup: Monday, April 28, 2026

**Last Week (Thursday–Friday):**
- Cherry-picked and merged 6 static-analysis fix commits from the Codex worktree onto `enhanced-automation-tests`. All fixes applied cleanly with zero merge conflicts.
- Pushed to Bitbucket (`enhanced-automation-tests`) and GitHub (`main`) — both at `62889f3`.
- Fixed CSR source filename: `Mock_CSR_Tables_30Oct25.rtf` → `Mock_CSR _Tables_30Oct25.rtf` (missing space). Committed as `cd48fbb`, pushed to all remotes.
- `npx tsc --noEmit` = 0 TypeScript errors confirmed.
- Reviewed both QA Excel files (`CSRTestEP_07Apr_raw_qa.xlsx` and `QA report_ICF_FULL_new version.xlsx`) and drafted the AI Placeholder Verification Plan.
- Created the Codex GPT-5.5 prompt for the accuracy scorer implementation (~1,800 tokens).
- Researched and documented `distill` CLI tool for token compression.

**Today:**
- Meeting with Inayathulla and Anil to walk through the Placeholder Verification Plan.
- Received Anil's confirmation: the 6 missing placeholders can remain blank (no expected values available even for manual QA).
- Creating the Placeholder Reference File by bootstrapping from `QA report_ICF_FULL_new version.xlsx`.
- Analyzing error context for CSR and M264 health scripts to prepare for supervised debug runs.
- Reviewing `AW_11_to_20_QA_folder` vs `AW_11_to_20_manual_input` scripts to understand why manual failed.

**Blockers:**
- NONE — all code changes are pushed and synced.

---

## 📅 Daily Standup: Tuesday, April 29, 2026

**Yesterday (Monday):**
- Finalized the AI Placeholder Verification Plan.
- Documented error contexts for CSR/M264 and QA vs Manual script comparison.

**Today:**
- **Accuracy Scorer Deployed & Verified**: Worked with Codex to build and refine the AI Placeholder Verification Scorer. It now successfully handles duplicate placeholders (using array-based best-match logic) and uses type-specific thresholds (0.65 for Paragraphs).
- **Test Results**: Verified the improvements locally against the ICF Full QA report. Paragraph accuracy increased from 2.3% to 9.3%, proving the new thresholds correctly surface "Partial Matches".
- **Code Merged**: All scorer files and the `AW_11_to_20_manual_input.spec.ts` hotfix were merged cleanly. Branch `enhanced-automation-tests` is fully synced with Bitbucket and GitHub `main`.
- **Cloud Migration Meeting Prep**: Prepared a comprehensive Cloud Migration Guide for our upcoming meeting with Paras and Inayathulla. The guide details our requirements for long-running compute (AKS/GKE/ACI), MFA authentication bypass strategies for the service account, Test Runner UI hosting options, and Cloud Storage setup for Anil ji's reports.

**Blockers:**
- NONE. We are ready for the cloud migration meeting.

---

## 📅 Weekly Work Plan (April 28 – May 2, 2026)

| Day | Focus Area | Deliverables |
|-----|-----------|-------------|
| **Mon Apr 28** | Planning & analysis | ✅ Finalize verification plan, analyze CSR/M264 errors, compare QA vs manual scripts |
| **Tue Apr 29** | Accuracy scorer implementation | Run Codex prompt → generate 4 files, review output, install deps, `tsc` verify |
| **Wed Apr 30** | Scorer testing + CSR/M264 debug | Test scorer against ICF Full data, compare with Anil's report. Debug CSR/M264 file selection in headed mode |
| **Thu May 1** | Pipeline integration + supervised run | Wire accuracy scorer into test UI, run full supervised pipeline with Inayathulla (ICF Trimmed + ICF Full + CSR + M264) |
| **Fri May 2** | Documentation + demo | Update handbook, create walkthrough for accuracy scorer, demo to Anil & Inayathulla, push final commits |

---

## 🔍 Error Context Analysis: CSR & M264

### CSR Health Script — Error Context

**Script**: `health_CSR.spec.ts` → calls `runHealthReport()` → calls `selectSourcesBySearch()`

**Root Cause (FIXED April 27)**:
The source filename was `Mock_CSR_Tables_30Oct25.rtf` (no space) but the actual SharePoint filename is `Mock_CSR _Tables_30Oct25.rtf` (with space after CSR). The search-first file selection typed the wrong filename → SharePoint returned 0 results → the expand button for folder `CSR` never appeared → **timeout at Step 4** (`Select sources`).

**Fix committed**: `cd48fbb` — corrected the filename.

**Remaining Risk Points (in order of likelihood)**:
1. **Template name**: `CSR_Template_20FEB2026.docx` — unverified in live SharePoint. If the date suffix changed, template selection will timeout.
2. **Template folder**: `CSR` — assumed correct but never confirmed via SharePoint screenshot.
3. **Source folder**: `CSR` — same assumption.
4. **Tab**: No `templateTab` is set, so it defaults to `Clinical`. If CSR documents are under `Non-Clinical`, template selection will fail.
5. **Other source filenames**: `Mock_CSR_Protocol.docx` and `Mock_CSR Key messages_with_heading.docx` — assumed correct but also have unusual naming (spaces/underscores).

**Recommendation**: Run in `--headed` debug mode first:
```bash
npx playwright test tests/health_CSR.spec.ts --headed --debug
```
Watch the file picker at Steps 3 and 4 to confirm:
- Does `CSR` folder appear after searching for the template?
- Does each source filename match exactly?

---

### M264 Health Script — Error Context

**Script**: `health_M264.spec.ts` → calls `runHealthReport()` → calls `selectSourcesBySearch()`

**Known Issue (from conversation history)**:
The M264 folder shows as `Module264` in SharePoint search results but `M264` in the folder tree. We reverted `sourceFolder` to `'M264'` (commit `613c0e1`) per live SharePoint screenshot confirmation.

**Current Config**:
```typescript
templateName: '2.6.4 Template_Test.docx'
templateFolder: 'M264'
sourceFolder: 'M264'
templateTab: 'Non-Clinical'   // ← Correctly set
sourceNames: [
  'Absorption_PK Study in Dog.docx',
  'Metabolism_Report.docx',
  'ABC-123_Summary and Conclusion.docx',
  'DDI_Cyp_Report.docx',
  'ABC-123_Method of Analysis.docx',
  'Distribution_Blood Partitioning.docx',
  'Absorption_PK Study in Rat.docx'
]
```

**Likely Failure Points**:
1. **Source selection (Step 4)**: With 7 source files, the script calls `selectSourcesBySearch()` 7 times. Each call:
   - Types filename in search box
   - Waits for `Expand M264` button (20s timeout)
   - Expands the folder
   - Checks the file checkbox
   
   **Problem**: After the first file is selected and the folder is expanded, the search box clears and the folder collapses. On the 2nd search, the folder name in search results might show as `Module264` instead of `M264`, causing the `Expand M264` button locator to fail.

2. **7-file iteration**: If any single file is not found, the entire step fails. With 7 files, the probability of at least one mismatch is high.

3. **Folder name discrepancy**: The `Expand ${sourceFolder}` locator uses the exact string `Expand M264`. If SharePoint search shows the folder as `Module264`, this locator will timeout.

**Recommendation**: Run in `--headed` debug mode and watch the first 2 source file selections:
```bash
npx playwright test tests/health_M264.spec.ts --headed --debug
```
If the folder appears as `Module264` in search, we need to add a fallback:
```typescript
const expandButton = page.getByRole('button', { name: `Expand ${sourceFolder}` })
  .or(page.getByRole('button', { name: `Expand Module264` }));
```

---

## 📋 AW_11_to_20_QA_folder vs AW_11_to_20_manual_input — Full Comparison

### What They Share
Both scripts perform the **same 10 test steps** (AW_11 through AW_20):
1. Login + Navigate to AgileMapping
2. Enter output filename
3. Select template
4. Select source documents
5. Start training
6. Wait for 3 stages (Indexing → Matching → Populating)
7. Apply All mappings
8. Mapping Controls verification (source add/remove, writing instructions)
9. Create Final Document
10. Save/Download

### What's Different

| Aspect | QA Folder (`AW_11_to_20_QA_folder.spec.ts`) | Manual Input (`AW_11_to_20_manual_input.spec.ts`) |
|--------|------|------|
| **Template selection** | Picks the FIRST file found in `QA Testing` folder | Uses `manualTemplateName` + `manualTemplateFolder` from runtime-config.json |
| **Source selection** | Checks the **entire `QA Testing` folder** checkbox | Either MODE A (QA folder) or MODE B (individual files with nested folder paths) |
| **Tab switching** | No — assumes Clinical | Yes — supports `manualTemplateTab: 'Non-Clinical'` |
| **Nested folders** | No — flat QA Testing folder only | Yes — supports `ParentFolder/ChildFolder/DeepFolder` paths |
| **Config source** | `runtimeConfig.folder` (defaults to `QA Testing`) | `runtimeConfig.manualTemplateName`, `manualTemplateFolder`, `manualSourceFiles[]` |
| **Health script generation** | No | Yes — auto-generates `health_[Name].spec.ts` after successful run |
| **AW_13–18 steps** | Full: Source add (PENDING ADD), source remove, instruction edit, transform, save | Simplified soft steps: mapping controls, remove source, writing instructions only |
| **Complexity** | 1197 lines, battle-tested | 555 lines, cleaner but less hardened |
| **Error handling** | `createReadyQaTrainingSession()` with 2 retry attempts | No retry — fails immediately on any step |
| **Auth flow** | Inline Microsoft SSO click + redirect wait | Uses `openAgileMapping()` helper (same SSO but via helper) |
| **Modal overlay** | Has `dismissModalOverlay()` before Create Final Doc | **Does NOT have `dismissModalOverlay()`** ← potential failure point |

### How Manual Input Works (Step by Step)

1. **Reads `runtime-config.json`** for manual fields:
   ```json
   {
     "manualTemplateName": "CSR_Template_20FEB2026.docx",
     "manualTemplateFolder": "CSR",
     "manualTemplateTab": "Clinical",
     "manualSourceFiles": [
       { "name": "Mock_CSR _Tables_30Oct25.rtf", "folder": "CSR" },
       { "name": "Mock_CSR_Protocol.docx", "folder": "CSR" }
     ],
     "useQaFolderForSources": false,
     "generatedScriptName": "CSR"
   }
   ```

2. **Validates required fields** (line 355-360): throws immediately if `manualTemplateName` or `manualTemplateFolder` is missing.

3. **Selects template via `selectManualTemplate()`**:
   - Opens template picker
   - Switches tab if `Non-Clinical`
   - Types template name in search box
   - Calls `expandNestedFolders()` to expand each path level
   - Checks the exact file checkbox
   - Clicks `Select [ENTER]`

4. **Selects sources via `selectManualSources()`**:
   - **MODE A** (`useQaFolderForSources: true`): Same as QA folder script — checks entire folder
   - **MODE B** (default): Loops each file in `manualSourceFiles[]`, searches by name, expands nested folder, checks individual file checkbox

5. **Runs the same training pipeline** (stages, apply all, create final doc)

6. **Post-test**: Saves run config to `reports/last-run-config.json` and **auto-generates a health script** (`health_[Name].spec.ts`) with all values hardcoded.

### Why Manual Script May Have Failed

Most likely causes (in order):

1. **Missing `dismissModalOverlay()`** (line 341-347): The manual script's `openFinalDocumentFlow()` does NOT call `dismissModalOverlay()` before clicking `Create Final Doc`. If a modal overlay appears (which it does intermittently), the click is intercepted and the test times out.

2. **Missing runtime-config fields**: If `manualTemplateName` or `manualTemplateFolder` is not set in `runtime-config.json`, the script throws immediately at line 356.

3. **Dialog close race condition**: The manual script waits for `dialog` to be hidden after template/source selection. If the dialog closing animation is slow or a new dialog appears, this can fail.

4. **No retry mechanism**: Unlike the QA folder script which has `createReadyQaTrainingSession()` with 2 retry attempts, the manual script fails on the first error.

5. **Current `runtime-config.json` has QA Testing values**: The current config file has `template: "ICF_SET0_TRIMMED.docx"` and `source: "Protocol Example (28Sep2023).docx"` — these are QA Testing values, not manual values. The `manualTemplateName` field is not set, so the script would throw the validation error.

### Fix Needed for Manual Script

```diff
// Line 341-347 in AW_11_to_20_manual_input.spec.ts
async function openFinalDocumentFlow(page: Page): Promise<void> {
  await expect(createFinalDocButton(page)).toBeEnabled({ timeout: 300_000 });
+ await dismissModalOverlay(page);
  await createFinalDocButton(page).click();
```

And add `dismissModalOverlay` to the import on line 28:
```diff
-import { openAgileMapping, isVisible, waitForApplyAllToast } from './helpers/app-navigation';
+import { openAgileMapping, isVisible, waitForApplyAllToast, dismissModalOverlay } from './helpers/app-navigation';
```

---

## 📝 JIRA Comments & New Subtask

### [AA-163] Health Report Scripts — Update

> **Status: In Progress**
>
> **Progress (April 28):**
> - CSR source filename fix committed (`cd48fbb`) — `Mock_CSR _Tables_30Oct25.rtf` (space after CSR).
> - CSR script is code-complete. Needs supervised headed run to verify template/source selection.
> - M264 script has a potential folder name discrepancy (`M264` vs `Module264` in SharePoint search). Documented fallback strategy.
> - Both CSR and M264 need `--headed --debug` verification before marking as passing.
>
> **Next Steps:**
> - Schedule supervised debug runs for CSR and M264 with Inayathulla (target: Wed Apr 30).
> - If M264 folder name issue confirmed, implement `Expand M264 | Expand Module264` fallback locator.
>
> **Blockers:** None — waiting for scheduled supervised run.

---

### [AA-118] AW_11_to_20 Restructure — Update

> **Status: In Progress**
>
> **Progress (April 28):**
> - Compared QA folder (`AW_11_to_20_QA_folder.spec.ts`, 1197 lines) and manual input (`AW_11_to_20_manual_input.spec.ts`, 555 lines) scripts.
> - Identified that the manual input script is **missing `dismissModalOverlay()`** before Create Final Doc — this is the most likely cause of its failure.
> - Manual script also lacks retry mechanism and has a stricter config validation gate.
> - Fix is a 2-line change (add import + call `dismissModalOverlay()`).
>
> **Next Steps:**
> - Apply the `dismissModalOverlay()` fix to the manual input script.
> - Set up `runtime-config.json` with proper manual fields for a test run.
> - Run manual script in headed mode to verify end-to-end.
>
> **Blockers:** None.

---

### NEW SUBTASK: [AA-170] AI Placeholder Verification Scorer (Proposed)

> **Title:** Implement Automated QA Accuracy Scoring Pipeline
>
> **Description:**
> Build an automated system that replaces Anil's manual QA verification process. The system reads AgileWriter's raw QA Excel export, compares AI-replaced text against a human-approved Reference File, and generates a structured QA Report Excel matching Anil's existing template format.
>
> **Acceptance Criteria:**
> - [ ] Reference File created and approved for ICF Full (73 placeholders, 67 with expected values)
> - [ ] `reference-file-loader.ts` — loads Reference File into lookup map
> - [ ] `accuracy-scorer.ts` — scores all 5 placeholder types (KeyValue, Paragraph, List, Table, Inline)
> - [ ] `accuracy-report-writer.ts` — generates 8-sheet QA Report Excel
> - [ ] `accuracy.spec.ts` — runnable from UI dropdown and CLI
> - [ ] `npx tsc --noEmit` = 0 errors
> - [ ] Output matches Anil's manual QA report format (validated against `QA report_ICF_FULL_new version.xlsx`)
> - [ ] Console dashboard shows per-type accuracy percentages
>
> **Dependencies:** AA-163 (health scripts must pass to generate QA Excel input)
>
> **Estimated Effort:** 3 days (implementation + testing + demo)

---

### [AA-165] Documentation — Update

> **Status: In Progress**
>
> **Progress (April 28):**
> - Documented Test Runner UI architecture (`server/test-runner-server.js` + `ui/index.html`).
> - Added distill CLI tool documentation for Codex token optimization.
> - Created Codex GPT-5.5 prompt (~1,800 tokens) for accuracy scorer implementation.
> - Documented full QA report Excel structure (8 sheets, 45 columns) and scoring logic.
>
> **Next Steps:**
> - Update handbook with accuracy scorer usage guide after implementation.
> - Add AW_11_to_20 QA vs Manual comparison to the walkthrough.
>
> **Blockers:** None.
