import path from 'path';
import { test, expect } from '@playwright/test';
import { loadReferenceFile } from './helpers/reference-file-loader';
import { scoreAll } from './helpers/accuracy-scorer';
import { generateReport } from './helpers/accuracy-report-writer';

test.describe('AI Placeholder Verification Accuracy Scorer', () => {
  test('generates QA accuracy Excel and JSON reports', async () => {
    const rawQAPath = process.env.ACCURACY_RAW_QA_PATH || 'QA report_ICF_FULL_new version.xlsx';
    const referencePath = process.env.ACCURACY_REF_PATH || path.join('reference_files', 'ref_ICF_Full.xlsx');
    const outputDir = process.env.ACCURACY_OUTPUT_DIR || 'reports';
    const rawBase = path.basename(rawQAPath).toLowerCase();
    const refBase = path.basename(referencePath).toLowerCase();
    const docTypeTokens = ['icf', 'csr', 'm264', 'ep', 'trimmed', 'full'];
    const rawToken = docTypeTokens.find((token) => rawBase.includes(token));
    const refToken = docTypeTokens.find((token) => refBase.includes(token));
    if (rawToken && refToken && rawToken !== refToken) {
      console.warn(
        '\nWARNING: Possible document-type mismatch.\n' +
        `  Raw QA: ${rawQAPath}  (detected token: "${rawToken}")\n` +
        `  Ref:    ${referencePath}  (detected token: "${refToken}")\n` +
        '  Set ACCURACY_RAW_QA_PATH and ACCURACY_REF_PATH to matching' +
        ' document types to avoid "Missing Reference" for most rows.\n'
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const excelPath = path.join(outputDir, `accuracy-report-${timestamp}.xlsx`);
    const jsonPath = path.join(outputDir, `accuracy-report-${timestamp}.json`);

    const references = loadReferenceFile(referencePath);
    const scored = scoreAll(rawQAPath, references);
    const summary = generateReport(scored, excelPath, jsonPath);

    console.log(`Accuracy Excel report: ${excelPath}`);
    console.log(`Accuracy JSON report: ${jsonPath}`);
    expect(summary.total).toBeGreaterThan(0);
  });
});
