/**
 * generate-report.js — PDF Report Generator for Agile Writer Validation
 *
 * WHAT IT DOES:
 *   Reads reports/step-results.json (created by the step-tracker during tests)
 *   and generates a professional PDF report at reports/AgileWriter_Report.pdf.
 *
 * THE PDF CONTAINS:
 *   1. Cover page with title and generation timestamp
 *   2. Executive Summary — total tests, passed, failed, success rate, execution time
 *   3. Placeholder Color Summary — green/grey/blue/red/yellow counts across all steps
 *   4. Per-test breakdowns — each test case gets its own page with:
 *      - Step-by-step results
 *      - Validation descriptions
 *      - Duration per step
 *      - Timestamp per step
 *      - Embedded screenshots
 *      - Color count tables (if available)
 *   5. Final Validation Summary
 *
 * HOW TO RUN:
 *   node generate-report.js
 *   (or: npm run report)
 *
 * PREREQUISITES:
 *   - npm install pdfkit (listed in package.json dependencies)
 *   - reports/step-results.json must exist (created by running tests)
 *
 * CONSEQUENCES:
 *   - Pro: Stakeholders get a readable PDF without needing Playwright installed
 *   - Pro: Embedded screenshots provide visual evidence of each step
 *   - Con: PDFKit doesn't have built-in table support — tables are drawn manually
 *   - Con: If a screenshot file was deleted, the PDF shows a warning instead
 *
 * BASED ON: Inayat's feature/custom_report branch (commit b4c5a7f)
 * ENHANCED WITH: Color count tables, timestamps, improved formatting
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const REPORT_DIR = './reports';
const STEP_FILE = path.join(REPORT_DIR, 'step-results.json');
const OUTPUT_FILE = path.join(REPORT_DIR, 'AgileWriter_Report.pdf');

// ──────────────────────────────────────────────
// LOAD STEP DATA
// ──────────────────────────────────────────────

if (!fs.existsSync(STEP_FILE)) {
  console.error('❌ step-results.json not found. Run tests first.');
  process.exit(1);
}

const steps = JSON.parse(fs.readFileSync(STEP_FILE, 'utf-8'));

// ──────────────────────────────────────────────
// GROUP STEPS BY TEST NAME
// ──────────────────────────────────────────────

const grouped = {};
steps.forEach((s) => {
  if (!grouped[s.testName]) grouped[s.testName] = [];
  grouped[s.testName].push(s);
});

// ──────────────────────────────────────────────
// COMPUTE SUMMARY STATISTICS
// ──────────────────────────────────────────────

const testNames = Object.keys(grouped);
const totalTests = testNames.length;

let passedTests = 0;
let failedTests = 0;
let totalExecutionTime = 0;

// Aggregate color counts across all steps
const totalColors = { green: 0, grey: 0, blue: 0, red: 0, yellow: 0, other: 0 };

testNames.forEach((name) => {
  const testSteps = grouped[name];
  const hasFailure = testSteps.some((s) => s.status === 'FAIL');
  if (hasFailure) failedTests++;
  else passedTests++;

  const testTime = testSteps.reduce((a, b) => a + b.duration, 0);
  totalExecutionTime += testTime;

  // Aggregate color counts from any step that has them
  testSteps.forEach((s) => {
    if (s.colorCounts) {
      totalColors.green += s.colorCounts.green || 0;
      totalColors.grey += s.colorCounts.grey || 0;
      totalColors.blue += s.colorCounts.blue || 0;
      totalColors.red += s.colorCounts.red || 0;
      totalColors.yellow += s.colorCounts.yellow || 0;
      totalColors.other += s.colorCounts.other || 0;
    }
  });
});

const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;

// ──────────────────────────────────────────────
// PDF GENERATION
// ──────────────────────────────────────────────

function generatePDF() {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(fs.createWriteStream(OUTPUT_FILE));

  // ═══════════════════ COVER / HEADER ═══════════════════

  doc.fontSize(22).text('Agile Writer Validation Report', { align: 'center' });
  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .fillColor('gray')
    .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(2);

  // ═══════════════════ EXECUTIVE SUMMARY ═══════════════════

  doc.fontSize(16).text('Executive Summary', { underline: true });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Total Test Cases: ${totalTests}`);
  doc.text(`Passed: ${passedTests}`);
  doc.text(`Failed: ${failedTests}`);
  doc.text(`Success Rate: ${passRate}%`);
  doc.text(`Total Execution Time: ${(totalExecutionTime / 1000).toFixed(2)}s`);
  doc.moveDown();

  const overallStatus = failedTests > 0 ? 'FAIL' : 'PASS';
  doc
    .fillColor(overallStatus === 'FAIL' ? 'red' : 'green')
    .fontSize(14)
    .text(`Overall Status: ${overallStatus}`);

  doc.fillColor('black');
  doc.moveDown(2);
  doc.fontSize(12);
  doc.text('Environment: QA');
  doc.text('Application: Agile Writer');
  doc.text('Execution Type: Automated Validation');
  doc.moveDown();

  // ═══════════════════ PLACEHOLDER COLOR SUMMARY ═══════════════════

  const hasColorData =
    totalColors.green + totalColors.grey + totalColors.blue + totalColors.red + totalColors.yellow > 0;

  if (hasColorData) {
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(14).text('Placeholder Status Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);

    doc.fillColor('#10b981').text(`  ● Populated (Green): ${totalColors.green}`);
    doc.fillColor('#9ca3af').text(`  ● Not Matched (Grey): ${totalColors.grey}`);
    doc.fillColor('#3b82f6').text(`  ● Match Found (Blue): ${totalColors.blue}`);
    doc.fillColor('#ef4444').text(`  ● Failed (Red): ${totalColors.red}`);
    doc.fillColor('#f6ea3b').text(`  ● Pending (Yellow): ${totalColors.yellow}`);
    if (totalColors.other > 0) {
      doc.fillColor('#666666').text(`  ● Other: ${totalColors.other}`);
    }

    const totalPlaceholders =
      totalColors.green + totalColors.grey + totalColors.blue + totalColors.red + totalColors.yellow + totalColors.other;
    doc.fillColor('black');
    doc.moveDown(0.5);
    doc.text(`  Total Placeholders: ${totalPlaceholders}`);
    if (totalPlaceholders > 0) {
      const populatedRate = ((totalColors.green / totalPlaceholders) * 100).toFixed(1);
      doc.text(`  Population Rate: ${populatedRate}%`);
    }
    doc.moveDown();
  }

  // Divider
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(2);

  // ═══════════════════ TEST DETAILS ═══════════════════

  testNames.forEach((testName) => {
    const testSteps = grouped[testName];
    const testTime = testSteps.reduce((a, b) => a + b.duration, 0);
    const hasFailure = testSteps.some((s) => s.status === 'FAIL');

    doc.addPage();

    // ──── Test Header ────
    doc.fontSize(15).text(`Test Case: ${testName}`, { underline: true });
    doc.moveDown();

    doc
      .fillColor(hasFailure ? 'red' : 'green')
      .fontSize(12)
      .text(`Status: ${hasFailure ? 'FAILED' : 'PASSED'}`);

    doc.fillColor('black');
    doc.text(`Execution Time: ${(testTime / 1000).toFixed(2)}s`);

    // Show first timestamp if available
    if (testSteps[0] && testSteps[0].timestamp) {
      doc.text(`Started: ${testSteps[0].timestamp}`);
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // ──── Steps ────
    testSteps.forEach((step, i) => {
      doc.moveDown(0.5);

      doc.fontSize(12).text(`${i + 1}. ${step.stepName}`);

      doc.fontSize(10).fillColor('gray').text(`Validation: ${step.validation}`);
      doc.fillColor('black');

      doc
        .fillColor(step.status === 'FAIL' ? 'red' : 'green')
        .text(`Status: ${step.status}`);
      doc.fillColor('black');

      doc.text(`Time: ${(step.duration / 1000).toFixed(2)}s`);

      if (step.timestamp) {
        doc.fontSize(9).fillColor('gray').text(`Timestamp: ${step.timestamp}`);
        doc.fillColor('black');
      }

      if (step.error) {
        doc.fontSize(9).fillColor('red').text(`Error: ${step.error}`);
        doc.fillColor('black');
      }

      // Color counts for this step
      if (step.colorCounts) {
        const cc = step.colorCounts;
        doc.fontSize(9).fillColor('gray');
        doc.text(
          `Colors: Green=${cc.green} Grey=${cc.grey} Blue=${cc.blue} Red=${cc.red} Yellow=${cc.yellow}`
        );
        doc.fillColor('black');
      }

      doc.moveDown(0.5);

      // Embed screenshot
      if (step.screenshot && fs.existsSync(step.screenshot)) {
        try {
          doc.image(step.screenshot, {
            fit: [400, 220],
            align: 'center',
          });
          doc.moveDown();
        } catch (err) {
          doc.fillColor('red').text('⚠ Failed to load screenshot');
          doc.fillColor('black');
        }
      } else {
        doc.fillColor('orange').text('⚠ Screenshot not available');
        doc.fillColor('black');
      }

      // Divider between steps
      doc.moveDown();
      doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke();
      doc.moveDown();
    });
  });

  // ═══════════════════ FINAL SUMMARY PAGE ═══════════════════

  doc.addPage();

  doc.fontSize(16).text('Final Validation Summary', { underline: true });
  doc.moveDown();

  doc.fontSize(12).text(`
  All core features and functionalities of the Agile Writer application
  have been validated through automated test execution.

  This report was generated automatically by the Playwright test suite
  and includes step-by-step verification with screenshots.

  Report covers: ${totalTests} test cases, ${steps.length} individual steps.
  Total execution time: ${(totalExecutionTime / 1000).toFixed(2)} seconds.
  `);

  doc.moveDown();

  if (hasColorData) {
    const totalPlaceholders =
      totalColors.green + totalColors.grey + totalColors.blue + totalColors.red + totalColors.yellow;
    doc.text(`Placeholder Analysis: ${totalPlaceholders} total placeholders evaluated.`);
    doc.text(`  Populated: ${totalColors.green} (${((totalColors.green / Math.max(totalPlaceholders, 1)) * 100).toFixed(1)}%)`);
    doc.text(`  Not populated: ${totalColors.grey + totalColors.red}`);
    doc.moveDown();
  }

  doc
    .fillColor(overallStatus === 'FAIL' ? 'red' : 'green')
    .fontSize(14)
    .text(`Overall System Status: ${overallStatus === 'FAIL' ? 'ISSUES DETECTED' : 'VALIDATED & STABLE'}`);
  doc.fillColor('black');

  doc.end();
  console.log('✔ Professional PDF generated:', OUTPUT_FILE);
}

// ──────────────────────────────────────────────
// RUN
// ──────────────────────────────────────────────
generatePDF();
