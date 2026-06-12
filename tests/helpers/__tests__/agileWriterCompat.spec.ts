/**
 * agileWriterCompat.spec.ts — Agile Writer Raw QA Compatibility Tests
 *
 * Validates the full accuracy scoring pipeline against raw Agile Writer output.
 * Uses frozen fixture files so future edits to live workbooks cannot break tests.
 *
 * Run with:
 *   npx playwright test tests/helpers/__tests__/agileWriterCompat.spec.ts --no-deps
 */

import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import {
  normalizePlaceholderName,
  loadReferenceFile,
} from '../reference-file-loader';
import {
  scoreAll,
  normalizeForCompare,
  stripHtml,
} from '../accuracy-scorer';
import type { ScoredPlaceholder } from '../accuracy-scorer';
import { generateReport } from '../accuracy-report-writer';
import type { QASummary } from '../accuracy-report-writer';

// ── Frozen Fixture Paths ────────────────────────────────────────────────
// These are copies of real Agile Writer outputs, frozen at test-creation
// time. Tests MUST reference these — never the live raw_qa_files/ folder.
const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const AARON_RAW_FIXTURE = path.join(FIXTURES_DIR, 'aaron_raw_pass3_fixture.xlsx');
const REF_CSR_FIXTURE = path.join(FIXTURES_DIR, 'ref_CSR_v3_fixture.xlsx');
const ICF_QA_FIXTURE = path.join(FIXTURES_DIR, 'icf_full_qa_fixture.xlsx');
const REF_ICF_FIXTURE = path.join(FIXTURES_DIR, 'ref_ICF_Full_fixture.xlsx');

// Temp dir for report output (cleaned up per-test)
const TEMP_REPORTS_DIR = path.join(__dirname, '..', '..', 'fixtures', '.temp-reports');

// ──────────────────────────────────────────────
// §1 — Workbook Loading
// ──────────────────────────────────────────────

test.describe('§1 — Workbook Loading', () => {
  test('raw Agile Writer workbook (Evaluation_Data) loads without error', () => {
    const workbook = XLSX.readFile(AARON_RAW_FIXTURE);
    expect(workbook.SheetNames).toContain('Evaluation_Data');
  });

  test('Evaluation_Data sheet detected for CSR-type files', () => {
    const workbook = XLSX.readFile(AARON_RAW_FIXTURE);
    // The scorer's detectExcelFormat checks for Evaluation_Data first
    expect(workbook.Sheets.Evaluation_Data).toBeDefined();
  });

  test('QA sheet detected for ICF-type files', () => {
    const workbook = XLSX.readFile(ICF_QA_FIXTURE);
    expect(workbook.Sheets.QA).toBeDefined();
  });

  test('all 125 data rows parsed from Evaluation_Data fixture', () => {
    const workbook = XLSX.readFile(AARON_RAW_FIXTURE);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Evaluation_Data, {
      header: 1,
      defval: '',
    });
    const dataRows = rows.slice(2).filter((row) => String(row[0] ?? '').trim());
    expect(dataRows.length).toBe(125);
  });
});

// ──────────────────────────────────────────────
// §2 — Placeholder Normalization & Matching
// ──────────────────────────────────────────────

test.describe('§2 — Placeholder Normalization & Matching', () => {
  test('bracketed and bare placeholder names resolve to the same key', () => {
    const bracketed = normalizePlaceholderName("<Sponsor's Name>");
    const bare = normalizePlaceholderName("Sponsor's Name");
    expect(bracketed).toBe(bare);
    expect(bracketed).toBe("sponsor's name");
  });

  test('extra internal whitespace is collapsed', () => {
    const spaced = normalizePlaceholderName("< Sponsor's Name >");
    expect(spaced).toBe("sponsor's name");
  });

  test('uppercase variants match', () => {
    const upper = normalizePlaceholderName("SPONSOR'S NAME");
    expect(upper).toBe("sponsor's name");
  });

  test('all four variants resolve identically', () => {
    const variants = [
      "Sponsor's Name",
      "<Sponsor's Name>",
      "< Sponsor's Name >",
      "SPONSOR'S NAME",
    ];
    const keys = variants.map(normalizePlaceholderName);
    const unique = new Set(keys);
    expect(unique.size).toBe(1);
  });

  test('all Aaron fixture placeholders match ref_CSR_v3 fixture', () => {
    const workbook = XLSX.readFile(AARON_RAW_FIXTURE);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Evaluation_Data, {
      header: 1,
      defval: '',
    });
    const rawNames = rows
      .slice(2)
      .map((row) => String(row[0] ?? '').trim())
      .filter(Boolean);
    const uniqueRawKeys = new Set(rawNames.map(normalizePlaceholderName));

    const refMap = loadReferenceFile(REF_CSR_FIXTURE);
    const refKeys = new Set(refMap.keys());

    const unmatched = [...uniqueRawKeys].filter((key) => !refKeys.has(key));
    expect(unmatched).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// §3 — Missing Reference Handling
// ──────────────────────────────────────────────

test.describe('§3 — Missing Reference Handling', () => {
  test('unknown placeholders get Missing Reference status and are not falsely matched', () => {
    // Create a minimal refMap that is missing a known placeholder
    const refMap = loadReferenceFile(REF_CSR_FIXTURE);

    // Remove a known key to simulate missing reference
    const testKey = normalizePlaceholderName("Sponsor's Name");
    refMap.delete(testKey);

    const scored = scoreAll(AARON_RAW_FIXTURE, refMap);
    const missingRows = scored.filter(
      (row) => normalizePlaceholderName(row.name) === testKey
    );

    expect(missingRows.length).toBeGreaterThan(0);
    for (const row of missingRows) {
      expect(row.status).toBe('Missing Reference');
      // Must NOT be falsely matched to some other reference
      expect(row.expectedText).toBe('');
      expect(row.overallSimilarity).toBe(0);
    }
  });
});

// ──────────────────────────────────────────────
// §4 — Backward Compatibility
// ──────────────────────────────────────────────

test.describe('§4 — Backward Compatibility', () => {
  test('ICF QA format continues to parse correctly', () => {
    const refMap = loadReferenceFile(REF_ICF_FIXTURE);
    expect(refMap.size).toBeGreaterThan(0);

    const scored = scoreAll(ICF_QA_FIXTURE, refMap);
    expect(scored.length).toBeGreaterThan(0);
    // ICF should have some matches
    const matched = scored.filter((row) => row.status === 'Match');
    expect(matched.length).toBeGreaterThan(0);
  });

  test('existing reference files load correctly', () => {
    const csrRef = loadReferenceFile(REF_CSR_FIXTURE);
    expect(csrRef.size).toBeGreaterThan(0);

    const icfRef = loadReferenceFile(REF_ICF_FIXTURE);
    expect(icfRef.size).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// §5 — End-to-End Scorer Validation
// ──────────────────────────────────────────────

test.describe('§5 — End-to-End Scorer Validation', () => {
  let scored: ScoredPlaceholder[];

  test.beforeAll(() => {
    const refMap = loadReferenceFile(REF_CSR_FIXTURE);
    scored = scoreAll(AARON_RAW_FIXTURE, refMap);
  });

  test('scoreAll returns 125 results for Aaron fixture', () => {
    expect(scored.length).toBe(125);
  });

  test('zero Missing Reference rows', () => {
    const missing = scored.filter((row) => row.status === 'Missing Reference');
    expect(missing.length).toBe(0);
  });

  test('13 Skipped rows (blank expected text)', () => {
    const skipped = scored.filter((row) => row.status === 'Skipped');
    expect(skipped.length).toBe(13);
    // Every skipped row must have blank expected text
    for (const row of skipped) {
      expect(row.expectedText.trim()).toBe('');
    }
  });

  test('112 Match rows', () => {
    const matched = scored.filter((row) => row.status === 'Match');
    expect(matched.length).toBe(112);
  });

  test('overall accuracy is non-trivial (greater than 0)', () => {
    const skipped = scored.filter((row) => row.status === 'Skipped').length;
    const correct = scored.filter((row) => row.status === 'Match').length;
    const denominator = scored.length - skipped;
    const accuracy = denominator > 0 ? correct / denominator : 0;
    expect(accuracy).toBeGreaterThan(0);
  });

  test('every scored row has a valid status', () => {
    const validStatuses = ['Match', 'Partial Match', 'No Match', 'Skipped', 'Missing Reference'];
    for (const row of scored) {
      expect(validStatuses).toContain(row.status);
    }
  });

  test('every scored row has a type', () => {
    for (const row of scored) {
      expect(row.type).toBeTruthy();
    }
  });
});

// ──────────────────────────────────────────────
// §6 — Report Generation & Validation
// ──────────────────────────────────────────────

test.describe('§6 — Report Generation & Validation', () => {
  let summary: QASummary;
  let excelPath: string;
  let jsonPath: string;

  test.beforeAll(() => {
    fs.mkdirSync(TEMP_REPORTS_DIR, { recursive: true });
    const refMap = loadReferenceFile(REF_CSR_FIXTURE);
    const scored = scoreAll(AARON_RAW_FIXTURE, refMap);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    excelPath = path.join(TEMP_REPORTS_DIR, `compat-test-${ts}.xlsx`);
    jsonPath = path.join(TEMP_REPORTS_DIR, `compat-test-${ts}.json`);
    summary = generateReport(scored, excelPath, jsonPath);
  });

  test.afterAll(() => {
    // Clean up temp reports
    if (fs.existsSync(TEMP_REPORTS_DIR)) {
      fs.rmSync(TEMP_REPORTS_DIR, { recursive: true, force: true });
    }
  });

  test('generateReport creates a non-empty Excel file', () => {
    expect(fs.existsSync(excelPath)).toBe(true);
    expect(fs.statSync(excelPath).size).toBeGreaterThan(0);
  });

  test('generateReport creates a non-empty JSON file', () => {
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.statSync(jsonPath).size).toBeGreaterThan(0);
  });

  test('Excel report has Summary and QA sheets', () => {
    const workbook = XLSX.readFile(excelPath);
    expect(workbook.SheetNames).toContain('Summary');
    expect(workbook.SheetNames).toContain('QA');
  });

  test('JSON report has summary.overall and rows array', () => {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.overall).toBe('number');
    expect(Array.isArray(data.rows)).toBe(true);
  });

  test('JSON summary.total matches scored row count', () => {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    expect(data.summary.total).toBe(data.rows.length);
    expect(data.summary.total).toBe(125);
  });
});

// ──────────────────────────────────────────────
// §7 — Accuracy Formula Validation
// ──────────────────────────────────────────────
//
// The accuracy formula is:
//
//   Overall Accuracy = Correct / (Total - Skipped)
//
// Where:
//   Total   = all scored rows
//   Skipped = rows with blank expected text (excluded from denominator)
//   Correct = rows with status === 'Match'
//
// This means accuracy measures: "of all rows that HAVE expected values,
// what percentage matched?" Blank-expected rows are not counted against.

test.describe('§7 — Accuracy Formula Validation', () => {
  let summary: QASummary;

  test.beforeAll(() => {
    fs.mkdirSync(TEMP_REPORTS_DIR, { recursive: true });
    const refMap = loadReferenceFile(REF_CSR_FIXTURE);
    const scored = scoreAll(AARON_RAW_FIXTURE, refMap);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    summary = generateReport(
      scored,
      path.join(TEMP_REPORTS_DIR, `formula-test-${ts}.xlsx`),
      path.join(TEMP_REPORTS_DIR, `formula-test-${ts}.json`)
    );
  });

  test.afterAll(() => {
    if (fs.existsSync(TEMP_REPORTS_DIR)) {
      fs.rmSync(TEMP_REPORTS_DIR, { recursive: true, force: true });
    }
  });

  test('summary.total equals 125', () => {
    expect(summary.total).toBe(125);
  });

  test('summary.skipped equals 13', () => {
    expect(summary.skipped).toBe(13);
  });

  test('summary.replaced equals 112 (rows with non-empty aiText)', () => {
    expect(summary.replaced).toBe(112);
  });

  test('summary.overall follows formula: correct / (total - skipped)', () => {
    // For the Aaron fixture: 112 correct / (125 - 13) = 112/112 = 1.0
    const denominator = summary.total - summary.skipped;
    expect(denominator).toBeGreaterThan(0);

    // Recompute from byType
    let correct = 0;
    for (const ts of Object.values(summary.byType)) {
      correct += ts.correct;
    }
    const expectedAccuracy = correct / denominator;
    expect(summary.overall).toBeCloseTo(expectedAccuracy, 6);
  });

  test('per-type accuracy sums are consistent with overall totals', () => {
    let totalFromTypes = 0;
    let skippedFromTypes = 0;
    let correctFromTypes = 0;

    for (const ts of Object.values(summary.byType)) {
      totalFromTypes += ts.total;
      skippedFromTypes += ts.skipped;
      correctFromTypes += ts.correct;
    }

    expect(totalFromTypes).toBe(summary.total);
    expect(skippedFromTypes).toBe(summary.skipped);
  });
});

// ──────────────────────────────────────────────
// §8 — Header Validation Warnings
// ──────────────────────────────────────────────

test.describe('§8 — Header Validation Warnings', () => {
  test('no warnings emitted for a well-formed Evaluation_Data workbook', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      const refMap = loadReferenceFile(REF_CSR_FIXTURE);
      scoreAll(AARON_RAW_FIXTURE, refMap);
    } finally {
      console.warn = originalWarn;
    }

    const headerWarnings = warnings.filter((w) => w.includes('[AccuracyScorer]'));
    expect(headerWarnings).toEqual([]);
  });

  test('warning emitted when Evaluation_Data headers are in unexpected positions', () => {
    // Build a minimal workbook with shuffled headers to trigger the warning
    const workbook = XLSX.utils.book_new();
    const rows = [
      ['Placeholder', '', '', '', 'Instruction', '', '', '', '', 'Replacement'],
      // Row 1: deliberately wrong header at col 17
      [
        'Ai detected placeholder', '', '', '', 'Instruction text', 'Writing instruction',
        '', '', '', 'AI Replaced Text', '', '', '', '', '', '', '',
        'WRONG HEADER HERE',  // col 17 should be "Placeholder Type"
        'Placeholder ID',
      ],
      // Row 2: one data row
      ['<Test Placeholder>', '', '', '', '', 'test instruction', '', '', '', 'test value',
       '', '', '', '', '', '', '', 'Inline', 'test-id'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Evaluation_Data');

    const tempPath = path.join(TEMP_REPORTS_DIR, 'header-mismatch-fixture.xlsx');
    fs.mkdirSync(TEMP_REPORTS_DIR, { recursive: true });
    XLSX.writeFile(workbook, tempPath);

    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      const refMap = new Map();
      scoreAll(tempPath, refMap);
    } finally {
      console.warn = originalWarn;
    }

    // Clean up
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    if (fs.existsSync(TEMP_REPORTS_DIR)) {
      fs.rmSync(TEMP_REPORTS_DIR, { recursive: true, force: true });
    }

    const headerWarnings = warnings.filter((w) => w.includes('[AccuracyScorer]'));
    expect(headerWarnings.length).toBeGreaterThan(0);
    // The warning should mention the column that mismatched
    expect(headerWarnings.some((w) => w.includes('Placeholder Type'))).toBe(true);
  });
});
