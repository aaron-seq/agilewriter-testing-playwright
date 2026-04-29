/**
 * bootstrap-reference.js — One-time script to create the ICF Full reference file
 * from the existing QA report Excel.
 *
 * Usage: node bootstrap-reference.js
 */
const XLSX = require('xlsx');
const path = require('path');

const INPUT_FILE = 'QA report_ICF_FULL_new version.xlsx';
const OUTPUT_FILE = path.join('reference_files', 'ref_ICF_Full.xlsx');

const wb = XLSX.readFile(INPUT_FILE);
const ws = wb.Sheets['QA'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Header row
const rows = [
  ['Placeholder Name', 'Placeholder Type', 'Expected Text', 'Source Document', 'Notes'],
];

const seen = new Set();
let withExpected = 0;
let withoutExpected = 0;

for (let i = 2; i < data.length; i++) {
  const name = String(data[i][0]).trim();
  const type = String(data[i][2]).trim();
  const expected = String(data[i][3]).trim();
  const source = String(data[i][4]).trim();

  if (!name) continue;
  if (seen.has(name)) continue;
  seen.add(name);

  const notes = expected ? '' : 'No expected value — blank per Anil confirmation';
  rows.push([name, type || 'Unknown', expected, source, notes]);

  if (expected) withExpected++;
  else withoutExpected++;
}

const newWb = XLSX.utils.book_new();
const newWs = XLSX.utils.aoa_to_sheet(rows);

// Set column widths for readability
newWs['!cols'] = [
  { wch: 45 },  // Placeholder Name
  { wch: 15 },  // Type
  { wch: 60 },  // Expected Text
  { wch: 35 },  // Source Document
  { wch: 40 },  // Notes
];

XLSX.utils.book_append_sheet(newWb, newWs, 'ICF_Full');
XLSX.writeFile(newWb, OUTPUT_FILE);

console.log(`✅ Created ${OUTPUT_FILE}`);
console.log(`   Total unique placeholders: ${seen.size}`);
console.log(`   With expected values:      ${withExpected}`);
console.log(`   Blank (per Anil):          ${withoutExpected}`);
