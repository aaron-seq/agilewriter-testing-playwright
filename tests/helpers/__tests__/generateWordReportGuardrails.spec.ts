const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Note: generate-word-report.js is currently a script. We will need to export
// the new functions (e.g. generateManifest, getFallbackDir, etc) during implementation.
// For the Red phase, we expect these to either not exist yet or fail.

// Helper to clean up temp files
function cleanupDir(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

test.describe('Report Generation Failure Guardrails (QA Guardian)', () => {
  const TEST_SESSION_ID = 'test-guardrails-session';
  const SESSIONS_DIR = path.join(__dirname, '..', '..', '..', 'sessions');
  const TEST_REPORT_DIR = path.join(SESSIONS_DIR, TEST_SESSION_ID);
  const FALLBACK_DIR = path.join(os.tmpdir(), 'agility-reports', TEST_SESSION_ID);

  test.beforeEach(() => {
    cleanupDir(TEST_REPORT_DIR);
    cleanupDir(FALLBACK_DIR);
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  });

  test.afterAll(() => {
    cleanupDir(TEST_REPORT_DIR);
    cleanupDir(FALLBACK_DIR);
  });

  // ── A. Contract Evolution Tests ──
  test.describe('Contract Validation', () => {
    test('manifest schema strictly matches v1 contract shape', async () => {
      // Setup a valid step-results.json
      fs.mkdirSync(TEST_REPORT_DIR, { recursive: true });
      fs.writeFileSync(path.join(TEST_REPORT_DIR, 'step-results.json'), JSON.stringify([{ status: 'PASS', duration: 100 }]));

      // Require the generator (assuming we export a run method later)
      // For now, this will fail in Red Phase as we haven't implemented the logic.
      process.env.SESSION_ID = TEST_SESSION_ID;
      delete require.cache[require.resolve('../../../generate-word-report')];
      const generator = require('../../../generate-word-report');
      await generator.runWithFailureGuard();

      const manifestPath = path.join(TEST_REPORT_DIR, 'report_manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // Strict Shape Validation
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.manifestType).toBe('report-manifest');
      expect(typeof manifest.generatedBy).toBe('string');
      expect(typeof manifest.generatedAt).toBe('string');
      
      // Execution reference
      expect(manifest.execution).toBeDefined();
      expect(manifest.execution.source).toBe('step-results.json');
      expect(['PASS', 'FAIL', 'UNKNOWN']).toContain(manifest.execution.status);
      expect(typeof manifest.execution.totalSteps).toBe('number');
      
      // Reports array
      expect(Array.isArray(manifest.reports)).toBe(true);
      expect(manifest.reports.length).toBeGreaterThan(0);
      
      const docxReport = manifest.reports.find((r: any) => r.format === 'docx');
      expect(docxReport).toBeDefined();
      expect(docxReport.attempted).toBe(true);
      expect(['generated', 'failed', 'partial_output_present', 'artifact_write_failed']).toContain(docxReport.status);
    });
  });

  // ── B. Corruption & Reentrancy Tests ──
  test.describe('Corruption & Reentrancy', () => {
    test('handles malformed step-results.json (execution.status = UNKNOWN)', async () => {
      fs.mkdirSync(TEST_REPORT_DIR, { recursive: true });
      fs.writeFileSync(path.join(TEST_REPORT_DIR, 'step-results.json'), '{ malformed json');
      
      process.env.SESSION_ID = TEST_SESSION_ID;
      delete require.cache[require.resolve('../../../generate-word-report')];
      const generator = require('../../../generate-word-report');
      await generator.runWithFailureGuard();

      const manifestPath = path.join(TEST_REPORT_DIR, 'report_manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.execution.status).toBe('UNKNOWN');
    });

    test('reentrancy updates manifest without duplicate failure files', async () => {
      fs.mkdirSync(TEST_REPORT_DIR, { recursive: true });
      fs.writeFileSync(path.join(TEST_REPORT_DIR, 'step-results.json'), JSON.stringify([{ status: 'PASS', duration: 100 }]));
      
      const generator = require('../../../generate-word-report');
      process.env.SESSION_ID = TEST_SESSION_ID;
      
      await generator.runWithFailureGuard();
      const firstStat = fs.statSync(path.join(TEST_REPORT_DIR, 'report_manifest.json'));
      
      // Artificial delay to ensure timestamp updates
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await generator.runWithFailureGuard();
      const secondStat = fs.statSync(path.join(TEST_REPORT_DIR, 'report_manifest.json'));
      
      expect(secondStat.mtimeMs).toBeGreaterThan(firstStat.mtimeMs);
    });
  });

  // ── C. Cleanup & State Machine Tests ──
  test.describe('State Machine & Atomic Writes', () => {
    test('failed DOCX rename yields partial_output_present', async () => {
      fs.mkdirSync(TEST_REPORT_DIR, { recursive: true });
      fs.writeFileSync(path.join(TEST_REPORT_DIR, 'step-results.json'), JSON.stringify([{ status: 'PASS', duration: 100 }]));
      
      // Mock fs.renameSync to throw specifically for the DOCX file
      const originalRenameSync = fs.renameSync;
      fs.renameSync = (oldPath: any, newPath: any) => {
        if (String(oldPath).endsWith('.docx.tmp')) {
          throw new Error('Mock rename DOCX error');
        }
        return originalRenameSync(oldPath, newPath);
      };

      process.env.SESSION_ID = TEST_SESSION_ID;
      delete require.cache[require.resolve('../../../generate-word-report')];
      const generator = require('../../../generate-word-report');
      await generator.runWithFailureGuard();

      const manifestPath = path.join(TEST_REPORT_DIR, 'report_manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const docxReport = manifest.reports.find((r: any) => r.format === 'docx');
      
      expect(docxReport.status).toBe('partial_output_present');
      expect(docxReport.error).toBe('Mock rename DOCX error');
      
      const txtPath = path.join(TEST_REPORT_DIR, 'report_generation_failure.txt');
      expect(fs.existsSync(txtPath)).toBe(true);
      const txtContent = fs.readFileSync(txtPath, 'utf8');
      expect(txtContent).toContain('Status: partial_output_present');

      fs.renameSync = originalRenameSync;
    });

    test('atomic manifest write: failure to rename manifest.tmp falls back gracefully', async () => {
      fs.mkdirSync(TEST_REPORT_DIR, { recursive: true });
      fs.writeFileSync(path.join(TEST_REPORT_DIR, 'step-results.json'), JSON.stringify([{ status: 'PASS', duration: 100 }]));
      
      const originalRenameSync = fs.renameSync;
      fs.renameSync = (oldPath: any, newPath: any) => {
        if (String(oldPath).endsWith('report_manifest.json.tmp')) {
          throw new Error('Mock rename MANIFEST error');
        }
        return originalRenameSync(oldPath, newPath);
      };

      const originalConsoleError = console.error;
      let errorCalledWith = null;
      console.error = (msg, err) => {
        if (typeof msg === 'string' && msg.includes('CRITICAL')) {
           errorCalledWith = msg;
        }
      };

      process.env.SESSION_ID = TEST_SESSION_ID;
      delete require.cache[require.resolve('../../../generate-word-report')];
      const generator = require('../../../generate-word-report');
      await generator.runWithFailureGuard();

      expect(errorCalledWith).toContain('CRITICAL: Failed to write report_manifest.json');

      fs.renameSync = originalRenameSync;
      console.error = originalConsoleError;
    });
  });

  // ── D. Deterministic Fallback Hierarchy ──
  test.describe('Fallback Paths', () => {
    test('falls back to os.tmpdir()/agility-reports when SESSION_DIR is unwriteable', async () => {
      // Create session dir but make it readonly
      fs.mkdirSync(TEST_REPORT_DIR, { recursive: true });
      // We will mock fs.writeFileSync to fail if writing to TEST_REPORT_DIR's .write_test
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = (file: any, data: any) => {
        if (String(file).includes('.write_test')) {
          if (!String(file).includes('agility-reports')) {
            throw new Error('Mock permissions error');
          }
        }
        return originalWriteFileSync(file, data);
      };

      process.env.SESSION_ID = TEST_SESSION_ID;
      delete require.cache[require.resolve('../../../generate-word-report')];
      const generator = require('../../../generate-word-report');
      
      const outDir = generator.getFallbackDir();
      expect(outDir).toContain('agility-reports');
      expect(outDir).toContain(TEST_SESSION_ID);

      fs.writeFileSync = originalWriteFileSync;
    });
  });

});
