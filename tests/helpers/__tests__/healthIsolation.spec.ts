/**
 * healthIsolation.spec.ts — SCC-174: Health Isolation Validation
 *
 * Asserts the health project lists exactly 7 tests with the exact expected names.
 * Acts as a CI gate: if someone accidentally adds a spec matching health_*.spec.ts,
 * the count changes and this test fails, catching the regression.
 *
 * ⚠️  ALWAYS run with --no-deps to prevent triggering AW_00_10 full E2E chain:
 *   npx playwright test tests/helpers/__tests__/healthIsolation.spec.ts --no-deps
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

// ──────────────────────────────────────────────
// CANONICAL LIST — source of truth for health project tests
// ──────────────────────────────────────────────

const EXPECTED_HEALTH_TESTS: string[] = [
  'CSR - Full Health Check',
  'ICF Full - Full Health Check',
  'ICF Trimmed - Full Health Check',
  'Ideaya - preflight stops before training',
  'Ideaya PRODTEST CSR - Full Health Check',
  'Ideaya - Full Health Check',
  'M264 - Full Health Check',
];

// ──────────────────────────────────────────────
// FORBIDDEN PATTERNS — must never appear in health project
// ──────────────────────────────────────────────

const FORBIDDEN_PATTERNS: string[] = [
  'AW_00_10_consolidated_flow',
  'diagnostics/',
  'AW_11_to_20',
];

test.describe('Health Project Isolation — SCC-174', () => {

  let healthListOutput: string;

  test.beforeAll(() => {
    // Run `npx playwright test --project=health --list` and capture output
    healthListOutput = execSync(
      'npx playwright test --project=health --list',
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 30_000,
      }
    );
  });

  test('health project lists exactly 7 tests', () => {
    // Parse the "Total: N tests in N files" line
    const totalMatch = healthListOutput.match(/Total:\s+(\d+)\s+tests?\s+in\s+(\d+)\s+files?/);
    expect(totalMatch, 'Could not find "Total: N tests in N files" in output').not.toBeNull();
    const testCount = parseInt(totalMatch![1], 10);
    expect(testCount).toBe(7);
  });

  test('every expected test name appears in the health list', () => {
    for (const expectedName of EXPECTED_HEALTH_TESTS) {
      expect(
        healthListOutput,
        `Missing expected test: "${expectedName}"`
      ).toContain(expectedName);
    }
  });

  test('no unexpected tests appear in the health list (count matches canonical list)', () => {
    // Extract all test titles from lines like:
    //   [health] › tests\health_CSR.spec.ts:44:7 › Health Report: CSR › CSR - Full Health Check
    // The test title is the last segment after the last " › "
    const testLines = healthListOutput
      .split('\n')
      .filter(line => line.includes('[health]') && line.includes('›'));

    expect(testLines.length).toBe(EXPECTED_HEALTH_TESTS.length);
  });

  test('no AW_00_10 or diagnostics tests leak into health project', () => {
    for (const forbidden of FORBIDDEN_PATTERNS) {
      expect(
        healthListOutput,
        `Forbidden pattern found in health list: "${forbidden}"`
      ).not.toContain(forbidden);
    }
  });
});
