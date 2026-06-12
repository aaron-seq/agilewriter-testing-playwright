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
// §1 — Placeholder Name Normalization (Contract)
// ──────────────────────────────────────────────

test.describe('normalizePlaceholderName', () => {
  test('strips ALL angle brackets from bracketed placeholder names (broad strategy)', () => {
    // Standard
    expect(normalizePlaceholderName("<Sponsor's Name>")).toBe("sponsor's name");
    // Internal/malformed
    expect(normalizePlaceholderName("<<Company Name>>")).toBe("company name");
    expect(normalizePlaceholderName("<Lot Number")).toBe("lot number");
    expect(normalizePlaceholderName("Dosage Formulation>")).toBe("dosage formulation");
    // Internal brackets
    expect(normalizePlaceholderName("Insert <Disease> Name")).toBe("insert disease name");
  });

  test('bare placeholder names normalize identically (backward compat)', () => {
    expect(normalizePlaceholderName("Sponsor's Name")).toBe("sponsor's name");
  });

  test('strips brackets with extra internal whitespace', () => {
    expect(normalizePlaceholderName("<  Sponsor's Name  >")).toBe("sponsor's name");
  });

  test('handles multiple whitespace characters', () => {
    expect(normalizePlaceholderName("  Study   Title  ")).toBe("study title");
  });

  test('handles empty string, null, and undefined (null safety)', () => {
    expect(normalizePlaceholderName("")).toBe("");
    expect(normalizePlaceholderName(null as any)).toBe("");
    expect(normalizePlaceholderName(undefined as any)).toBe("");
  });

  test('handles string with only brackets', () => {
    expect(normalizePlaceholderName("<>")).toBe("");
    expect(normalizePlaceholderName("<<<>>>")).toBe("");
  });

  test('preserves apostrophes and parentheses (punctuation)', () => {
    expect(normalizePlaceholderName("<Protocol Identification (Code or Number)>"))
      .toBe("protocol identification (code or number)");
    expect(normalizePlaceholderName("Sponsor's Name")).toBe("sponsor's name");
  });

  test('bracketed, bare, and uppercase names produce identical keys (casing)', () => {
    const bare = normalizePlaceholderName("Investigational Drug Name");
    const bracketed = normalizePlaceholderName("<Investigational Drug Name>");
    const upper = normalizePlaceholderName("<INVESTIGATIONAL DRUG NAME>");
    expect(bare).toBe("investigational drug name");
    expect(bracketed).toBe("investigational drug name");
    expect(upper).toBe("investigational drug name");
  });
});
