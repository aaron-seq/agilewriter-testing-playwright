require('dotenv').config({ quiet: true });
const fs = require('fs');
const os = require('os');
const path = require('path');
const htmlToDocx = require('html-to-docx');
const { uploadToGcs } = require('./utils/gcs-uploader');

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

const testFileName = runtimeMeta.testFile || 'Not recorded';

// The URL the run actually used, which is not necessarily what the UI asked
// for — BASEURL/BASE_URL are injected by the server per run.
const baseUrlUsed =
  process.env.BASEURL ||
  process.env.BASE_URL ||
  runtimeMeta.baseUrl ||
  'Not recorded';

function readVersion(moduleName) {
  try {
    return require(`${moduleName}/package.json`).version;
  } catch {
    return 'unknown';
  }
}

// Reproducing a failure needs the versions, not just the outcome.
const toolVersions = [
  `Playwright ${readVersion('@playwright/test')}`,
  `Node ${process.version.replace(/^v/, '')}`,
].join(' | ');

function ensureDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

// Playwright colours its error text. Left in, the escape codes render as
// literal "[2m" / "[22m" noise in Word.
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\[[0-9;]*m/g;

function stripAnsi(value) {
  return String(value ?? '').replace(ANSI_PATTERN, '');
}

// html-to-docx mangles non-ASCII into U+FFFD replacement characters, so an
// em-dash or a middle dot reaches Word as a black diamond. Verified against
// html-to-docx 1.8: "X · Y" comes out as "X ? Y". Map the typography we
// use to ASCII rather than shipping garbage.
const ASCII_FALLBACKS = [
  [/[‘’‛]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, '-'],
  [/[·•]/g, '-'],
  [/…/g, '...'],
  [/ /g, ' '],
  [/[→⇒]/g, '->'],
  [/[✓✔]/g, 'PASS'],
  [/[✗✘✖]/g, 'FAIL'],
  [/⚠️?/g, '!'],
];

function toAscii(value) {
  let out = String(value ?? '');
  for (const [pattern, replacement] of ASCII_FALLBACKS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function escapeHtml(value) {
  return toAscii(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Error text, de-coloured, escaped, and with newlines kept readable in Word. */
function renderErrorText(value) {
  const cleaned = stripAnsi(value).trim();
  if (!cleaned) return 'No error message recorded';
  return escapeHtml(cleaned).replace(/\n/g, '<br/>');
}

/**
 * The headline a human reads first.
 *
 * summary.overallStatus stays PASS/FAIL because the manifest contract pins it
 * to those values. But "FAIL" alone is misleading when every failure was soft:
 * Playwright reports the run as passed, and the two disagree for no obvious
 * reason. This separates the two cases without touching the machine field.
 */
function verdict(summary) {
  if (summary.criticalFailures.length > 0) {
    return {
      label: `FAILED — ${summary.criticalFailures.length} critical failure(s)`,
      colour: '#C00000',
      meaning:
        'A step the run depends on did not work. Everything after it is unreliable, ' +
        'and the run did not prove what it set out to prove.',
    };
  }

  if (summary.softFailures.length > 0) {
    return {
      label: `COMPLETED WITH WARNINGS — ${summary.softFailures.length} soft failure(s)`,
      colour: '#B36B00',
      meaning:
        'Every critical step passed, so the main flow works. The failures below are ' +
        'non-blocking checks — usually a changed selector or a feature that is not ' +
        'available to this account. Playwright reports this run as passed.',
    };
  }

  return {
    label: 'PASSED',
    colour: '#107C10',
    meaning: 'Every recorded step passed.',
  };
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


/** Wall-clock bounds of the run, so the report shows when it actually ran. */
function firstTimestamp(steps) {
  return steps.length ? steps[0].timestamp : null;
}

function lastTimestamp(steps) {
  return steps.length ? steps[steps.length - 1].timestamp : null;
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
  // Issue 2 fix: zero steps means the test crashed before recording anything
  // (e.g., beforeAll threw due to missing env vars). This is a FAIL, not a PASS.
  if (steps.length === 0) {
    return {
      totalSteps: 0,
      passedSteps: 0,
      failedSteps: 1,
      criticalFailures: [{
        stepName: 'Environment or Setup Failure',
        status: 'FAIL',
        critical: true,
        duration: 0,
        timestamp: new Date().toISOString(),
        screenshot: '',
        error: 'No steps were recorded. The test failed before execution began — likely a beforeAll error or missing env vars.',
      }],
      softFailures: [],
      totalDuration: 0,
      overallStatus: 'FAIL',
    };
  }

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
    overallStatus: failed.length > 0 ? 'FAIL' : 'PASS',
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

  // Each failure is self-contained: what was being checked, when, how long it
  // waited, the de-coloured error, and the screenshot filename to open. Without
  // the screenshot name a reader has to guess which of 30 images belongs here.
  return rows
    .map((r) => `
      <div style="
        border-left:4px solid ${r.critical ? '#C00000' : '#B36B00'};
        background:#FAFAFA;
        padding:8px 12px;
        margin:0 0 12px 0;
      ">
        <p style="margin:0 0 4px 0;">
          <strong style="font-size:12pt;">${escapeHtml(r.stepName)}</strong>
        </p>
        <p style="margin:0 0 6px 0;color:#555;">
          <strong>Expected:</strong> ${escapeHtml(r.validation || 'Not recorded')}<br/>
          <strong>Failed after:</strong> ${formatDuration(r.duration)}
           | <strong>At:</strong> ${formatDateTime(r.timestamp)}
          ${r.screenshot
            ? `<br/><strong>Screenshot:</strong> ${escapeHtml(path.basename(r.screenshot))}`
            : ''}
        </p>
        <p style="
          margin:0;
          font-family:Consolas,monospace;
          font-size:9pt;
          color:#333;
          white-space:pre-wrap;
        ">${renderErrorText(r.error)}</p>
      </div>
    `)
    .join('');
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

<p style="text-align:center;color:#555;margin-top:-8px;">
  ${escapeHtml(testFileName)}
</p>

<div style="
  border:2px solid ${verdict(summary).colour};
  padding:12px 16px;
  margin:16px 0;
">
  <p style="margin:0;font-size:16pt;font-weight:bold;color:${verdict(summary).colour};">
    ${escapeHtml(verdict(summary).label)}
  </p>
  <p style="margin:6px 0 0 0;color:#333;">
    ${escapeHtml(verdict(summary).meaning)}
  </p>
</div>

${renderTable(
  ['', 'Result'],
  [
    ['Steps run', String(summary.totalSteps)],
    ['Passed', String(summary.passedSteps)],
    ['Critical failures', String(summary.criticalFailures.length)],
    ['Soft failures', String(summary.softFailures.length)],
    ['Total step time', formatDuration(summary.totalDuration)],
    ['First step', formatDateTime(firstTimestamp(steps))],
    ['Last step', formatDateTime(lastTimestamp(steps))],
  ]
)}

<h2 style="color:#1F4E78;">Run Details</h2>

${renderTable(
  ['', ''],
  [
    ['Performed by', escapeHtml(testerName)],
    ['Report generated', formatDateTime(new Date())],
    ['Test script', escapeHtml(testFileName)],
    ['Environment', escapeHtml(envName)],
    ['Base URL used', clickableLink(baseUrlUsed)],
    ['Sign-in URL', clickableLink(appUrl)],
    ['Session ID', escapeHtml(SESSION_ID || 'local run (no session)')],
    ['Machine', escapeHtml(`${osName} | ${os.hostname()}`)],
    ['Tooling', escapeHtml(toolVersions)],
    ['Step data', escapeHtml(STEP_FILE)],
  ]
)}

${summary.criticalFailures.length || summary.softFailures.length ? `
<h2 style="color:#1F4E78;">What Failed</h2>
<p style="color:#555;">
  Screenshots for each failure are in the <strong>screenshots</strong> folder beside
  this report, named at the end of each entry.
</p>

${summary.criticalFailures.length ? `
  <h3 style="color:#C00000;">Critical - these break the run</h3>
  ${renderFailures(steps, true)}
` : ''}

${summary.softFailures.length ? `
  <h3 style="color:#B36B00;">Soft - recorded, did not stop the run</h3>
  ${renderFailures(steps, false)}
` : ''}
` : ''}

<hr/>

${Object.entries(groupByTestName(steps))
  .map(([name, groupSteps]) => renderTestGroup(name, groupSteps))
  .join('<hr/>')}

<hr/>

<h2 style="color:#1F4E78;">How to read this report</h2>

<ul>
<li><strong>Critical</strong> steps stop the run. A critical failure means the
    result cannot be trusted.</li>
<li><strong>Soft</strong> steps are recorded and the run continues. Playwright
    still reports the run as passed, which is why this report can say
    "completed with warnings" while the console says passed.</li>
<li>Every failure above names its screenshot. They are in the
    <strong>screenshots</strong> folder next to this file.</li>
<li>A soft failure that repeats across runs is usually a changed selector or a
    permission the test account lacks - not a flake.</li>
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

// ── Report Generation Failure Guardrails ──

function getFallbackDir() {
  const dirs = [
    REPORT_DIR,
    SESSIONS_DIR,
    path.join(os.tmpdir(), 'agility-reports', SESSION_ID || 'unknown')
  ];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // Test writeability
      const testFile = path.join(dir, '.write_test');
      fs.writeFileSync(testFile, '');
      fs.unlinkSync(testFile);
      return dir;
    } catch (e) {
      continue;
    }
  }
  return null;
}

function resolveExecutionStatus() {
  let executionStatus = 'UNKNOWN';
  let totalSteps = 0;
  let failedSteps = 0;
  if (fs.existsSync(STEP_FILE)) {
    try {
      const raw = fs.readFileSync(STEP_FILE, 'utf8').trim();
      const rawSteps = raw ? JSON.parse(raw) : [];
      if (Array.isArray(rawSteps) && rawSteps.length > 0) {
        const summary = summarizeSteps(rawSteps);
        executionStatus = summary.overallStatus;
        totalSteps = summary.totalSteps;
        failedSteps = summary.failedSteps;
      }
    } catch (err) {
      executionStatus = 'UNKNOWN';
    }
  }
  return { status: executionStatus, totalSteps, failedSteps };
}

function buildManifest(reportStatus, errorMessage) {
  const execMeta = resolveExecutionStatus();
  return {
    schemaVersion: 1,
    manifestType: "report-manifest",
    generatedBy: "generate-word-report.js",
    generatedAt: new Date().toISOString(),
    sessionId: SESSION_ID || 'local',
    execution: {
      source: "step-results.json",
      status: execMeta.status,
      totalSteps: execMeta.totalSteps,
      failedSteps: execMeta.failedSteps
    },
    reports: [
      {
        format: "docx",
        attempted: true,
        status: reportStatus,
        path: OUTPUT_FILE,
        error: errorMessage || null
      }
    ]
  };
}

function buildTextReport(manifest, errorObj) {
  const docx = manifest.reports.find(r => r.format === 'docx');
  return `[DOCX]
Status: ${docx.status}
Error: ${docx.error || 'None'}
Stack: ${errorObj && errorObj.stack ? errorObj.stack : 'N/A'}
Recovery: ${docx.status === 'partial_output_present' ? 'A temporary or corrupted file exists. Check filesystem permissions or disk space.' : 'Check logs for missing dependencies or library crashes.'}
`;
}

async function runWithFailureGuard() {
  let reportStatus = 'failed';
  let errorObj = null;

  try {
    ensureDir();
    
    const rawSteps = readSteps();
    const steps = filterStepsForReport(rawSteps, runtimeMeta.testFile);
    const html = buildHtml(steps);

    console.time('DOCX Rendering');
    const fileBuffer = await htmlToDocx(html, null, {
      font: 'Calibri',
      margins: { top: 720, right: 720, bottom: 720, left: 720, header: 720, footer: 720, gutter: 0 }
    });
    console.timeEnd('DOCX Rendering');

    reportStatus = 'artifact_write_failed';
    const tmpFile = OUTPUT_FILE + '.tmp';
    
    console.time('Disk Write');
    fs.writeFileSync(tmpFile, fileBuffer);
    
    reportStatus = 'partial_output_present';
    fs.renameSync(tmpFile, OUTPUT_FILE);
    console.timeEnd('Disk Write');

    reportStatus = 'generated';
    console.log(`Word report generated successfully: ${OUTPUT_FILE}`);

  } catch (err) {
    errorObj = err;
    console.error('Report generation failed:', err);
    process.exitCode = 1;
  } finally {
    // Atomic Manifest Write
    const manifest = buildManifest(reportStatus, errorObj ? errorObj.message : null);
    const textReport = buildTextReport(manifest, errorObj);
    const outDir = getFallbackDir();
    
    if (outDir) {
      const manifestPath = path.join(outDir, 'report_manifest.json');
      const textPath = path.join(outDir, 'report_generation_failure.txt');
      
      try {
        const manifestTmp = manifestPath + '.tmp';
        fs.writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2));
        fs.renameSync(manifestTmp, manifestPath);
        
        if (reportStatus !== 'generated') {
          fs.writeFileSync(textPath, textReport);
        }

        // --- SCC-592: GCS Upload Phase (Durable Artifacts Only) ---
        // We await the upload so the script doesn't exit prematurely, 
        // but we wrap in a try/catch so a failure doesn't flip the exit code to 1.
        try {
          if (reportStatus === 'generated') {
            const reportName = path.basename(OUTPUT_FILE);
            const relativeDir = path.basename(outDir);
            
            // Upload DOCX
            await uploadToGcs(OUTPUT_FILE, `${relativeDir}/${reportName}`);
            // Upload Manifest
            await uploadToGcs(manifestPath, `${relativeDir}/report_manifest.json`);
          }
        } catch (uploadErr) {
          console.error('[GCS] Unhandled upload error:', uploadErr.message);
        }
        // --- End GCS Upload Phase ---

      } catch (manifestErr) {
        console.error('CRITICAL: Failed to write report_manifest.json', manifestErr);
      }
    } else {
      console.error('CRITICAL: No writeable directory found for failure artifacts.');
      console.error('Manifest Dump:', JSON.stringify(manifest, null, 2));
    }
  }
}

// Export for testing
module.exports = { 
  summarizeSteps, 
  runWithFailureGuard,
  getFallbackDir
};

if (require.main === module) {
  runWithFailureGuard();
}