import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { ScoredPlaceholder } from './accuracy-scorer';

export interface TypeSummary {
  total: number;
  replaced: number;
  correct: number;
  skipped: number;
  accuracy: number;
}

export interface QASummary {
  total: number;
  unique: number;
  replaced: number;
  skipped: number;
  byType: Record<string, TypeSummary>;
  overall: number;
}

const COMMON_HEADERS = [
  'Placeholder',
  'Placeholder ID',
  'Placeholder Type',
  'Expected Value',
  'Source Document',
  'Writing instruction',
  'AI Replaced Text',
  'AI detected Source',
  'Matching Accuracy',
  'Similarity Score',
  'Source Match',
];

function pct(value: number): string {
  return `${Math.round(value * 10000) / 100}%`;
}

function emptyMasterRow(): string[] {
  return Array.from({ length: 45 }, () => '');
}

function masterHeaders(): string[] {
  const headers = emptyMasterRow();
  COMMON_HEADERS.forEach((header, index) => {
    headers[index] = header;
  });

  headers[17] = 'Expected Rows';
  headers[18] = 'Expected Columns';
  headers[19] = 'Expected Footnote';
  headers[20] = 'AI Replaced Rows';
  headers[21] = 'AI Replaced Columns';
  headers[22] = 'AI Replaced Footnotes';
  headers[23] = 'Alignment';
  headers[24] = 'Table Similarity Score';
  headers[25] = 'Table Status';
  headers[29] = 'Expected Points';
  headers[30] = 'AI Points';
  headers[31] = 'Points Match';
  headers[32] = 'Human Status';
  headers[33] = 'List Status';
  headers[34] = 'Header Availability';
  headers[35] = 'AI Header Availability';
  headers[36] = 'Paragraph Similarity Score';
  headers[37] = 'Percentage of Match';
  headers[38] = 'Paragraph Status';
  headers[40] = 'KeyValue Similarity Score';
  headers[41] = 'KeyValue Status';

  return headers;
}

function masterRow(item: ScoredPlaceholder): string[] {
  const row = emptyMasterRow();
  row[0] = item.name;
  row[1] = item.placeholderId || '';
  row[2] = item.type;
  row[3] = item.expectedText;
  row[4] = item.source;
  row[5] = item.instruction;
  row[6] = item.aiText;
  row[8] = item.status;
  row[9] = item.status === 'Skipped' ? '' : item.overallSimilarity.toFixed(4);
  row[10] = item.status;

  if (item.table) {
    row[17] = String(item.table.expectedRows);
    row[18] = String(item.table.expectedColumns);
    row[20] = String(item.table.aiRows);
    row[21] = String(item.table.aiColumns);
    row[23] = item.table.alignment ? 'Yes' : 'No';
    row[24] = item.table.similarity.toFixed(4);
    row[25] = item.table.status;
  }

  if (item.list) {
    row[29] = String(item.list.expectedPoints);
    row[30] = String(item.list.aiPoints);
    row[31] = item.list.pointsMatch ? 'Yes' : 'No';
    row[33] = item.list.status;
  }

  if (item.par) {
    row[34] = item.par.headerAvailable ? 'Yes' : 'No';
    row[35] = item.par.aiHeaderAvailable ? 'Yes' : 'No';
    row[36] = item.par.similarity.toFixed(4);
    row[37] = pct(item.par.similarity);
    row[38] = item.par.status;
  }

  if (item.kv) {
    row[40] = item.kv.similarity.toFixed(4);
    row[41] = item.kv.status;
  }

  return row;
}

function commonRow(item: ScoredPlaceholder): string[] {
  return [
    item.name,
    item.placeholderId || '',
    item.type,
    item.expectedText,
    item.source,
    item.instruction,
    item.aiText,
    '',
    item.status,
    item.status === 'Skipped' ? '' : item.overallSimilarity.toFixed(4),
    item.status,
  ];
}

function computeSummary(scored: ScoredPlaceholder[]): QASummary {
  const byType: Record<string, TypeSummary> = {};

  for (const item of scored) {
    const type = item.type || 'Unknown';
    byType[type] ||= { total: 0, replaced: 0, correct: 0, skipped: 0, accuracy: 0 };
    byType[type].total += 1;
    if (item.aiText.trim()) {
      byType[type].replaced += 1;
    }
    if (item.status === 'Match') {
      byType[type].correct += 1;
    }
    if (item.status === 'Skipped') {
      byType[type].skipped += 1;
    }
  }

  for (const summary of Object.values(byType)) {
    const denominator = summary.total - summary.skipped;
    summary.accuracy = denominator > 0 ? summary.correct / denominator : 0;
  }

  const total = scored.length;
  const skipped = scored.filter((item) => item.status === 'Skipped').length;
  const correct = scored.filter((item) => item.status === 'Match').length;
  const denominator = total - skipped;

  return {
    total,
    unique: new Set(scored.map((item) => item.name.toLowerCase().trim())).size,
    replaced: scored.filter((item) => item.aiText.trim()).length,
    skipped,
    byType,
    overall: denominator > 0 ? correct / denominator : 0,
  };
}

function writeSheet(workbook: XLSX.WorkBook, name: string, rows: string[][]): void {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = rows[0]?.map((_, colIndex) => ({
    wch: colIndex === 3 || colIndex === 6 ? 60 : 22,
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

function printDashboard(summary: QASummary): void {
  console.log('\nAccuracy Summary');
  console.log('Type | Total | Replaced | Correct | Skipped | Accuracy');
  for (const [type, row] of Object.entries(summary.byType)) {
    console.log(`${type} | ${row.total} | ${row.replaced} | ${row.correct} | ${row.skipped} | ${pct(row.accuracy)}`);
  }
  console.log(`Overall accuracy: ${pct(summary.overall)} (${summary.total} rows, ${summary.skipped} skipped)\n`);
}

export function generateReport(scored: ScoredPlaceholder[], excelPath: string, jsonPath: string): QASummary {
  const summary = computeSummary(scored);
  fs.mkdirSync(path.dirname(excelPath), { recursive: true });
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });

  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    ['Metric', 'Value'],
    ['Generated At', new Date().toISOString()],
    ['Total Rows', String(summary.total)],
    ['Unique Placeholders', String(summary.unique)],
    ['Replaced Rows', String(summary.replaced)],
    ['Skipped Rows', String(summary.skipped)],
    ['Overall Accuracy', pct(summary.overall)],
    [],
    ['Type', 'Total', 'Replaced', 'Correct', 'Skipped', 'Accuracy'],
    ...Object.entries(summary.byType).map(([type, item]) => [
      type,
      String(item.total),
      String(item.replaced),
      String(item.correct),
      String(item.skipped),
      pct(item.accuracy),
    ]),
  ];

  writeSheet(workbook, 'Summary', summaryRows);
  writeSheet(workbook, 'QA', [masterHeaders(), ...scored.map(masterRow)]);

  for (const sheetName of ['Inline', 'Paragraph', 'KeyValue', 'Table', 'Lists', 'Multi Tables']) {
    const filtered = scored.filter((item) => {
      const type = item.type.toLowerCase();
      if (sheetName === 'Lists') return type.includes('list');
      if (sheetName === 'Multi Tables') return type.includes('multi') && type.includes('table');
      return type.includes(sheetName.toLowerCase());
    });
    writeSheet(workbook, sheetName, [COMMON_HEADERS, ...filtered.map(commonRow)]);
  }

  XLSX.writeFile(workbook, excelPath);
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, rows: scored }, null, 2));
  printDashboard(summary);

  return summary;
}
