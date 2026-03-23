# Agile Writer Health Check Automation — Test Plan

**Project:** Agile Writer Health Check Automation  
**Jira Parent:** SC9DE0C307-2776  
**Date:** 2026-03-23  
**Environment:** https://app-v2-rc1-aw.smarter.codes (React SPA, staging)

---

## Existing Tests (DO NOT MODIFY)

| TC   | IDs       | File                                       | Owner       | Status |
|------|-----------|--------------------------------------------|-------------|--------|
| TC0  | Setup     | `tests/AW_00_auth.setup.ts`                | Inayathulla | ✅ Done |
| TC1  | AW01–AW02 | `tests/AW_01_02_login_authentication.spec.ts` | Inayathulla | ✅ Done |
| TC2  | AW03      | `tests/AW_03_client_selection_integration.spec.ts` | Inayathulla | ✅ Done |
| TC3  | AW04      | `tests/AW_04_agile_mapping_access.spec.ts` | Inayathulla | ✅ Done |

---

## New Tests to Create (TC5–TC6)

*Note: TC4 and TC7-TC12 are postponed for now.*

| TC   | IDs       | File                                            | Description                          |
|------|-----------|-------------------------------------------------|--------------------------------------|
| TC5  | AW06–AW07 | `tests/AW_06_07_destination_template.spec.ts`   | Destination template selection       |
| TC6  | AW08–AW10 | `tests/AW_08_10_source_selection.spec.ts`       | Source selection (multi-select)      |

### Jira Comments Requirement
For each Test Case (file), include 3 to 4 Jira comments summarizing the validations mapped to Jira ACs, prefixed with `// JIRA ACTION:` or `// JIRA MAPPING:`.

### Reporting Requirement
- Run tests and then manually add Pass/Fail status and Comments into the test case Excel sheet.
- Export to PDF `AW-HealthCheckUp-features-test-case-report.pdf`.

---

## TC5 — Destination Template Handling (AW06–AW07)

**File:** `tests/AW_06_07_destination_template.spec.ts`

**Prerequisite:** Navigate to AgileMapping → Train Document page.

| # | Test                                  | Expected                                       |
|---|---------------------------------------|-------------------------------------------------|
| 1 | Veeva & SharePoint templates listed   | Template list contains both types               |
| 2 | Select one template via checkbox      | Preview appears for the selected template        |
| 3 | Single-select enforced                | Clicking another deselects the first             |
| 4 | Confirm selection                     | Navigates back to Train Document page            |

---

## TC6 — Source Selection & Preview (AW08–AW10)

**File:** `tests/AW_08_10_source_selection.spec.ts`

**Prerequisite:** On Train Document page.

| # | Test                           | Expected                                      |
|---|--------------------------------|------------------------------------------------|
| 1 | Open source dropdown           | Veeva and SharePoint sources listed            |
| 2 | Select one source              | Source appears selected                        |
| 3 | Select multiple sources        | All remain selected (multi-select supported)   |
| 4 | Click Full Preview (AW10)      | Full document preview is visible               |
| 5 | Confirm selection              | Navigates back to Train Document page          |

---

## Run Commands

```bash
# Run only the specific tests
npx playwright test tests/AW_06_07_destination_template.spec.ts --headed
npx playwright test tests/AW_08_10_source_selection.spec.ts --headed

# View report
npx playwright show-report
```
