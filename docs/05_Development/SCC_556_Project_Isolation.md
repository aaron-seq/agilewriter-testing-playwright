# SCC-556 — Playwright Project Isolation: Prevent AW_00_10 Auto Execution

## Status: ✅ RESOLVED

**Date:** 2026-06-22
**Branch:** `deployment`
**Commits:** RED → GREEN → DOCS (TDD)

---

## Problem Statement

Running non-E2E tests (infrastructure, helpers, accuracy, integration) triggered the full 9-test AW_00_10 authentication suite, adding 10–20 minutes of mandatory overhead per run.

### Root Cause

`smarter-tests` was a catch-all Playwright project with `dependencies: ['setup']`. As non-browser test categories were added organically, they fell into this catch-all without re-evaluation. Playwright's dependency mechanism forced AW_00_10 to execute before every matched test.

### Evidence

| Command | Setup Tests | Own Tests | Total |
|---|---|---|---|
| `npx playwright test tests/infrastructure/deploy.spec.ts --list` | 9 ❌ | 8 | 17 |
| `npx playwright test tests/accuracy.spec.ts --list` | 9 ❌ | 1 | 10 |
| `npx playwright test tests/integration/develop.integration.spec.ts --list` | 9 ❌ | 3 | 12 |
| `npx playwright test tests/helpers/__tests__/agileWriterCompat.spec.ts --list` | 9 ❌ | 31 | 40 |

---

## ERB Architecture Decision

**Selected: Option D — Hybrid Architecture**

Follows the proven SCC-174 health isolation pattern:
1. Add dependency-free projects for non-E2E categories
2. Expand `smarter-tests` `testIgnore` to exclude carved-out categories
3. Preserve `smarter-tests` name for backward compatibility

### Alternatives Considered

| Option | Verdict | Reason |
|---|---|---|
| A — testIgnore only | ❌ Rejected | Creates test orphans (fatal) |
| B — Project per category | ✅ Safe but verbose | Over-engineered for single-file categories |
| C — Invert the model | ❌ Too risky | Renames `smarter-tests`, migration risk |
| **D — Hybrid** | **✅ Selected** | Proven pattern, no orphans, no renames |

---

## Changes Made

### playwright.config.js

Added 3 dependency-free projects:

| Project | Config | Tests Matched |
|---|---|---|
| `infrastructure` | `testDir: 'tests/infrastructure'` | deploy.spec.ts, develop.spec.ts |
| `unit` | `testDir: 'tests/helpers/__tests__'` | 6 helper/unit specs |
| `standalone` | `testMatch: /(accuracy\.spec\.ts\|integration\/)/` | accuracy.spec.ts, develop.integration.spec.ts |

Expanded `smarter-tests` `testIgnore`:

```diff
- testIgnore: /(health_.*\.spec\.ts|diagnostics\/)/
+ testIgnore: /(health_.*\.spec\.ts|diagnostics\/|infrastructure\/|helpers\/__tests__\/|integration\/|accuracy\.spec\.ts)/
```

### tests/helpers/__tests__/projectIsolation.spec.ts

7 RED/GREEN tests validating:
- Infrastructure, helper, accuracy, integration isolation (4 tests)
- AW_11_to_20 and health regression guards (2 tests)
- Project routing validation (1 test)

---

## Final Project Routing Table

| Project | Dependency | Category |
|---|---|---|
| `setup` | None | AW_00_10 auth bootstrap |
| `health` | None | Health report scripts |
| `diagnostics` | None | Debug/investigation tools |
| `infrastructure` | **None** ✅ | Shell/bash infrastructure tests |
| `unit` | **None** ✅ | Helper unit tests |
| `standalone` | **None** ✅ | Accuracy scoring, Docker integration |
| `smarter-tests` | `setup` | E2E browser tests (AW_11_to_20*) |

---

## Validation Evidence

### RED Phase (pre-fix)

```
5 failed, 2 passed
  ❌ infrastructure isolation
  ❌ helper unit isolation
  ❌ accuracy isolation
  ❌ integration isolation
  ❌ infrastructure routing
  ✅ AW_11_to_20 regression guard
  ✅ health regression guard
```

### GREEN Phase (post-fix)

```
7 passed (54.0s)
  ✅ infrastructure isolation
  ✅ helper unit isolation
  ✅ accuracy isolation
  ✅ integration isolation
  ✅ AW_11_to_20 regression guard
  ✅ health regression guard
  ✅ infrastructure routing
```

### Health Regression

```
healthIsolation.spec.ts: 4 passed (10.9s)
```

---

## Rollback Procedure

```bash
# Revert the GREEN commit (config change)
git revert <GREEN-commit-sha>

# The RED test file can remain — it will simply fail,
# documenting the regression.
```

---

## Impact Assessment

| Area | Impact |
|---|---|
| Test execution | 10 specs freed from 10-20 min AW_00_10 overhead |
| Server runtime | None (uses file paths, not --project=) |
| CI/CD | None (smarter-tests name preserved) |
| Documentation | Legacy docs already stale; active docs unaffected |
| Developer workflow | No command changes required |
