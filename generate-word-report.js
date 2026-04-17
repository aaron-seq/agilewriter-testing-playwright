require('dotenv').config();
const fs = require('fs');
const path = require('path');
const htmlToDocx = require('html-to-docx');

const REPORT_DIR = path.join(__dirname, 'reports');
const STEP_FILE = path.join(REPORT_DIR, 'step-results.json');
const OUTPUT_FILE = path.join(REPORT_DIR, 'AgileWriter_Validation_Report.docx');
const RUNTIME_CONFIG_FILE = path.join(__dirname, 'runtime-config.json');

const DOCUMENT_SECTIONS = [
  { label: 'ICF Trimmed', suffix: 'ICF_TRIMMED' },
  { label: 'ICF Full', suffix: 'ICF_FULL' },
  { label: 'CSR', suffix: 'CSR' },
  { label: 'M264', suffix: 'M264' },
];

const runtimeMeta = fs.existsSync(RUNTIME_CONFIG_FILE)
  ? JSON.parse(fs.readFileSync(RUNTIME_CONFIG_FILE, 'utf-8'))
  : {};

const testerName = runtimeMeta.testerName || process.env.TESTER_NAME || 'Not configured';
const envName = runtimeMeta.envName || process.env.TEST_ENV || 'QA';
const appUrl = runtimeMeta.appUrl || process.env.APP_URL || process.env.BASE_URL || 'https://app-v2-rc1-aw.smarter.codes/signin';
const osName = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDuration(durationMs) {
  const safeDuration = Math.max(0, Number(durationMs || 0));
  const totalSeconds = Math.floor(safeDuration / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'Not recorded';
  }

  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return escapeHtml(timestamp);
  }

  return escapeHtml(value.toLocaleString());
}

function normalizeLabel(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readSteps() {
  if (!fs.existsSync(STEP_FILE)) {
    return [];
  }

  try {
    const content = fs.readFileSync(STEP_FILE, 'utf-8').trim();
    return content ? JSON.parse(content) : [];
  } catch (error) {
    console.warn('Unable to parse step-results.json. Generating report with empty step data.', error);
    return [];
  }
}

function groupByTestName(steps) {
  return steps.reduce((acc, step) => {
    if (!acc[step.testName]) {
      acc[step.testName] = [];
    }
    acc[step.testName].push(step);
    return acc;
  }, {});
}

function summarizeSteps(steps) {
  const totalDuration = steps.reduce((sum, step) => sum + Number(step.duration || 0), 0);
  const failedSteps = steps.filter((step) => step.status === 'FAIL');
  const criticalFailures = failedSteps.filter((step) => step.critical);
  const softFailures = failedSteps.filter((step) => !step.critical);
  const passedSteps = steps.filter((step) => step.status === 'PASS');

  return {
    totalSteps: steps.length,
    passedSteps: passedSteps.length,
    failedSteps: failedSteps.length,
    criticalFailures,
    softFailures,
    totalDuration,
    overallStatus: failedSteps.length > 0 ? 'FAIL' : 'PASS',
  };
}

function readHealthConfig(suffix) {
  const templateName = process.env[`HEALTH_TEMPLATE_${suffix}`] || 'Not configured';
  const templateFolder = process.env[`HEALTH_TEMPLATE_FOLDER_${suffix}`] || 'Not configured';
  const sourceNames = (process.env[`HEALTH_SOURCES_${suffix}`] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const sourceFolder = process.env[`HEALTH_SOURCE_FOLDER_${suffix}`] || 'Not configured';
  const outputPrefix = process.env[`HEALTH_OUTPUT_PREFIX_${suffix}`] || 'Not configured';

  return {
    templateName,
    templateFolder,
    sourceNames,
    sourceFolder,
    outputPrefix,
  };
}

function buildOutputPatterns(outputPrefix) {
  const prefix = outputPrefix && outputPrefix !== 'Not configured' ? outputPrefix : 'OUTPUT_PREFIX';
  return [
    `${prefix}_*_SB_raw_qa.xlsx`,
    `${prefix}_*_SB_raw.docx`,
    `${prefix}_*_SB_clean.docx`,
    `${prefix}_*_SB.docx`,
  ];
}

function renderStatusBadge(status) {
  const className = status === 'PASS' ? 'pass' : 'fail';
  return `<span class="status ${className}">${escapeHtml(status)}</span>`;
}

function renderSourceList(sourceNames) {
  if (!sourceNames.length) {
    return '<p><em>No source documents configured.</em></p>';
  }

  return `
    <ul>
      ${sourceNames.map((source) => `<li><code>${escapeHtml(source)}</code></li>`).join('')}
    </ul>
  `;
}

function renderFailureList(steps, criticalOnly) {
  const failures = steps.filter((step) => step.status === 'FAIL' && step.critical === criticalOnly);
  if (!failures.length) {
    return '<p><em>None recorded.</em></p>';
  }

  return `
    <ul>
      ${failures
        .map((step) => `
          <li>
            <strong>${escapeHtml(step.stepName)}</strong>
            <div>${escapeHtml(step.error || 'Step failed without an error message.')}</div>
          </li>
        `)
        .join('')}
    </ul>
  `;
}

function renderColorSnapshots(steps) {
  const colorSteps = steps.filter((step) => step.colorCounts);
  if (!colorSteps.length) {
    return '<p><em>No placeholder color snapshots were recorded for this document.</em></p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Step</th>
          <th>Green</th>
          <th>Grey</th>
          <th>Blue</th>
          <th>Red</th>
          <th>Yellow</th>
          <th>Other</th>
        </tr>
      </thead>
      <tbody>
        ${colorSteps
          .map((step) => `
            <tr>
              <td>${escapeHtml(step.stepName)}</td>
              <td>${step.colorCounts.green || 0}</td>
              <td>${step.colorCounts.grey || 0}</td>
              <td>${step.colorCounts.blue || 0}</td>
              <td>${step.colorCounts.red || 0}</td>
              <td>${step.colorCounts.yellow || 0}</td>
              <td>${step.colorCounts.other || 0}</td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `;
}

function renderStepTable(steps) {
  if (!steps.length) {
    return '<p><em>No tracked steps found for this section in reports/step-results.json.</em></p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Step</th>
          <th>Validation</th>
          <th>Type</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        ${steps
          .map((step) => `
            <tr>
              <td>${escapeHtml(step.stepName)}</td>
              <td>${escapeHtml(step.validation)}</td>
              <td>${step.critical ? 'Critical' : 'Soft'}</td>
              <td>${renderStatusBadge(step.status)}</td>
              <td>${escapeHtml(formatDuration(step.duration))}</td>
              <td>${formatTimestamp(step.timestamp)}</td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `;
}

function findHealthSteps(steps, label) {
  const target = normalizeLabel(label);
  return steps.filter((step) => {
    if (!step.testName || !step.testName.startsWith('Health:')) {
      return false;
    }

    const reportName = step.testName.split(':').slice(1).join(':').trim();
    return normalizeLabel(reportName) === target;
  });
}

function renderDocumentSection(allSteps, documentSection) {
  const steps = findHealthSteps(allSteps, documentSection.label);
  const summary = summarizeSteps(steps);
  const config = readHealthConfig(documentSection.suffix);
  const outputPatterns = buildOutputPatterns(config.outputPrefix);

  return `
    <section>
      <h3>${escapeHtml(documentSection.label)}</h3>
      <div class="summary-card">
        <p><strong>Status:</strong> ${renderStatusBadge(summary.overallStatus)}</p>
        <p><strong>Total tracked steps:</strong> ${summary.totalSteps}</p>
        <p><strong>Execution time:</strong> ${escapeHtml(formatDuration(summary.totalDuration))}</p>
        <p><strong>Critical failures:</strong> ${summary.criticalFailures.length}</p>
        <p><strong>Soft failures:</strong> ${summary.softFailures.length}</p>
      </div>

      <h4>Configured Documents</h4>
      <p><strong>Destination template:</strong> <code>${escapeHtml(config.templateName)}</code></p>
      <p><strong>Template folder:</strong> <code>${escapeHtml(config.templateFolder)}</code></p>
      <p><strong>Source folder:</strong> <code>${escapeHtml(config.sourceFolder)}</code></p>
      <p><strong>Source document(s):</strong></p>
      ${renderSourceList(config.sourceNames)}

      <h4>Generated Output Pattern</h4>
      <p><strong>Output prefix:</strong> <code>${escapeHtml(config.outputPrefix)}</code></p>
      <p><em>Server IDs are generated at runtime, so the report shows filename patterns instead of exact links.</em></p>
      <ul>
        ${outputPatterns.map((pattern) => `<li><code>${escapeHtml(pattern)}</code></li>`).join('')}
      </ul>

      <h4>Critical Failures</h4>
      ${renderFailureList(steps, true)}

      <h4>Soft Failures</h4>
      ${renderFailureList(steps, false)}

      <h4>Placeholder Color Snapshots</h4>
      ${renderColorSnapshots(steps)}

      <h4>Step Timeline</h4>
      ${renderStepTable(steps)}
    </section>
  `;
}

function renderAdditionalCoverage(steps) {
  const grouped = groupByTestName(
    steps.filter((step) => !String(step.testName || '').startsWith('Health:'))
  );
  const testNames = Object.keys(grouped);

  if (!testNames.length) {
    return '';
  }

  return `
    <section>
      <h2>Additional Automated Coverage</h2>
      <p>The following non-health tracked tests were also present in <code>reports/step-results.json</code> when this report was generated.</p>
      <table>
        <thead>
          <tr>
            <th>Test</th>
            <th>Status</th>
            <th>Steps</th>
            <th>Duration</th>
            <th>Critical Failures</th>
            <th>Soft Failures</th>
          </tr>
        </thead>
        <tbody>
          ${testNames
            .map((testName) => {
              const summary = summarizeSteps(grouped[testName]);
              return `
                <tr>
                  <td>${escapeHtml(testName)}</td>
                  <td>${renderStatusBadge(summary.overallStatus)}</td>
                  <td>${summary.totalSteps}</td>
                  <td>${escapeHtml(formatDuration(summary.totalDuration))}</td>
                  <td>${summary.criticalFailures.length}</td>
                  <td>${summary.softFailures.length}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

async function generateWordReport() {
  const steps = readSteps();
  const overallSummary = summarizeSteps(steps);

  const htmlString = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Calibri, Arial, sans-serif;
            color: #111827;
            line-height: 1.5;
            font-size: 11pt;
          }
          h1 {
            font-size: 22pt;
            text-align: center;
            margin-bottom: 12px;
            color: #111827;
          }
          h2 {
            font-size: 15pt;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 4px;
            margin-top: 24px;
            color: #111827;
          }
          h3 {
            font-size: 13pt;
            margin-top: 18px;
            color: #1f2937;
          }
          h4 {
            font-size: 11pt;
            margin-top: 14px;
            margin-bottom: 6px;
            color: #374151;
          }
          p, li {
            font-size: 10.5pt;
          }
          .info-grid, .summary-card {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 12px;
            margin-bottom: 16px;
          }
          .status {
            font-weight: bold;
          }
          .status.pass {
            color: #0b8043;
          }
          .status.fail {
            color: #c53929;
          }
          code {
            background: #f3f4f6;
            padding: 1px 4px;
            border-radius: 3px;
            font-family: Consolas, "Courier New", monospace;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 14px;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 6px;
            vertical-align: top;
            font-size: 10pt;
          }
          th {
            background: #f3f4f6;
            text-align: left;
          }
          .muted {
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <h1>Agile Writer Validation Report</h1>

        <div class="info-grid">
          <p><strong>Performed by:</strong> ${escapeHtml(testerName)}</p>
          <p><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString())}</p>
          <p><strong>Application:</strong> Agile Writer</p>
          <p><strong>Application URL:</strong> ${escapeHtml(appUrl)}</p>
          <p><strong>Execution Type:</strong> Automated Validation</p>
          <p><strong>Environment:</strong> ${escapeHtml(envName)}</p>
          <p><strong>Operating System:</strong> ${escapeHtml(osName)}</p>
          <p><strong>Tracked Step Source:</strong> <code>${escapeHtml(STEP_FILE)}</code></p>
        </div>

        <h2>Overall Summary</h2>
        <div class="summary-card">
          <p><strong>Overall status:</strong> ${renderStatusBadge(overallSummary.overallStatus)}</p>
          <p><strong>Total tracked steps:</strong> ${overallSummary.totalSteps}</p>
          <p><strong>Passed steps:</strong> ${overallSummary.passedSteps}</p>
          <p><strong>Failed steps:</strong> ${overallSummary.failedSteps}</p>
          <p><strong>Critical failures:</strong> ${overallSummary.criticalFailures.length}</p>
          <p><strong>Soft failures:</strong> ${overallSummary.softFailures.length}</p>
          <p><strong>Total tracked time:</strong> ${escapeHtml(formatDuration(overallSummary.totalDuration))}</p>
        </div>

        <h2>Document Generation Phase</h2>
        <p class="muted">Each section below is built from the live contents of <code>step-results.json</code> plus the namespaced health-report configuration in your local <code>.env</code>.</p>

        ${DOCUMENT_SECTIONS.map((section) => renderDocumentSection(steps, section)).join('')}

        ${renderAdditionalCoverage(steps)}

        <h2>How to Read This Report</h2>
        <ul>
          <li><strong>Critical</strong> checks represent blocking workflow steps such as navigation, training progression, Apply All, final document creation, and downloads.</li>
          <li><strong>Soft</strong> checks capture non-blocking diagnostics such as preview rendering, optional integrations, and placeholder color snapshots.</li>
          <li>Server-generated document IDs are not known ahead of time, so output files are shown as filename patterns rather than direct SharePoint links.</li>
          <li>Screenshots remain on disk under <code>reports/screenshots</code> and are intentionally not embedded into the Word document.</li>
        </ul>
      </body>
    </html>
  `;

  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const fileBuffer = await htmlToDocx(htmlString, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
    font: 'Calibri',
    margins: {
      top: 720,
      right: 720,
      bottom: 720,
      left: 720,
    },
  });

  fs.writeFileSync(OUTPUT_FILE, fileBuffer);
  console.log(`Word report generated successfully at: ${OUTPUT_FILE}`);
}

generateWordReport().catch((error) => {
  console.error('Failed to generate Word report:', error);
  process.exitCode = 1;
});
