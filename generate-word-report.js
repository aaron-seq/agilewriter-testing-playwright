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
  ? JSON.parse(fs.readFileSync(RUNTIME_CONFIG_FILE, 'utf8'))
  : {};

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

function normalizeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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

function readHealthConfig(suffix) {
  const sourceNames = (
    process.env[`HEALTH_SOURCES_${suffix}`] || ''
  )
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    templateName:
      process.env[`HEALTH_TEMPLATE_${suffix}`] ||
      'Not Configured',

    templateFolder:
      process.env[`HEALTH_TEMPLATE_FOLDER_${suffix}`] ||
      'Not Configured',

    sourceFolder:
      process.env[`HEALTH_SOURCE_FOLDER_${suffix}`] ||
      'Not Configured',

    outputPrefix:
      process.env[`HEALTH_OUTPUT_PREFIX_${suffix}`] ||
      'Not Configured',

    sourceNames,
  };
}

function buildOutputPatterns(prefix) {
  const p =
    prefix && prefix !== 'Not Configured'
      ? prefix
      : 'OUTPUT_PREFIX';

  return [
    `${p}_*_SB_raw_qa.xlsx`,
    `${p}_*_SB_raw.docx`,
    `${p}_*_SB_clean.docx`,
    `${p}_*_SB.docx`,
  ];
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

function findHealthSteps(allSteps, label) {
  const target = normalizeLabel(label);

  return allSteps.filter((step) => {
    if (
      !step.testName ||
      !step.testName.startsWith('Health:')
    ) {
      return false;
    }

    const report = step.testName
      .split(':')
      .slice(1)
      .join(':')
      .trim();

    return normalizeLabel(report) === target;
  });
}

function renderDocumentSection(allSteps, section) {
  const steps = findHealthSteps(
    allSteps,
    section.label
  );

  const summary = summarizeSteps(steps);
  const cfg = readHealthConfig(section.suffix);

  const timelineRows = steps.map((s) => [
    escapeHtml(s.stepName),
    escapeHtml(s.validation || ''),
    s.critical ? 'Critical' : 'Soft',
    statusBadge(s.status),
    formatDuration(s.duration),
    formatDateTime(s.timestamp),
  ]);

  return `
    <h2>${escapeHtml(section.label)}</h2>

    <p><strong>Status:</strong> ${statusBadge(
    summary.overallStatus
  )}</p>
    <p><strong>Total Steps:</strong> ${summary.totalSteps
    }</p>
    <p><strong>Duration:</strong> ${formatDuration(
      summary.totalDuration
    )}</p>

    <h3>Configured Documents</h3>

    <p><strong>Template:</strong> ${escapeHtml(
      cfg.templateName
    )}</p>

    <p><strong>Template Folder:</strong> ${escapeHtml(
      cfg.templateFolder
    )}</p>

    <p><strong>Source Folder:</strong> ${escapeHtml(
      cfg.sourceFolder
    )}</p>

    <h3>Generated Output Files</h3>

    <ul>
      ${buildOutputPatterns(cfg.outputPrefix)
      .map(
        (x) =>
          `<li>${escapeHtml(x)}</li>`
      )
      .join('')}
    </ul>

    <h3>Critical Failures</h3>
    ${renderFailures(steps, true)}

    <h3>Soft Failures</h3>
    ${renderFailures(steps, false)}

    <h3>Timeline</h3>
    ${timelineRows.length
      ? renderTable(
        [
          'Step',
          'Validation',
          'Type',
          'Status',
          'Duration',
          'Date & Time',
        ],
        timelineRows
      )
      : '<p>No Steps Found</p>'
    }
  `;
}

function renderCoverage(steps) {
  const grouped = groupByTestName(
    steps.filter(
      (x) =>
        !String(
          x.testName || ''
        ).startsWith('Health:')
    )
  );

  const names = Object.keys(grouped);

  if (!names.length) return '';

  const rows = names.map((name) => {
    const s = summarizeSteps(grouped[name]);

    return [
      escapeHtml(name),
      statusBadge(s.overallStatus),
      s.totalSteps,
      formatDuration(s.totalDuration),
      s.criticalFailures.length,
      s.softFailures.length,
    ];
  });

  return `
    <h2>Additional Automated Coverage</h2>
    ${renderTable(
    [
      'Test Name',
      'Status',
      'Steps',
      'Duration',
      'Critical',
      'Soft',
    ],
    rows
  )}
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

${DOCUMENT_SECTIONS.map((s) =>
      renderDocumentSection(steps, s)
    ).join('<hr/>')}

<hr/>

${renderCoverage(steps)}

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

async function generateWordReport() {
  ensureDir();

  const steps = readSteps();
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