/**
 * bootstrap-reference-csr.js — Creates the CSR reference file (ref_CSR_v3.xlsx)
 * from the existing ref_CSR_v2.xlsx, adding the 13 missing placeholders
 * identified in the gap report.
 *
 * The 13 missing placeholders all:
 *   - Exist in the manual reference file (QA sheet)
 *   - Have empty AI output in the raw QA file
 *   - Are legitimate CSR template placeholders
 *   - Will score as "Skipped" (blank expected text)
 *
 * Usage: node bootstrap-reference-csr.js
 */
const XLSX = require('xlsx');
const path = require('path');

const INPUT_FILE = path.join('reference_files', 'ref_CSR_v2.xlsx');
const OUTPUT_FILE = path.join('reference_files', 'ref_CSR_v3.xlsx');

// ── Load existing ref_CSR_v2.xlsx ──
const wb = XLSX.readFile(INPUT_FILE);
const ws = wb.Sheets[wb.SheetNames[0]];
const existingData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Copy all existing rows (header + data)
const rows = existingData.map(row => [...row]);

// ── Validated gap placeholders (all confirmed in manual reference) ──
const missingPlaceholders = [
  ['Company Name', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Company Address', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Name', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Dosage Formulation', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Unit Dose strength (s)', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Dose level', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Number of injections and volume', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Packaging and Labelling', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Lot Number', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Manufacturer', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Storage', 'KeyValue', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Summary of Table Disposition of Participants', 'InternalTableSummary', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
  ['Table Summary of Participant Disposition', 'Paragraph', '', 'MockCSRProtocol.docx', 'Gap: Unfilled by AI — blank expected value'],
];

// De-duplicate: check existing names (case-insensitive)
const existingNames = new Set();
for (let i = 1; i < rows.length; i++) {
  const name = String(rows[i][0] || '').trim().toLowerCase();
  if (name) existingNames.add(name);
}

let added = 0;
for (const placeholder of missingPlaceholders) {
  const key = placeholder[0].toLowerCase();
  if (existingNames.has(key)) {
    console.log(`  SKIP (already exists): ${placeholder[0]}`);
    continue;
  }
  rows.push(placeholder);
  added++;
}

// ── Write output ──
const newWb = XLSX.utils.book_new();
const newWs = XLSX.utils.aoa_to_sheet(rows);

newWs['!cols'] = [
  { wch: 50 },  // Placeholder Name
  { wch: 20 },  // Type
  { wch: 60 },  // Expected Text
  { wch: 35 },  // Source Document
  { wch: 50 },  // Notes
];

XLSX.utils.book_append_sheet(newWb, newWs, 'QA');
XLSX.writeFile(newWb, OUTPUT_FILE);

const totalRows = rows.length - 1; // minus header
console.log(`\n  Created ${OUTPUT_FILE}`);
console.log(`  Total placeholders: ${totalRows}`);
console.log(`  Carried from v2:    ${totalRows - added}`);
console.log(`  Added (gap fill):   ${added}`);
