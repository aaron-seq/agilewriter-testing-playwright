import fs from 'fs';
import * as XLSX from 'xlsx';

export interface PlaceholderRef {
  name: string;
  type: string;
  expectedText: string;
  sourceDocument: string;
  notes?: string;
}

export function normalizePlaceholderName(name: string): string {
  return name
    .replace(/^<|>$/g, '')   // strip leading < and trailing > (Agile Writer format)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

export function loadReferenceFile(filePath: string, sheetName?: string): Map<string, PlaceholderRef[]> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Reference file not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const selectedSheet = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[selectedSheet];
  if (!worksheet) {
    throw new Error(`Reference sheet "${selectedSheet}" not found in ${filePath}`);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
  const references = new Map<string, PlaceholderRef[]>();

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const name = cellText(row[0]);
    if (!name) {
      continue;
    }

    const key = normalizePlaceholderName(name);
    if (!references.has(key)) {
      references.set(key, []);
    }
    references.get(key)!.push({
      name,
      type: cellText(row[1]) || 'Unknown',
      expectedText: cellText(row[2]),
      sourceDocument: cellText(row[3]),
      notes: cellText(row[4]) || undefined,
    });
  }

  return references;
}
