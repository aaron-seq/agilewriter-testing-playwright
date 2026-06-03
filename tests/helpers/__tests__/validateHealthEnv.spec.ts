/**
 * validateHealthEnv.spec.ts — Red Phase Tests for SCC-177
 *
 * These tests validate the validateHealthEnv() function contract:
 * - Throws with missing var names when env vars are absent
 * - Does NOT throw when all required vars are present
 * - Covers ideayaPreflight config (PRODTEST vars included)
 *
 * RED PHASE: All tests MUST FAIL because the stub throws 'Not implemented'.
 * SCC-178 (Green Phase) will implement the logic to make these pass.
 *
 * ⚠️  ALWAYS run with --no-deps to prevent triggering E2E setup chain:
 *   npx playwright test tests/helpers/__tests__/validateHealthEnv.spec.ts --no-deps
 * Running WITHOUT --no-deps will trigger AW_00_10 full E2E flow (18 tests)
 */

import { test, expect } from '@playwright/test';
import { validateHealthEnv, HealthConfigKey } from '../validateHealthEnv';

// ──────────────────────────────────────────────
// ENV VAR CONTRACTS — source of truth for required vars per config
// ──────────────────────────────────────────────

const REQUIRED_VARS: Record<HealthConfigKey, string[]> = {
  csr: [
    'HEALTH_TEMPLATE_CSR',
    'HEALTH_TEMPLATE_FOLDER_CSR',
    'HEALTH_SOURCES_CSR',
    'HEALTH_SOURCE_FOLDER_CSR',
  ],
  icfFull: [
    'HEALTH_TEMPLATE_ICF_FULL',
    'HEALTH_TEMPLATE_FOLDER_ICF_FULL',
    'HEALTH_SOURCES_ICF_FULL',
    'HEALTH_SOURCE_FOLDER_ICF_FULL',
  ],
  icfTrimmed: [
    'HEALTH_TEMPLATE_ICF_TRIMMED',
    'HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED',
    'HEALTH_SOURCES_ICF_TRIMMED',
    'HEALTH_SOURCE_FOLDER_ICF_TRIMMED',
  ],
  ideaya: [
    'HEALTH_TEMPLATE_IDEAYA',
    'HEALTH_TEMPLATE_FOLDER_IDEAYA',
    'HEALTH_SOURCE_FILE_IDEAYA',
    'HEALTH_SOURCE_PARENT_FOLDER_IDEAYA',
    'HEALTH_SOURCE_NESTED_FOLDERS_IDEAYA',
  ],
  ideayaPreflight: [
    'HEALTH_TEMPLATE_IDEAYA_PREFLIGHT',
    'HEALTH_TEMPLATE_FOLDER_IDEAYA_PREFLIGHT',
    'HEALTH_PARENT_FOLDER_IDEAYA_PREFLIGHT',
    'HEALTH_CLIENT_IDEAYA_PREFLIGHT',
  ],
  ideayaProdtestCsr: [
    'HEALTH_TEMPLATE_IDEAYA_PRODTEST_CSR',
    'HEALTH_TEMPLATE_FOLDER_IDEAYA_PRODTEST_CSR',
    'HEALTH_TEMPLATE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR',
    'HEALTH_SOURCES_IDEAYA_PRODTEST_CSR',
    'HEALTH_SOURCE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR',
  ],
  m264: [
    'HEALTH_TEMPLATE_M264',
    'HEALTH_TEMPLATE_FOLDER_M264',
    'HEALTH_SOURCES_M264',
    'HEALTH_SOURCE_FOLDER_M264',
  ],
};

test.describe('validateHealthEnv()', () => {
  // Save original env so we can restore after each test
  let originalEnv: NodeJS.ProcessEnv;

  test.beforeEach(() => {
    originalEnv = { ...process.env };
  });

  test.afterEach(() => {
    process.env = originalEnv;
  });

  // ─── Happy Path ───

  test('does NOT throw when all required Ideaya vars are present', () => {
    // Set all required vars for ideaya
    for (const varName of REQUIRED_VARS.ideaya) {
      process.env[varName] = 'test-value';
    }

    expect(() => validateHealthEnv('ideaya')).not.toThrow();
  });

  test('does NOT throw when all required ideayaPreflight vars are present', () => {
    for (const varName of REQUIRED_VARS.ideayaPreflight) {
      process.env[varName] = 'test-value';
    }

    expect(() => validateHealthEnv('ideayaPreflight')).not.toThrow();
  });

  test('does NOT throw when all required ICF Trimmed vars are present', () => {
    for (const varName of REQUIRED_VARS.icfTrimmed) {
      process.env[varName] = 'test-value';
    }

    expect(() => validateHealthEnv('icfTrimmed')).not.toThrow();
  });

  test('does NOT throw when all required ideayaProdtestCsr vars are present', () => {
    process.env.HEALTH_TEMPLATE_IDEAYA_PRODTEST_CSR = 'test-template.docx';
    process.env.HEALTH_TEMPLATE_FOLDER_IDEAYA_PRODTEST_CSR = 'Template for SC';
    process.env.HEALTH_TEMPLATE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR = 'IDE-196-009 CSR V1';
    process.env.HEALTH_SOURCES_IDEAYA_PRODTEST_CSR = 'Tables_Test_EP';
    process.env.HEALTH_SOURCE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR = 'IDE196-009 TFLs';
    expect(() => validateHealthEnv('ideayaProdtestCsr')).not.toThrow();
  });

  // ─── Missing Vars ───

  test('throws with var name when one Ideaya var is missing', () => {
    // Set all but the first var
    const [missingVar, ...presentVars] = REQUIRED_VARS.ideaya;
    for (const varName of presentVars) {
      process.env[varName] = 'test-value';
    }
    delete process.env[missingVar];

    expect(() => validateHealthEnv('ideaya')).toThrow(missingVar);
  });

  test('throws listing ALL missing vars when multiple are absent', () => {
    // Remove all ideaya vars
    for (const varName of REQUIRED_VARS.ideaya) {
      delete process.env[varName];
    }

    expect(() => {
      validateHealthEnv('ideaya');
    }).toThrow(/HEALTH_TEMPLATE_IDEAYA/);

    // Also verify it mentions a second var (not just the first)
    expect(() => {
      validateHealthEnv('ideaya');
    }).toThrow(/HEALTH_SOURCE_FILE_IDEAYA/);
  });

  test('throws with human-readable message including config key', () => {
    for (const varName of REQUIRED_VARS.icfTrimmed) {
      delete process.env[varName];
    }

    expect(() => validateHealthEnv('icfTrimmed')).toThrow(/icfTrimmed/i);
  });

  // ─── Edge Cases ───

  test('treats empty string as missing', () => {
    for (const varName of REQUIRED_VARS.ideaya) {
      process.env[varName] = 'test-value';
    }
    // Set first var to empty string
    process.env[REQUIRED_VARS.ideaya[0]] = '';

    expect(() => validateHealthEnv('ideaya')).toThrow(REQUIRED_VARS.ideaya[0]);
  });

  test('treats whitespace-only string as missing', () => {
    for (const varName of REQUIRED_VARS.ideaya) {
      process.env[varName] = 'test-value';
    }
    process.env[REQUIRED_VARS.ideaya[0]] = '   ';

    expect(() => validateHealthEnv('ideaya')).toThrow(REQUIRED_VARS.ideaya[0]);
  });

  // ─── All Config Keys ───

  test('validates all currently defined config keys without crashing (currently 7)', () => {
    const keys: HealthConfigKey[] = [
      'csr', 'icfFull', 'icfTrimmed', 'ideaya', 'ideayaPreflight', 'ideayaProdtestCsr', 'm264',
    ];

    for (const key of keys) {
      // Set all vars for this key
      for (const varName of REQUIRED_VARS[key]) {
        process.env[varName] = 'test-value';
      }
      expect(() => validateHealthEnv(key)).not.toThrow();
    }
  });
});

// ──────────────────────────────────────────────
// ISSUE 2 — summarizeSteps PASS/FAIL contract tests
// ──────────────────────────────────────────────
// These tests validate that generate-word-report.js correctly determines
// the overall status of a test run from the step results array.
//
// ROOT CAUSE: summarizeSteps([]) currently returns 'PASS' because
// failed.length === 0 — but zero steps means the test crashed before
// recording anything (e.g., beforeAll threw). This is a FAIL, not a PASS.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { summarizeSteps } = require('../../../generate-word-report');

test.describe('summarizeSteps() — DOCX PASS/FAIL contract', () => {

  test('returns FAIL when steps array is empty (zero steps = crashed before starting)', () => {
    const result = summarizeSteps([]);
    expect(result.overallStatus).toBe('FAIL');
    expect(result.totalSteps).toBe(0);
  });

  test('returns FAIL when at least one step has status FAIL', () => {
    const result = summarizeSteps([
      { stepName: 'Login', status: 'FAIL', critical: true, duration: 100 },
    ]);
    expect(result.overallStatus).toBe('FAIL');
    expect(result.failedSteps).toBe(1);
  });

  test('returns PASS only when steps exist and none are FAIL', () => {
    const result = summarizeSteps([
      { stepName: 'Login', status: 'PASS', critical: true, duration: 200 },
      { stepName: 'Navigate', status: 'PASS', critical: true, duration: 300 },
    ]);
    expect(result.overallStatus).toBe('PASS');
    expect(result.passedSteps).toBe(2);
    expect(result.failedSteps).toBe(0);
  });
});
