const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { normalizeBaseUrl } = require('./normalizeBaseUrl');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getMissingHealthEnvVars, HEALTH_SPEC_CONFIG_MAP } = require('../utils/validateHealthEnv');
const { uploadToGcs } = require('../utils/gcs-uploader');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.join(__dirname, '..');
const UI_DIR = path.join(ROOT_DIR, 'ui');
const SESSIONS_DIR = path.join(ROOT_DIR, 'sessions');
const TESTING_DIR = path.join(ROOT_DIR, 'tests');
const REFERENCE_DIR = path.join(ROOT_DIR, 'reference_files');
const RAW_QA_DIR = path.join(ROOT_DIR, 'raw_qa_files');
const ACCURACY_REPORTS_DIR = path.join(ROOT_DIR, 'reports', 'accuracy');

// We keep these directories eagerly created so every route can assume a stable filesystem shape.
[SESSIONS_DIR, REFERENCE_DIR, RAW_QA_DIR, ACCURACY_REPORTS_DIR].forEach((dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

app.use('/ui', express.static(UI_DIR));
app.get('/', (_req, res) => {
  // Redirecting to /ui keeps the browser entrypoint obvious for non-technical users.
  res.redirect('/ui/');
});

const SESSION_TTL_MS = 60 * 60 * 1000;
const REQUIRED_ENV_VARS = [
  'BASE_URL',
  'HEALTH_TEMPLATE_ICF_TRIMMED',
  'HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED',
  'HEALTH_SOURCES_ICF_TRIMMED',
  'HEALTH_SOURCE_FOLDER_ICF_TRIMMED',
];

// Map<sessionId, { clients: ServerResponse[], startTime: number }>
const sessions = new Map();
const accuracyWatchClients = new Set();
const rawQaWatchDedup = new Map();

let scoringInProgress = false;
let accuracyModules = null;
let accuracyModulesError = null;

function ensureSessionDir(sessionId) {
  const dirPath = path.join(SESSIONS_DIR, sessionId);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function sessionDir(sessionId) {
  return path.join(SESSIONS_DIR, sessionId);
}

const SAFE_ENV_KEYS = [
  'HEALTH_TEMPLATE_FOLDER_IDEAYA',
  'HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED',
  'BASE_URL',
  'BASEURL'
];

function collectEnvStatus() {
  const present = [];
  const missing = [];

  for (const envName of REQUIRED_ENV_VARS) {
    if ((process.env[envName] || '').trim()) {
      present.push(envName);
    } else {
      missing.push(envName);
    }
  }

  const safeValues = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      safeValues[key] = process.env[key];
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    present,
    baseUrl: process.env.BASEURL || process.env.BASE_URL,
    safeValues
  };
}

function logEnvWarnings() {
  const status = collectEnvStatus();

  for (const envName of status.missing) {
    // We warn instead of crashing because the server is still useful for accuracy scoring alone.
    console.warn(
      `[ENV] WARNING: ${envName} is not set. Health scripts for ICF Trimmed will fail.`
    );
  }
}

function sanitizeLogMessage(message) {
  let sanitized = message
    .toString()
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL]')
    // Note: This regex masks Windows-style paths in logs. On Linux containers,
    // paths will appear unmasked — cosmetic difference only, not a security issue.
    .replace(/[a-zA-Z]:\\[^\s)]+/gi, '[PATH]')
    .replace(/(?:\/[a-zA-Z0-9._-]+){2,}/g, '[PATH]');

  if (sanitized.includes(' at ')) {
    sanitized = sanitized
      .split('\n')
      .filter((line) => !line.trim().startsWith('at '))
      .join('\n');
  }

  return sanitized;
}

function broadcastLog(sessionId, type, message) {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  const payload = `data: ${JSON.stringify({
    type,
    message: sanitizeLogMessage(message),
    elapsed: Date.now() - session.startTime,
  })}\n\n`;

  for (const client of session.clients) {
    client.write(payload);
  }
}

function broadcastAccuracyWatch(payload) {
  const envelope = `data: ${JSON.stringify(payload)}\n\n`;

  for (const client of accuracyWatchClients) {
    client.write(envelope);
  }
}

function scheduleSessionCleanup(sessionId) {
  setTimeout(() => {
    const dirPath = sessionDir(sessionId);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[Session] ${sessionId} cleaned up after TTL expiry.`);
    }
    sessions.delete(sessionId);
  }, SESSION_TTL_MS);
}

function listAccuracyResults() {
  if (!fs.existsSync(ACCURACY_REPORTS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(ACCURACY_REPORTS_DIR)
    .filter((fileName) => fileName.endsWith('.xlsx') || fileName.endsWith('.json'))
    .map((fileName) => {
      const filePath = path.join(ACCURACY_REPORTS_DIR, fileName);
      const stats = fs.statSync(filePath);
      return {
        name: fileName,
        mtimeMs: stats.mtimeMs,
        generatedAt: parseAccuracyTimestamp(fileName),
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
}

function parseAccuracyTimestamp(fileName) {
  const match = fileName.match(/^accuracy-report-(.+)\.(xlsx|json)$/i);
  if (!match) {
    return null;
  }

  const restoredIso = match[1].replace(
    /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)$/,
    '$1:$2:$3.$4'
  );

  return Number.isNaN(Date.parse(restoredIso)) ? null : restoredIso;
}

function detectPrefix(fileName) {
  const normalized = String(fileName || '').toUpperCase();

  if (normalized.includes('CSR')) {
    return 'CSR';
  }
  if (normalized.includes('M264') || normalized.includes('264')) {
    return 'M264';
  }
  if (normalized.includes('ICF')) {
    return 'ICF';
  }

  return 'unknown';
}

function cellText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function getRawQaWorkbookInfo(filePath) {
  const workbook = XLSX.readFile(filePath);
  let worksheet = null;
  let format = '';

  if (workbook.Sheets.Evaluation_Data) {
    worksheet = workbook.Sheets.Evaluation_Data;
    format = 'Evaluation_Data';
  } else if (workbook.Sheets.QA) {
    worksheet = workbook.Sheets.QA;
    format = 'QA';
  } else {
    throw new Error(
      'Unsupported file format. The raw QA file must have a sheet named "Evaluation_Data" or "QA".'
    );
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  const dataRows = rows.slice(2).filter((row) => cellText(row[0]));

  return {
    format,
    rawRows: dataRows.length,
  };
}

function getReferenceDiagnostics(refMap) {
  let duplicateCount = 0;
  let totalEntries = 0;
  let blankExpectedCount = 0;

  for (const refs of refMap.values()) {
    totalEntries += refs.length;
    if (refs.length > 1) {
      duplicateCount += 1;
    }
    for (const ref of refs) {
      if (!String(ref.expectedText || '').trim()) {
        blankExpectedCount += 1;
      }
    }
  }

  return {
    duplicateCount,
    totalEntries,
    blankExpectedCount,
    allExpectedValuesBlank: totalEntries > 0 && blankExpectedCount === totalEntries,
  };
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function registerTsNode() {
  try {
    require('ts-node').register({
      transpileOnly: true,
      skipProject: true,
      compilerOptions: {
        module: 'Node16',
        moduleResolution: 'node16',
        target: 'ES2022',
        esModuleInterop: true,
        ignoreDeprecations: '6.0',
      },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    accuracyModulesError = message;
    console.error('[Accuracy] FAILED to register ts-node:', message);
    console.error(
      '[Accuracy] Accuracy routes will return 500 until this is resolved.'
    );
    console.error(
      '[Accuracy] Fix: run "npm install ts-node" or check tsconfig.json paths.'
    );
    return false;
  }
}

function validateAccuracyModules() {
  try {
    accuracyModules = {
      ...require(path.join(TESTING_DIR, 'helpers', 'accuracy-scorer')),
      ...require(path.join(TESTING_DIR, 'helpers', 'accuracy-report-writer')),
      ...require(path.join(TESTING_DIR, 'helpers', 'reference-file-loader')),
    };
    accuracyModulesError = null;
    console.log('[Accuracy] TypeScript modules loaded successfully via ts-node.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    accuracyModules = null;
    accuracyModulesError = message;
    console.error('[Accuracy] FAILED to load TypeScript modules:', message);
    console.error(
      '[Accuracy] Accuracy routes will return 500 until this is resolved.'
    );
    console.error(
      '[Accuracy] Fix: run "npm install ts-node" or check tsconfig.json paths.'
    );
  }
}

function loadAccuracyModulesOrThrow() {
  if (!accuracyModules) {
    validateAccuracyModules();
  }

  if (!accuracyModules) {
    throw new Error(
      accuracyModulesError ||
        'Accuracy TypeScript modules are unavailable. Check ts-node startup logs.'
    );
  }

  return accuracyModules;
}

function startRawQaWatcher() {
  try {
    fs.watch(RAW_QA_DIR, (eventType, fileName) => {
      if (!fileName) {
        return;
      }

      const normalizedName = String(fileName);
      if (!normalizedName.toLowerCase().endsWith('.xlsx')) {
        return;
      }

      const fullPath = path.join(RAW_QA_DIR, normalizedName);
      if (!fs.existsSync(fullPath)) {
        return;
      }

      // Windows can emit duplicate fs.watch events, so we throttle notifications per file.
      const now = Date.now();
      const previous = rawQaWatchDedup.get(normalizedName) || 0;
      if (now - previous < 1000) {
        return;
      }
      rawQaWatchDedup.set(normalizedName, now);

      broadcastAccuracyWatch({
        event: 'file-added',
        filename: normalizedName,
        timestamp: new Date().toISOString(),
        eventType,
      });
    });

    console.log(`[Accuracy] Watching ${RAW_QA_DIR} for new QA files.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Accuracy] WARNING: raw_qa_files watcher could not start: ${message}`);
  }
}

logEnvWarnings();
if (registerTsNode()) {
  validateAccuracyModules();
}
startRawQaWatcher();

app.get('/list-tests', (_req, res) => {
  if (!fs.existsSync(TESTING_DIR)) {
    return res.status(404).json({ error: 'Tests directory not found.' });
  }

  // accuracy.spec.ts is excluded because it needs file arguments — the
  // Accuracy Scorer panel drives it instead. AW_11_to_20_* used to be excluded
  // too, which hid the only spec the Template/Source form actually configures.
  const specFiles = fs
    .readdirSync(TESTING_DIR)
    .filter((fileName) => fileName.endsWith('.spec.ts'))
    .filter((fileName) => fileName !== 'accuracy.spec.ts');

  return res.json(specFiles);
});

app.get('/stream', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const session = sessions.get(sessionId);
  session.clients.push(res);

  req.on('close', () => {
    const currentSession = sessions.get(sessionId);
    if (!currentSession) {
      return;
    }
    currentSession.clients = currentSession.clients.filter((client) => client !== res);
  });
});

app.get('/api/accuracy/watch', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  accuracyWatchClients.add(res);

  // Sending an initial event makes the client immediately know the watcher is alive.
  res.write(
    `data: ${JSON.stringify({
      event: 'connected',
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  req.on('close', () => {
    accuracyWatchClients.delete(res);
  });
});

app.get('/api/env-status', (_req, res) => {
  try {
    return res.json(collectEnvStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Failed to inspect environment: ${message}` });
  }
});

app.post('/run-test', (req, res) => {
  const testFile = req.body.testFile;
  if (!testFile) {
    return res.status(400).json({ error: 'testFile is required.' });
  }

  // ── Health spec env var validation gate ──────────────────────────────
  // Fires only for health_*.spec.ts — all other specs pass through.
  // Returns 400 synchronously before any session, directory, or
  // Playwright process is created. Zero side effects on failure.
  const isHealthSpec = /^health_.*\.spec\.ts$/.test(testFile);
  if (isHealthSpec) {
    const configKey = HEALTH_SPEC_CONFIG_MAP[testFile];
    if (!configKey) {
      return res.status(400).json({
        error: 'Health spec not found in validation map.',
        testFile,
        hint: 'Add this spec to HEALTH_SPEC_CONFIG_MAP in utils/validateHealthEnv.js',
      });
    }
    const missingVars = getMissingHealthEnvVars(configKey);
    if (missingVars && missingVars.length > 0) {
      return res.status(400).json({
        error: 'Health check cannot run — missing required env vars',
        missing: missingVars,
        configKey,
        hint: 'Check .env and .env.example for the required variables.',
      });
    }
  }
  // ── End health gate ──────────────────────────────────────────────────

  const sessionId = crypto.randomUUID();
  const dirPath = ensureSessionDir(sessionId);

  sessions.set(sessionId, {
    clients: [],
    startTime: Date.now(),
  });

  const configFile = path.join(dirPath, 'runtime-config.json');
  fs.writeFileSync(configFile, JSON.stringify(req.body, null, 2));

  const testPath = `tests/${testFile}`;
  console.log(`[${sessionId}] Running Playwright tests: ${testPath}`);

  res.status(202).json({ sessionId });

  broadcastLog(sessionId, 'phase', 'Pre-flight Check');
  broadcastLog(sessionId, 'info', 'Checking TypeScript compilation...');

  const tscProcess = spawn('npx tsc --noEmit --pretty', {
    shell: true,
    cwd: ROOT_DIR,
  });

  let tscErrors = '';

  tscProcess.stdout.on('data', (data) => {
    tscErrors += data.toString();
  });

  tscProcess.stderr.on('data', (data) => {
    tscErrors += data.toString();
  });

  tscProcess.on('close', (tscCode) => {
    if (tscCode !== 0) {
      console.error(`[${sessionId}] TypeScript compilation failed:\n${tscErrors}`);
      broadcastLog(sessionId, 'error', 'TypeScript syntax error found — test cannot run.');
      broadcastLog(
        sessionId,
        'error',
        tscErrors.trim() || 'Run "npx tsc --noEmit" in your terminal to see the full error.'
      );
      broadcastLog(sessionId, 'done', 'Test cycle aborted due to TypeScript errors.');

      if (fs.existsSync(configFile)) {
        fs.unlinkSync(configFile);
      }
      scheduleSessionCleanup(sessionId);
      return;
    }

    broadcastLog(sessionId, 'info', 'TypeScript compilation OK.');
    broadcastLog(sessionId, 'phase', 'Running Tests');
    broadcastLog(sessionId, 'info', `Running Playwright tests: ${testFile}...`);

    let customBaseUrl = process.env.BASEURL || process.env.BASE_URL;
    if (req.body.agileWriterUrl) {
      try {
        customBaseUrl = normalizeBaseUrl(req.body.agileWriterUrl);
        console.log(`[${sessionId}] Injected custom BASEURL: ${customBaseUrl}`);
      } catch (err) {
        broadcastLog(sessionId, 'error', `Failed to inject URL: ${err.message}`);
        console.error(`[${sessionId}] Failed to normalize custom URL: ${req.body.agileWriterUrl}`, err);
      }
    }

    const pwProcess = spawn(`npx playwright test ${testPath}`, {
      shell: true,
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        // Both names: nothing actually reads BASEURL — playwright.config.js and
        // runtime-config.ts both read BASE_URL. Setting only BASEURL made the
        // UI's Environment dropdown silently do nothing.
        BASEURL: customBaseUrl,
        BASE_URL: customBaseUrl,
        SESSION_ID: sessionId,
      },
    });

    pwProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
      broadcastLog(sessionId, 'log', data);
    });

    pwProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
      broadcastLog(sessionId, 'error', data);
    });

    pwProcess.on('close', (code) => {
      broadcastLog(sessionId, 'info', `Playwright exited with code: ${code}`);
      broadcastLog(sessionId, 'phase', 'Generating Report');
      broadcastLog(sessionId, 'info', 'Generating test report...');

      const reportProcess = spawn('node generate-word-report.js', {
        shell: true,
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          SESSION_ID: sessionId,
        },
      });

      reportProcess.stdout.on('data', (data) => {
        process.stdout.write(data);
        broadcastLog(sessionId, 'log', data);
      });

      reportProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
        broadcastLog(sessionId, 'error', data);
      });

      reportProcess.on('close', (reportCode) => {
        if (fs.existsSync(configFile)) {
          fs.unlinkSync(configFile);
          console.log(`[${sessionId}] runtime-config.json deleted`);
        }

        if (code !== 0 || reportCode !== 0) {
          broadcastLog(sessionId, 'done', 'Test cycle completed with failures.');
        } else {
          broadcastLog(sessionId, 'done', 'Test cycle completed successfully.');
        }

        scheduleSessionCleanup(sessionId);
      });
    });
  });
});

app.get('/download-report', (req, res) => {
  const { sessionId } = req.query;
  console.log(`[Download Request] Session ID: ${sessionId}`);
  if (!sessionId) {
    return res.status(400).send('sessionId is required.');
  }

  const dirPath = sessionDir(sessionId);
  if (!fs.existsSync(dirPath)) {
    return res.status(404).send('Session not found.');
  }

  const allFiles = fs.readdirSync(dirPath);
  console.log(`[Download] Files found in session dir:`, allFiles);
  
  const files = allFiles.filter((fileName) => fileName.endsWith('.docx'));
  const tmpFiles = allFiles.filter((fileName) => fileName.endsWith('.tmp'));
  
  console.log(`[Download] .docx candidates:`, files);
  console.log(`[Download] .tmp / partial files detected:`, tmpFiles.length > 0);

  if (!files.length) {
    return res.status(404).send('Report not found.');
  }

  const reportFile = path.join(dirPath, files[0]);
  let stats = fs.statSync(reportFile);
  
  if (stats.size < 1000 || (Date.now() - stats.mtimeMs) < 500) {
    console.log(`[Download] File too small or too new. Waiting 200ms for flush...`);
    // Retry exactly once after 200ms
    setTimeout(() => {
      if (!fs.existsSync(reportFile)) {
        return res.status(503).send('Report generation failed or was aborted.');
      }
      stats = fs.statSync(reportFile);
      if (stats.size < 1000 || (Date.now() - stats.mtimeMs) < 500) {
        console.error(`[Download Error] File is still suspect after retry (size: ${stats.size}). Rejecting download.`);
        return res.status(503).send('Report is incomplete or still writing. Please try again later.');
      }
      return res.download(reportFile, files[0]);
    }, 200);
    return;
  }

  console.log(`[Download] Selected File: ${files[0]}`);
  console.log(`[Download] File Size: ${stats.size} bytes`);
  console.log(`[Download] File mtime: ${stats.mtime}`);

  return res.download(reportFile, files[0]);
});

app.get('/api/accuracy/reference-files', (_req, res) => {
  try {
    const files = fs
      .readdirSync(REFERENCE_DIR)
      .filter((fileName) => fileName.endsWith('.xlsx'))
      .sort((left, right) => left.localeCompare(right));

    if (!files.length) {
      return res.json({
        files: [],
        message: 'No reference files found. Add .xlsx files to reference_files.',
      });
    }

    return res.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Failed to list reference files: ${message}` });
  }
});

app.get('/api/accuracy/raw-qa-files', (_req, res) => {
  try {
    const files = fs
      .readdirSync(RAW_QA_DIR)
      .filter((fileName) => fileName.endsWith('.xlsx'))
      .map((fileName) => ({
        name: fileName,
        mtimeMs: fs.statSync(path.join(RAW_QA_DIR, fileName)).mtimeMs,
      }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
      .map((entry) => entry.name);

    if (!files.length) {
      return res.json({
        files: [],
        message: 'No raw QA files found. Drop your AgileWriter QA output here.',
      });
    }

    return res.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Failed to list raw QA files: ${message}` });
  }
});

app.post('/api/accuracy/score', async (req, res) => {
  const { referenceFile, rawQAFile } = req.body || {};
  if (!referenceFile || !rawQAFile) {
    return res.status(400).json({
      error: 'Both referenceFile and rawQAFile are required.',
    });
  }

  if (scoringInProgress) {
    return res.status(429).json({
      error: 'A scoring run is already in progress. Wait for it to finish before starting another.',
    });
  }

  const refPrefix = detectPrefix(referenceFile);
  const rawPrefix = detectPrefix(rawQAFile);
  if (refPrefix !== 'unknown' && rawPrefix !== 'unknown' && refPrefix !== rawPrefix) {
    return res.status(400).json({
      error: `File type mismatch: reference file looks like ${refPrefix} but raw QA file looks like ${rawPrefix}. Select matching files.`,
    });
  }

  const refPath = path.join(REFERENCE_DIR, path.basename(referenceFile));
  const rawPath = path.join(RAW_QA_DIR, path.basename(rawQAFile));

  if (!fs.existsSync(refPath)) {
    return res.status(400).json({
      error: `File not found: ${referenceFile}. It may have been deleted after the list was loaded. Refresh and try again.`,
    });
  }
  if (!fs.existsSync(rawPath)) {
    return res.status(400).json({
      error: `File not found: ${rawQAFile}. It may have been deleted after the list was loaded. Refresh and try again.`,
    });
  }

  scoringInProgress = true;

  try {
    // We yield briefly after taking the lock so a near-simultaneous second request
    // has a chance to hit the 429 path before the synchronous scoring work blocks the event loop.
    await pause(25);

    const { loadReferenceFile, scoreAll, generateReport } = loadAccuracyModulesOrThrow();

    const rawInfo = getRawQaWorkbookInfo(rawPath);
    if (rawInfo.rawRows === 0) {
      return res.status(400).json({
        error: 'The raw QA file has no data rows. Expected data starting from row 3.',
      });
    }

    const refMap = loadReferenceFile(refPath);
    const refDiagnostics = getReferenceDiagnostics(refMap);
    console.log(
      `[Accuracy] Reference file: ${refMap.size} unique placeholders, ${refDiagnostics.duplicateCount} with multiple entries (best-match will be used).`
    );
    console.log(
      `[Accuracy] Scoring ${rawInfo.rawRows} rows against ${refMap.size} reference entries...`
    );

    const scored = scoreAll(rawPath, refMap);
    if (scored.length === 0) {
      return res.status(400).json({
        error: 'Scorer returned 0 rows. The reference and raw QA files may be completely incompatible.',
      });
    }

    console.log(`[Accuracy] Done. ${scored.length} rows scored. Writing report...`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const excelFile = `accuracy-report-${timestamp}.xlsx`;
    const jsonFile = `accuracy-report-${timestamp}.json`;
    const excelPath = path.join(ACCURACY_REPORTS_DIR, excelFile);
    const jsonPath = path.join(ACCURACY_REPORTS_DIR, jsonFile);
    const summary = generateReport(scored, excelPath, jsonPath);

    // --- SCC-592: GCS Upload Phase (Durable Artifacts Only) ---
    // Fire-and-forget so we don't block the UI response timeout
    Promise.all([
      uploadToGcs(excelPath, `accuracy/${excelFile}`),
      uploadToGcs(jsonPath, `accuracy/${jsonFile}`)
    ]).catch(err => {
      console.error('[GCS] Unhandled upload error in accuracy route:', err.message || String(err));
    });
    // --- End GCS Upload Phase ---


    const missingCount = scored.filter((row) => row.status === 'Missing Reference').length;
    const warningMessages = [];

    if (refMap.size === 0) {
      warningMessages.push('Reference file loaded 0 entries. Check the sheet format.');
    }

    if (refDiagnostics.allExpectedValuesBlank) {
      warningMessages.push(
        'Reference file loaded but all expected values are empty. Check that row 1 is the header row and data starts from row 2.'
      );
    }

    if (scored.length > 0 && missingCount / scored.length >= 0.7) {
      warningMessages.push(
        'HIGH MISMATCH: Over 70% of rows have no reference match. You may have selected the wrong reference file.'
      );
    }

    return res.json({
      summary,
      warning: warningMessages.length ? warningMessages.join(' ') : undefined,
      excelPath: `/api/accuracy/download/${excelFile}`,
      jsonPath: `/api/accuracy/download/${jsonFile}`,
      rowCount: scored.length,
      missingReferenceCount: missingCount,
      rawRows: rawInfo.rawRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Unsupported file format')) {
      return res.status(400).json({ error: message });
    }

    console.error('[Accuracy] Scoring error:', error);
    return res.status(500).json({ error: message });
  } finally {
    // finally is required so a thrown error never leaves the lock stuck on forever.
    scoringInProgress = false;
  }
});

app.get('/api/accuracy/results', (_req, res) => {
  try {
    const items = listAccuracyResults();
    return res.json({
      files: items.map((item) => item.name),
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Failed to list accuracy results: ${message}` });
  }
});

app.get('/api/accuracy/download/:filename', (req, res) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(ACCURACY_REPORTS_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found.');
    }

    return res.download(filePath, safeFilename);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).send(`Failed to download file: ${message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
