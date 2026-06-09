Document Status: Canonical
Canonical Scope: Define repository structure, maintainership, and modification rules
Owner: Documentation Team
Related Legacy Docs: 
- docs/legacy/original_docs/AgileWriter_Automation_Handbook.md
- docs/legacy/original_docs/Ideaya_Health_Automation_Documentation.md

Last Reviewed: 2026-05-25

Source Documents:
- Repository source tree
- onboarding review sessions

# Codebase Map

## Architecture Philosophy

This repository is not a single application. It is a dual-ecosystem validation suite:
1. **Node.js/Playwright:** Frontend orchestration, UI, and browser automation.
2. **Python:** Backend accuracy scoring and DOCX/XML extraction.

This document maps folders to responsibilities, identifies execution entry points, and provides safe modification rules.

## Repository Structure and Ownership

| Folder | Responsibility | Primary Entry Point | Primary Maintainer | Change Frequency | Modification Difficulty | Risk Level | Notes | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `server/` | Express orchestration backend | `test-runner-server.js` | Repository Maintainers | Low | Expert | High | Execution boundary for UI payloads | Inferred |
| `ui/` | Local QA execution dashboard | `index.html` | Shared | Medium | Moderate | Medium | Onboarding relevance | Inferred |
| `tests/` | Playwright automation specs | `health_*.spec.ts` | Automation Contributors | High | Moderate | Medium | Core automation suite | Inferred |
| `benchmarking_automation/` | Python accuracy pipeline | `main.py` | Shared | Medium | Difficult | Low | Isolated ecosystem | Inferred |
| `reports/` | Transient output storage | Generated output only | TBD | High | Easy | None | Git-ignored local output only | Verified |

## Cross-Folder Dependencies

Dependency Direction:
A → B means A depends on B.

* `ui/`
  → server execution layer
* `server/`
  → runtime configuration
* `tests/`
  → helper utilities
  → reporting pipeline
* `benchmarking_automation/`
  → independent execution

## If You Need To Change X

Use this matrix before changing code to understand dependencies, testing requirements, impact scope, and rollback strategy.

| Task | Files | Validation Required | Failure Risk | Blast Radius | Rollback Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Change timeout behavior** | `playwright.config.js`, `runtime-config.ts` | Verify a health script completes without premature termination. | High | Repository-wide | Restore previous config |
| **Add reporting capability** | `tests/helpers/`, `server/` | Run an existing script and verify report output formatting. | Medium | High | Revert reporting helper changes |
| **Modify training synchronization** | `tests/*.spec.ts` | Execute script and ensure Playwright correctly waits for AI generation. | High | Medium | Revert spec modifications |
| **Add dashboard action** | `ui/index.html`, `ui/script.js`, `server/test-runner-server.js` | Click UI action and verify backend routes request without errors. | Medium | Medium | Revert dashboard assets and server routes |
| **Add environment variable** | `.env`, `.env.example`, `Environment_Configuration.md` | Start server and execute script to ensure variable resolves. | High | Repository-wide | Revert `.env.example` and documentation |
| **Add health script** | `tests/`, `.env` | Discover script via CLI and trigger for end-to-end success. | Medium | Medium | Remove spec file |
| **Add Python benchmark** | `benchmarking_automation/models/`, `benchmarking_automation/main.py` | Run benchmark script against known test documents. | Low | Low | Remove benchmark schema and logic |

## Safe Extension Points

These locations are areas designed to minimize expected cross-impact.

Changes still require validation.
Extension safety is not guaranteed.

* `tests/`
  → Run at least one existing health script.
* `ui/styles.css`
  → Verify execution dashboard usability.
* `benchmarking_automation/models/`
  → Validate benchmark output.

## Global Files (High Blast Radius)

Do not touch these files lightly. Modifying them alters the baseline behavior of the entire health suite.

* **`global-setup.js`**: Repository-wide initialization behavior.
* **`runtime-config.ts`**: Global execution parameters affecting all active test runs.
* **`playwright.config.js`**: Baseline behavior for browser contexts, retries, and worker orchestration.
* **`package.json` / `package-lock.json`**: Dependency versions that govern execution environment determinism.

## Common Anti-Patterns

* hardcoding credentials
* bypassing runtime config
* writing reports outside `reports/`
* modifying generated outputs
* duplicating environment variables
* editing generated artifacts
* editing legacy docs instead of canonical docs
* storing credentials in repository
* changing runtime config inside tests
* committing generated reports

## Read This Before Editing

* Need execution? → [Quick_Start.md](../00_Getting_Started/Quick_Start.md)
* Need architecture? → [Architecture.md](../00_Getting_Started/Architecture.md)
* Need env? → [Environment_Configuration.md](Environment_Configuration.md)
* Need failures? → [Troubleshooting.md](../04_Operations/Troubleshooting.md)

## Repository Change Rules

Repository changes should:

- preserve historical context
- keep environment variables centralized
- prefer extension over mutation
- avoid introducing hidden configuration
- update docs alongside code
- maintain onboarding path integrity

## Historical Context

Historical docs remain preserved but are not canonical.
Canonical docs define current behavior.
Historical docs explain historical behavior.

Historical docs preserve:
- implementation decisions
- failed experiments
- migration context
- historical debugging knowledge

Use legacy docs for:
* debugging old behavior
* understanding migration decisions
* investigating historical failures
* analyzing race conditions

* `docs/legacy/original_docs/AgileWriter_Automation_Handbook.md`
* `docs/legacy/original_docs/Ideaya_Health_Automation_Documentation.md`

---

Next:

[Environment_Configuration.md](Environment_Configuration.md)
