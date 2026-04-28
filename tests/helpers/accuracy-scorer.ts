import fs from 'fs';
import { compareTwoStrings } from 'string-similarity';
import * as XLSX from 'xlsx';
import { normalizePlaceholderName, PlaceholderRef } from './reference-file-loader';

export type MatchStatus = 'Match' | 'Partial Match' | 'No Match' | 'Skipped' | 'Missing Reference';

export interface KeyValueScore {
  similarity: number;
  status: MatchStatus;
}

export interface ParagraphScore {
  headerAvailable: boolean;
  aiHeaderAvailable: boolean;
  similarity: number;
  percentage: number;
  status: MatchStatus;
}

export interface ListScore {
  expectedPoints: number;
  aiPoints: number;
  pointsMatch: boolean;
  similarity: number;
  status: MatchStatus;
}

export interface TableScore {
  expectedRows: number;
  expectedColumns: number;
  aiRows: number;
  aiColumns: number;
  alignment: boolean;
  similarity: number;
  status: MatchStatus;
}

export interface ScoredPlaceholder {
  name: string;
  type: string;
  expectedText: string;
  aiText: string;
  source: string;
  instruction: string;
  placeholderId?: string;
  overallSimilarity: number;
  status: MatchStatus;
  kv?: KeyValueScore;
  par?: ParagraphScore;
  list?: ListScore;
  table?: TableScore;
}

type RawPlaceholderRow = {
  name: string;
  type: string;
  aiText: string;
  source: string;
  instruction: string;
  placeholderId?: string;
};

type ExcelFormat = 'Evaluation_Data' | 'QA';

type PlaceholderTypeName =
  | 'KeyValue'
  | 'Inline'
  | 'Paragraph'
  | 'List'
  | 'Table'
  | 'Unknown'
  | string;

function getThresholds(type: PlaceholderTypeName): { match: number; partial: number } {
  const normalizedType = (type ?? '').trim().toLowerCase();
  if (normalizedType === 'keyvalue' || normalizedType === 'inline') {
    return { match: 0.85, partial: 0.5 };
  }
  return { match: 0.65, partial: 0.4 };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

export function stripHtml(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|tr|ul|ol|table)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\s*\/\s*(td|th)\s*>/gi, '\t')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function normalizeForCompare(value: string): string {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^\w\s.%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(expected: string, actual: string): number {
  const normalizedExpected = normalizeForCompare(expected);
  const normalizedActual = normalizeForCompare(actual);

  if (!normalizedExpected && !normalizedActual) {
    return 1;
  }
  if (!normalizedExpected || !normalizedActual) {
    return 0;
  }
  if (normalizedExpected === normalizedActual) {
    return 1;
  }
  if (normalizedExpected.length < 2 || normalizedActual.length < 2) {
    return normalizedExpected === normalizedActual ? 1 : 0;
  }
  return compareTwoStrings(normalizedExpected, normalizedActual);
}

function statusFromSimilarity(
  score: number,
  type: PlaceholderTypeName = 'KeyValue'
): 'Match' | 'Partial Match' | 'No Match' {
  const { match, partial } = getThresholds(type);
  if (score >= match) {
    return 'Match';
  }
  if (score >= partial) {
    return 'Partial Match';
  }
  return 'No Match';
}

function firstMeaningfulLine(value: string): string {
  return stripHtml(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) || '';
}

function splitListItems(value: string): string[] {
  return stripHtml(value)
    .split(/\r?\n|[•●▪]|\s-\s/)
    .map((item) => item.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter(Boolean);
}

function tableShape(value: string): { rows: number; columns: number; text: string } {
  const text = stripHtml(value);
  if (!text || /^na$/i.test(text)) {
    return { rows: 0, columns: 0, text };
  }

  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const columnCounts = rows.map((row) => {
    const cells = row.split(/\t|\|/).map((cell) => cell.trim()).filter(Boolean);
    return Math.max(cells.length, 1);
  });

  return {
    rows: rows.length,
    columns: columnCounts.length ? Math.max(...columnCounts) : 0,
    text,
  };
}

function scoreKeyValue(expected: string, actual: string): KeyValueScore {
  const score = similarity(expected.trim(), actual.trim());
  return { similarity: score, status: statusFromSimilarity(score, 'KeyValue') };
}

function scoreParagraph(expected: string, actual: string): ParagraphScore {
  const expectedHeader = firstMeaningfulLine(expected);
  const actualText = stripHtml(actual);
  const headerAvailable = expectedHeader.length > 0;
  const aiHeaderAvailable = headerAvailable
    ? normalizeForCompare(actualText).includes(normalizeForCompare(expectedHeader))
    : false;
  const score = similarity(expected, actual);

  return {
    headerAvailable,
    aiHeaderAvailable,
    similarity: score,
    percentage: Math.round(score * 10000) / 100,
    status: statusFromSimilarity(score, 'Paragraph'),
  };
}

function scoreList(expected: string, actual: string): ListScore {
  const expectedItems = splitListItems(expected);
  const actualItems = splitListItems(actual);
  const score = similarity(expectedItems.join('\n'), actualItems.join('\n'));

  return {
    expectedPoints: expectedItems.length,
    aiPoints: actualItems.length,
    pointsMatch: expectedItems.length === actualItems.length,
    similarity: score,
    status: statusFromSimilarity(score, 'List'),
  };
}

function scoreTable(expected: string, actual: string): TableScore {
  const expectedShape = tableShape(expected);
  const actualShape = tableShape(actual);
  const score = similarity(expectedShape.text, actualShape.text);

  return {
    expectedRows: expectedShape.rows,
    expectedColumns: expectedShape.columns,
    aiRows: actualShape.rows,
    aiColumns: actualShape.columns,
    alignment: expectedShape.rows === actualShape.rows && expectedShape.columns === actualShape.columns,
    similarity: score,
    status: statusFromSimilarity(score, 'Table'),
  };
}

function scoreInline(expected: string, actual: string): KeyValueScore {
  const normalizedExpected = normalizeForCompare(expected);
  const normalizedActual = normalizeForCompare(actual);
  const score = normalizedExpected === normalizedActual ? 1 : similarity(expected, actual);
  return { similarity: score, status: statusFromSimilarity(score, 'Inline') };
}

function detectExcelFormat(workbook: XLSX.WorkBook): ExcelFormat {
  if (workbook.Sheets.Evaluation_Data) {
    return 'Evaluation_Data';
  }
  if (workbook.Sheets.QA) {
    return 'QA';
  }
  throw new Error('Unsupported Raw QA workbook. Expected sheet "Evaluation_Data" or "QA".');
}

function parseEvaluationData(workbook: XLSX.WorkBook): RawPlaceholderRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Evaluation_Data, {
    header: 1,
    defval: '',
  });

  return rows.slice(2).map((row) => ({
    name: cellText(row[0]),
    type: cellText(row[17]),
    aiText: stripHtml(cellText(row[9])),
    source: cellText(row[13]),
    instruction: cellText(row[4]) || cellText(row[5]),
    placeholderId: cellText(row[18]) || undefined,
  })).filter((row) => row.name);
}

function parseQAReport(workbook: XLSX.WorkBook): RawPlaceholderRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.QA, {
    header: 1,
    defval: '',
  });

  return rows.slice(2).map((row) => ({
    name: cellText(row[0]),
    type: cellText(row[2]),
    aiText: stripHtml(cellText(row[6])),
    source: cellText(row[4]),
    instruction: cellText(row[5]),
    placeholderId: undefined,
  })).filter((row) => row.name);
}

function scoreByType(type: string, expected: string, actual: string): ScoredPlaceholder {
  const normalizedType = type.toLowerCase();
  const base = {
    name: '',
    type,
    expectedText: expected,
    aiText: actual,
    source: '',
    instruction: '',
    overallSimilarity: 0,
    status: 'No Match' as MatchStatus,
  };

  if (normalizedType.includes('paragraph')) {
    const par = scoreParagraph(expected, actual);
    return { ...base, overallSimilarity: par.similarity, status: par.status, par };
  }
  if (normalizedType.includes('list')) {
    const list = scoreList(expected, actual);
    return { ...base, overallSimilarity: list.similarity, status: list.status, list };
  }
  if (normalizedType.includes('table')) {
    const table = scoreTable(expected, actual);
    return { ...base, overallSimilarity: table.similarity, status: table.status, table };
  }
  if (normalizedType.includes('inline')) {
    const kv = scoreInline(expected, actual);
    return { ...base, overallSimilarity: kv.similarity, status: kv.status, kv };
  }

  const kv = scoreKeyValue(expected, actual);
  return { ...base, overallSimilarity: kv.similarity, status: kv.status, kv };
}

function buildMissingReferenceResult(rawRow: RawPlaceholderRow): ScoredPlaceholder {
  return {
    name: rawRow.name,
    type: rawRow.type || 'Unknown',
    expectedText: '',
    aiText: rawRow.aiText,
    source: rawRow.source,
    instruction: rawRow.instruction,
    placeholderId: rawRow.placeholderId,
    overallSimilarity: 0,
    status: 'Missing Reference',
  };
}

function buildSkippedResult(rawRow: RawPlaceholderRow, ref: PlaceholderRef): ScoredPlaceholder {
  return {
    name: rawRow.name,
    type: ref.type || rawRow.type || 'Unknown',
    expectedText: ref.expectedText,
    aiText: rawRow.aiText,
    source: ref.sourceDocument || rawRow.source,
    instruction: rawRow.instruction,
    placeholderId: rawRow.placeholderId,
    overallSimilarity: 0,
    status: 'Skipped',
  };
}

function scoreSingleRef(rawRow: RawPlaceholderRow, ref: PlaceholderRef): ScoredPlaceholder {
  const scored = scoreByType(ref.type || rawRow.type || 'KeyValue', ref.expectedText, rawRow.aiText);
  return {
    ...scored,
    name: rawRow.name,
    type: ref.type || rawRow.type || 'Unknown',
    expectedText: ref.expectedText,
    aiText: rawRow.aiText,
    source: ref.sourceDocument || rawRow.source,
    instruction: rawRow.instruction,
    placeholderId: rawRow.placeholderId,
  };
}

export function scoreAll(rawQAPath: string, refMap: Map<string, PlaceholderRef[]>): ScoredPlaceholder[] {
  if (!fs.existsSync(rawQAPath)) {
    throw new Error(`Raw QA workbook not found: ${rawQAPath}`);
  }

  const workbook = XLSX.readFile(rawQAPath);
  const format = detectExcelFormat(workbook);
  const rawRows = format === 'Evaluation_Data' ? parseEvaluationData(workbook) : parseQAReport(workbook);

  return rawRows.map((rawRow) => {
    const refs = refMap.get(normalizePlaceholderName(rawRow.name));
    if (!refs || refs.length === 0) {
      return buildMissingReferenceResult(rawRow);
    }

    let bestScore = -1;
    let bestScored: ScoredPlaceholder | null = null;

    for (const candidateRef of refs) {
      if (!candidateRef.expectedText.trim()) {
        continue;
      }

      const candidate = scoreSingleRef(rawRow, candidateRef);
      if (candidate.overallSimilarity > bestScore) {
        bestScore = candidate.overallSimilarity;
        bestScored = candidate;
      }
    }

    return bestScored ?? buildSkippedResult(rawRow, refs[0]);
  });
}
