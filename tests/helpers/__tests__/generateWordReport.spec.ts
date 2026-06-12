import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { execSync } from 'child_process';

test.describe('generate-word-report.js', () => {
  const SESSION_ID = 'test-docx-validation';
  const SESSION_DIR = path.join(__dirname, '../../..', 'sessions', SESSION_ID);
  
  test.beforeAll(() => {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    
    // Create minimal step results to generate a report
    const stepResults = [
      {
        testName: 'Health: Mock Test',
        stepName: 'Mock Step',
        validation: 'Mock Validation',
        status: 'PASS',
        critical: false,
        duration: 100,
        timestamp: new Date().toISOString()
      }
    ];
    fs.writeFileSync(
      path.join(SESSION_DIR, 'step-results.json'), 
      JSON.stringify(stepResults, null, 2)
    );
    
    const runtimeConfig = {
      testFile: 'health_mock.spec.ts',
      testerName: 'Automated Test',
      envName: 'QA',
      appUrl: 'http://localhost',
      startTime: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(SESSION_DIR, 'runtime-config.json'),
      JSON.stringify(runtimeConfig, null, 2)
    );
  });

  test.afterAll(() => {
    // Cleanup
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
  });

  test('generated docx contains no invalid XML literals', async () => {
    // 1. Run the report generator
    const scriptPath = path.join(__dirname, '../../..', 'generate-word-report.js');
    execSync(`node "${scriptPath}"`, {
      env: { ...process.env, SESSION_ID },
      stdio: 'pipe'
    });

    // 2. Find the generated report
    const files = fs.readdirSync(SESSION_DIR);
    const reportFile = files.find(f => f.endsWith('_Report.docx'));
    expect(reportFile).toBeDefined();

    const reportPath = path.join(SESSION_DIR, reportFile!);
    const buffer = fs.readFileSync(reportPath);

    // 3. Unzip and read document.xml
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();

    // 4. Assertions
    // "undefined" should never be serialized as a string in OOXML attributes
    expect(documentXml).not.toContain('"undefined"');
    expect(documentXml).not.toContain('"null"');
    expect(documentXml).not.toContain('"NaN"');
    expect(documentXml).not.toContain('"[object Object]"');

    // 5. Verify margin values are numeric
    const pgMarMatch = documentXml!.match(/<w:pgMar([^>]+)\/>/);
    expect(pgMarMatch).toBeTruthy();
    
    const pgMarAttributes = pgMarMatch![1];
    
    // Extract header, footer, gutter values using regex
    const headerMatch = pgMarAttributes.match(/w:header="([^"]+)"/);
    const footerMatch = pgMarAttributes.match(/w:footer="([^"]+)"/);
    const gutterMatch = pgMarAttributes.match(/w:gutter="([^"]+)"/);

    expect(headerMatch).toBeTruthy();
    expect(footerMatch).toBeTruthy();
    expect(gutterMatch).toBeTruthy();

    expect(headerMatch![1]).toMatch(/^\d+$/);
    expect(footerMatch![1]).toMatch(/^\d+$/);
    expect(gutterMatch![1]).toMatch(/^\d+$/);
  });
});
