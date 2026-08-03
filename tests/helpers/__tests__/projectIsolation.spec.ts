/**
 * projectIsolation.spec.ts — SCC-556 Project Isolation Tests
 *
 * Validates that non-E2E test categories (infrastructure, unit, accuracy,
 * integration) run WITHOUT triggering the AW_00_10 setup suite.
 *
 * Also guards against regressions:
 *   - AW_11_to_20 must KEEP the setup dependency (needs auth)
 *   - Health tests must remain isolated (SCC-174 fix)
 *
 * Run with:
 *   npx playwright test tests/helpers/__tests__/projectIsolation.spec.ts --no-deps
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..', '..');

/**
 * Run `npx playwright test <args> --list` and return stdout.
 * Timeout set to 30s to account for config parsing overhead.
 */
function listTests(args: string): string {
  return execSync(`npx playwright test ${args} --list`, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 30_000,
  });
}

// ──────────────────────────────────────────────
// §1 — Isolation Tests (should FAIL before fix, PASS after)
// ──────────────────────────────────────────────

test.describe('SCC-556: Project Isolation — Non-E2E tests must not trigger AW_00_10', () => {
  test('infrastructure tests do not trigger AW_00_10 setup', () => {
    const output = listTests('tests/infrastructure/deploy.spec.ts');
    expect(output).not.toContain('AW_00_10_consolidated_flow');
    expect(output).not.toContain('[setup]');
  });

  test('helper unit tests do not trigger AW_00_10 setup', () => {
    const output = listTests('tests/helpers/__tests__/agileWriterCompat.spec.ts');
    expect(output).not.toContain('AW_00_10_consolidated_flow');
    expect(output).not.toContain('[setup]');
  });

  test('accuracy test does not trigger AW_00_10 setup', () => {
    const output = listTests('tests/accuracy.spec.ts');
    expect(output).not.toContain('AW_00_10_consolidated_flow');
    expect(output).not.toContain('[setup]');
  });

  test('integration test does not trigger AW_00_10 setup', () => {
    const output = listTests('tests/integration/develop.integration.spec.ts');
    expect(output).not.toContain('AW_00_10_consolidated_flow');
    expect(output).not.toContain('[setup]');
  });

  test('utils unit tests do not trigger AW_00_10 setup', () => {
    const output = listTests('utils/__tests__/gcs-uploader.spec.ts');
    expect(output).not.toContain('AW_00_10_consolidated_flow');
    expect(output).not.toContain('[setup]');
  });

  test('api tests do not trigger AW_00_10 setup', () => {
    const output = listTests('tests/api/server-routes.spec.ts');
    expect(output).toContain('[api]');
    expect(output).not.toContain('AW_00_10_consolidated_flow');
    expect(output).not.toContain('[setup]');
  });
});

// ──────────────────────────────────────────────
// §2 — Regression Guards (should PASS before AND after fix)
// ──────────────────────────────────────────────

test.describe('SCC-556: Regression Guards — E2E and health isolation unchanged', () => {
  test('AW_11_to_20 tests still include setup dependency', () => {
    const output = listTests('tests/AW_11_to_20_QA_folder.spec.ts');
    expect(output).toContain('AW_00_10_consolidated_flow');
    expect(output).toContain('[setup]');
  });

  test('health tests remain isolated from setup', () => {
    const output = listTests('--project=health');
    expect(output).not.toContain('AW_00_10');
  });
});

// ──────────────────────────────────────────────
// §3 — Project Routing Validation (should FAIL before fix, PASS after)
// ──────────────────────────────────────────────

test.describe('SCC-556: Project Routing — Files assigned to correct project', () => {
  test('infrastructure tests route to infrastructure project, not smarter-tests', () => {
    const output = listTests('tests/infrastructure/deploy.spec.ts');
    expect(output).toContain('[infrastructure]');
    expect(output).not.toContain('[smarter-tests]');
  });

  test('every __tests__ spec routes to the unit project, not smarter-tests', () => {
    const output = listTests('--project=unit');
    expect(output).toContain('utils\\__tests__\\gcs-uploader.spec.ts');
    expect(output).toContain('server\\__tests__\\normalizeBaseUrl.spec.ts');
    expect(output).not.toContain('[smarter-tests]');
  });
});
