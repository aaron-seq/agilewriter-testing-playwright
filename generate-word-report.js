require('dotenv').config();
const fs = require('fs');
const path = require('path');
const htmlToDocx = require('html-to-docx');

// ── Session-scoped paths ──────────────────────────────────────────────────────
const SESSION_ID = process.env.SESSION_ID || null;
const SESSIONS_DIR = path.join(__dirname, 'sessions');

// If a session ID is provided, use session-scoped directory.
// Otherwise fall back to the legacy reports/ directory for backwards compatibility.
const REPORT_DIR = SESSION_ID
  ? path.join(SESSIONS_DIR, SESSION_ID)
  : path.join(__dirname, 'reports');

const STEP_FILE = path.join(REPORT_DIR, 'step-results.json');
const RUNTIME_CONFIG_FILE = SESSION_ID
  ? path.join(SESSIONS_DIR, SESSION_ID, 'runtime-config.json')
  : path.join(__dirname, 'runtime-config.json');

// ── Report filename: <testName>_<YYYYMMDD_HHmm>_Report.docx ──────────────────
function buildReportFilename(testFile) {
  const base = path.basename(testFile || '', '.spec.ts') || 'run';
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${base}_${ts}_Report.docx`;
}

const runtimeMeta = fs.existsSync(RUNTIME_CONFIG_FILE)
  ? JSON.parse(fs.readFileSync(RUNTIME_CONFIG_FILE, 'utf8'))
  : {};

// Resolve output path now that runtimeMeta is available
const OUTPUT_FILE = path.join(REPORT_DIR, buildReportFilename(runtimeMeta.testFile));


const testerName =
  runtimeMeta.testerName ||
  process.env.TESTER_NAME ||
  'Not Configured';

const envName =
  runtimeMeta.envName ||
  process.env.TEST_ENV ||
  'QA';

const appUrl =
  runtimeMeta.appUrl ||
  process.env.APP_URL ||
  process.env.BASE_URL ||
  'https://app-v2-rc1-aw.smarter.codes/signin';

const osName =
  process.platform === 'win32'
    ? 'Windows'
    : process.platform === 'darwin'
      ? 'macOS'
      : 'Linux';

function ensureDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clickableLink(url) {
  const safe = escapeHtml(url);
  return `<a href="${safe}" style="color:#0563C1;text-decoration:underline;">${safe}</a>`;
}

function formatDateTime(value) {
  if (!value) return 'Not Recorded';

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return escapeHtml(value);
  }

  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDuration(ms) {
  const total = Math.max(0, Number(ms || 0));
  const sec = Math.floor(total / 1000);

  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


function readSteps() {
  if (!fs.existsSync(STEP_FILE)) return [];

  try {
    const raw = fs.readFileSync(STEP_FILE, 'utf8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Invalid step-results.json:', err.message);
    return [];
  }
}

function summarizeSteps(steps) {
  const totalDuration = steps.reduce(
    (sum, s) => sum + Number(s.duration || 0),
    0
  );

  const failed = steps.filter((s) => s.status === 'FAIL');
  const passed = steps.filter((s) => s.status === 'PASS');

  const criticalFailures = failed.filter((s) => s.critical);
  const softFailures = failed.filter((s) => !s.critical);

  return {
    totalSteps: steps.length,
    passedSteps: passed.length,
    failedSteps: failed.length,
    criticalFailures,
    softFailures,
    totalDuration,
    overallStatus: failed.length ? 'FAIL' : 'PASS',
  };
}

function groupByTestName(steps) {
  return steps.reduce((acc, step) => {
    const key = step.testName || 'Unknown Test';

    if (!acc[key]) acc[key] = [];
    acc[key].push(step);

    return acc;
  }, {});
}

function statusBadge(status) {
  const good = status === 'PASS';

  return `
    <span style="
      color:${good ? '#107C10' : '#C00000'};
      font-weight:bold;
    ">
      ${escapeHtml(status)}
    </span>
  `;
}


function renderTable(headers, rows) {
  return `
    <table style="
      width:100%;
      border-collapse:collapse;
      margin-top:8px;
      margin-bottom:14px;
      font-size:10pt;
    ">
      <tr>
        ${headers
      .map(
        (h) => `
          <th style="
            background:#D9E2F3;
            border:1px solid #808080;
            padding:6px;
            text-align:left;
          ">
            ${h}
          </th>
        `
      )
      .join('')}
      </tr>

      ${rows
      .map(
        (row, idx) => `
        <tr style="
          background:${idx % 2 === 0 ? '#FFFFFF' : '#F7F7F7'
          };
        ">
          ${row
            .map(
              (cell) => `
            <td style="
              border:1px solid #BFBFBF;
              padding:5px;
              vertical-align:top;
            ">
              ${cell}
            </td>
          `
            )
            .join('')}
        </tr>
      `
      )
      .join('')}
    </table>
  `;
}

function renderFailures(steps, criticalOnly) {
  const rows = steps.filter(
    (s) =>
      s.status === 'FAIL' &&
      !!s.critical === criticalOnly
  );

  if (!rows.length) {
    return `<p>None Recorded</p>`;
  }

  return `
    <ul>
      ${rows
      .map(
        (r) => `
        <li>
          <strong>${escapeHtml(
          r.stepName
        )}</strong><br/>
          ${escapeHtml(
          r.error || 'No error message'
        )}
        </li>
      `
      )
      .join('')}
    </ul>
  `;
}

/**
 * Render a detailed section for any group of steps, identified by testName.
 * Works for Health scripts (e.g. "Health: CSR") and AW scripts alike.
 * Automatically appears in the report for any testName found in step-results.json.
 */
function renderTestGroup(testName, steps) {
  const summary = summarizeSteps(steps);

  const timelineRows = steps.map((s) => [
    escapeHtml(s.stepName),
    escapeHtml(s.validation || ''),
    s.critical ? 'Critical' : 'Soft',
    statusBadge(s.status),
    formatDuration(s.duration),
    formatDateTime(s.timestamp),
  ]);

  return `
    <h2>${escapeHtml(testName)}</h2>

    <p><strong>Status:</strong> ${statusBadge(summary.overallStatus)}</p>
    <p><strong>Total Steps:</strong> ${summary.totalSteps}</p>
    <p><strong>Passed:</strong> ${summary.passedSteps}</p>
    <p><strong>Failed:</strong> ${summary.failedSteps}</p>
    <p><strong>Duration:</strong> ${formatDuration(summary.totalDuration)}</p>

    ${summary.criticalFailures.length ? `
      <h3>Critical Failures</h3>
      ${renderFailures(steps, true)}
    ` : ''}

    ${summary.softFailures.length ? `
      <h3>Soft Failures</h3>
      ${renderFailures(steps, false)}
    ` : ''}

    <h3>Step Timeline</h3>
    ${timelineRows.length
      ? renderTable(
        ['Step', 'Validation', 'Type', 'Status', 'Duration', 'Date & Time'],
        timelineRows
      )
      : '<p>No Steps Found</p>'
    }
  `;
}

function buildHtml(steps) {
  const summary = summarizeSteps(steps);

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>

<body style="
  font-family:Calibri,Arial,sans-serif;
  font-size:11pt;
  color:#222;
  line-height:1.45;
">

<h1 style="
  text-align:center;
  color:#1F4E78;
  font-size:24pt;
  margin-bottom:18px;
">
  Agile Writer Validation Report
</h1>

<p><strong>Performed By:</strong> ${escapeHtml(
    testerName
  )}</p>

<p><strong>Generated:</strong> ${formatDateTime(
    new Date()
  )}</p>

<p><strong>Application:</strong> Agile Writer</p>

<p><strong>Application URL:</strong> ${clickableLink(
    appUrl
  )}</p>

<p><strong>Environment:</strong> ${escapeHtml(
    envName
  )}</p>

<p><strong>Operating System:</strong> ${escapeHtml(
    osName
  )}</p>

<p><strong>Tracked File:</strong> ${escapeHtml(
    STEP_FILE
  )}</p>

<hr/>

<h2 style="color:#1F4E78;">Overall Summary</h2>

<p><strong>Status:</strong> ${statusBadge(
    summary.overallStatus
  )}</p>

<p><strong>Total Steps:</strong> ${summary.totalSteps
    }</p>

<p><strong>Passed:</strong> ${summary.passedSteps
    }</p>

<p><strong>Failed:</strong> ${summary.failedSteps
    }</p>

<p><strong>Critical Failures:</strong> ${summary.criticalFailures.length
    }</p>

<p><strong>Soft Failures:</strong> ${summary.softFailures.length
    }</p>

<p><strong>Total Duration:</strong> ${formatDuration(
      summary.totalDuration
    )}</p>

<hr/>

${Object.entries(groupByTestName(steps))
  .map(([name, groupSteps]) => renderTestGroup(name, groupSteps))
  .join('<hr/>')}

<hr/>

<h2 style="color:#1F4E78;">Notes</h2>

<ul>
<li>Green = Passed</li>
<li>Red = Failed</li>
<li>Tables use alternating row colors for readability</li>
<li>Links are clickable in Word</li>
<li>Screenshots remain in reports/screenshots</li>
</ul>

</body>
</html>
`;
}

function filterStepsForReport(steps, testFile) {
  if (!testFile) return steps; // Fallback if run without UI

  if (testFile.startsWith('health_')) {
    // Only include steps starting with 'Health:'
    return steps.filter(s => s.testName && s.testName.startsWith('Health:'));
  }

  if (testFile.includes('AW_11_to_20')) {
    // Exclude setup steps (AW_00 to AW_10)
    return steps.filter(s => s.testName && !/^AW_0\d/.test(s.testName));
  }

  // Otherwise, return all steps (e.g. for AW_00_10 itself)
  return steps;
}

async function generateWordReport() {
  ensureDir();

  const rawSteps = readSteps();
  const steps = filterStepsForReport(rawSteps, runtimeMeta.testFile);
  const html = buildHtml(steps);

  const fileBuffer = await htmlToDocx(
    html,
    null,
    {
      font: 'Calibri',
      margins: {
        top: 720,
        right: 720,
        bottom: 720,
        left: 720,
      },
    }
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    fileBuffer
  );

  console.log(
    `Word report generated successfully: ${OUTPUT_FILE}`
  );
}

generateWordReport().catch((err) => {
  console.error(
    'Failed to generate report:',
    err
  );
  process.exitCode = 1;
});