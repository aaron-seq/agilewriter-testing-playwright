import path from 'path';
import { test, expect } from '@playwright/test';
import { loadReferenceFile } from './helpers/reference-file-loader';
import { scoreAll } from './helpers/accuracy-scorer';
import { generateReport } from './helpers/accuracy-report-writer';

test.describe('AI Placeholder Verification Accuracy Scorer', () => {
  test('generates QA accuracy Excel and JSON reports', async () => {
    const rawQAPath = process.env.ACCURACY_RAW_QA_PATH || 'CSRTestEP_07Apr_raw_qa.xlsx';
    const referencePath = process.env.ACCURACY_REF_PATH || path.join('reference_files', 'ref_ICF_Full.xlsx');
    const outputDir = process.env.ACCURACY_OUTPUT_DIR || 'reports';
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
