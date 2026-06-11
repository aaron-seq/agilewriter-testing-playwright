/**
 * accuracyScorer.spec.ts — Regression tests for accuracy scorer
 *
 * Tests normalization, key matching, and bracket handling.
 *
 * Run with:
 *   npx playwright test tests/helpers/__tests__/accuracyScorer.spec.ts --no-deps
 */

import { test, expect } from '@playwright/test';
import { normalizePlaceholderName } from '../../../tests/helpers/reference-file-loader';

// ──────────────────────────────────────────────
// §1 — Placeholder Name Normalization
// ──────────────────────────────────────────────

test.describe('normalizePlaceholderName', () => {
  test('strips angle brackets from bracketed placeholder names', () => {
    expect(normalizePlaceholderName("<Sponsor's Name>"))
      .toBe("sponsor's name");
  });

  test('bare placeholder names normalize identically (backward compat)', () => {
    expect(normalizePlaceholderName("Sponsor's Name"))
      .toBe("sponsor's name");
  });

  test('strips brackets with extra internal whitespace', () => {
    expect(normalizePlaceholderName("<  Sponsor's Name  >"))
      .toBe("sponsor's name");
  });

  test('handles multiple whitespace characters', () => {
    expect(normalizePlaceholderName("  Study   Title  "))
      .toBe("study title");
  });

  test('handles bracketed name with multiple whitespace', () => {
    expect(normalizePlaceholderName("<  Study   Title  >"))
      .toBe("study title");
  });

  test('handles empty string', () => {
    expect(normalizePlaceholderName("")).toBe("");
  });

  test('handles string with only brackets', () => {
    expect(normalizePlaceholderName("<>")).toBe("");
  });

  test('handles nested or partial brackets (edge case)', () => {
    // Only leading < and trailing > should be stripped
    expect(normalizePlaceholderName("<Insert Disease Name>"))
      .toBe("insert disease name");
  });

  test('preserves parentheses inside placeholder names', () => {
    expect(normalizePlaceholderName("<Protocol Identification (Code or Number)>"))
      .toBe("protocol identification (code or number)");
  });

  test('bracketed and bare names produce identical keys', () => {
    const bare = normalizePlaceholderName("Investigational Drug Name");
    const bracketed = normalizePlaceholderName("<Investigational Drug Name>");
    expect(bare).toBe(bracketed);
  });
});
