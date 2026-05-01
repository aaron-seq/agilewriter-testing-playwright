const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'ui' directory at the '/ui' path
app.use('/ui', express.static('ui'));

// ── Session Store ────────────────────────────────────────────────────────────
// Map<sessionId, { clients: res[], startTime: number }>
const sessions = new Map();

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
const TESTING_DIR = path.join(__dirname, '..', 'tests');

// TTL for session auto-cleanup: 1 hour
const SESSION_TTL_MS = 60 * 60 * 1000;

function ensureSessionDir(sessionId) {
  const dir = path.join(SESSIONS_DIR, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionDir(sessionId) {
  return path.join(SESSIONS_DIR, sessionId);
}

// ── Session Broadcast ─────────────────────────────────────────────────────────
function broadcastLog(sessionId, type, message) {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Sanitize message
  let sanitized = message.toString()
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL]')
    .replace(/[a-zA-Z]:\\[^\s)]+/gi, '[PATH]')
    .replace(/(?:\/[a-zA-Z0-9._-]+){2,}/g, '[PATH]');

  if (sanitized.includes(' at ')) {
    sanitized = sanitized.split('\n').filter(line => !line.trim().startsWith('at ')).join('\n');
  }

  const elapsed = Date.now() - session.startTime;
  const payload = `data: ${JSON.stringify({ type, message: sanitized, elapsed })}\n\n`;
  session.clients.forEach(client => client.write(payload));
}

// ── Session TTL Cleanup ───────────────────────────────────────────────────────
function scheduleSessionCleanup(sessionId) {
  setTimeout(() => {
    const dir = sessionDir(sessionId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✔ Session ${sessionId} cleaned up (TTL expired)`);
    }
    sessions.delete(sessionId);
  }, SESSION_TTL_MS);
}

// ── List available test files ─────────────────────────────────────────────────
app.get('/list-tests', (req, res) => {
  if (!fs.existsSync(TESTING_DIR)) {
    return res.status(404).json({ error: 'Tests directory not found' });
  }
  const files = fs.readdirSync(TESTING_DIR);
  const specFiles = files.filter(file => file.endsWith('.spec.ts'));
  res.json(specFiles);
});

// ── SSE Stream endpoint (per-session) ────────────────────────────────────────
app.get('/stream', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const session = sessions.get(sessionId);
  session.clients.push(res);

  req.on('close', () => {
    const s = sessions.get(sessionId);
    if (s) {
      s.clients = s.clients.filter(c => c !== res);
    }
  });
});

// ── Run test ──────────────────────────────────────────────────────────────────
app.post('/run-test', (req, res) => {
  const testFile = req.body.testFile;
  if (!testFile) {
    return res.status(400).json({ error: 'testFile is required' });
  }

  // Create a unique session for this run
  const sessionId = crypto.randomUUID();
  const dir = ensureSessionDir(sessionId);

  // Store session state
  sessions.set(sessionId, {
    clients: [],
    startTime: Date.now(),
  });

  // Write session-scoped config file
  const configFile = path.join(dir, 'runtime-config.json');
  fs.writeFileSync(configFile, JSON.stringify(req.body, null, 2));

  const testPath = `tests/${testFile}`;
  console.log(`✔ [${sessionId}] Running Playwright tests: ${testPath}...`);

  // Respond immediately with sessionId so the UI can connect to SSE right away
  res.status(202).json({ sessionId });

  // ── Phase 1: Running Tests ────────────────────────────────────────
  broadcastLog(sessionId, 'phase', 'Running Tests');
  broadcastLog(sessionId, 'info', `Running Playwright tests: ${testFile}...`);

  const pwProcess = spawn(
    `npx playwright test "${testPath}"`,
    {
      shell: true,
      env: {
        ...process.env,
        SESSION_ID: sessionId,
      },
    }
  );

  pwProcess.stdout.on('data', data => {
    process.stdout.write(data);
    broadcastLog(sessionId, 'log', data);
  });
  pwProcess.stderr.on('data', data => {
    process.stderr.write(data);
    broadcastLog(sessionId, 'error', data);
  });

  pwProcess.on('close', (code) => {
    broadcastLog(sessionId, 'info', `Playwright exited with code: ${code}`);

    // ── Phase 2: Generating Report ────────────────────────────────────
    console.log(`📄 [${sessionId}] Generating test report...`);
    broadcastLog(sessionId, 'phase', 'Generating Report');
    broadcastLog(sessionId, 'info', 'Generating test report...');

    const reportProcess = spawn('node generate-word-report.js', {
      shell: true,
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        SESSION_ID: sessionId,
      },
    });

    reportProcess.stdout.on('data', data => {
      process.stdout.write(data);
      broadcastLog(sessionId, 'log', data);
    });
    reportProcess.stderr.on('data', data => {
      process.stderr.write(data);
      broadcastLog(sessionId, 'error', data);
    });

    reportProcess.on('close', (reportCode) => {
      // SECURITY: delete runtime config after run
      if (fs.existsSync(configFile)) {
        fs.unlinkSync(configFile);
        console.log(`✔ [${sessionId}] runtime-config.json deleted`);
      }

      if (code !== 0 || reportCode !== 0) {
        broadcastLog(sessionId, 'done', '✖️ Test cycle completed with failures.');
      } else {
        broadcastLog(sessionId, 'done', '✔ Test cycle completed successfully.');
      }

      // Schedule TTL cleanup for this session (1 hour)
      scheduleSessionCleanup(sessionId);
    });
  });
});

// ── Download report (per-session) ─────────────────────────────────────────────
app.get('/download-report', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).send('sessionId is required');
  }

  const reportFile = path.join(sessionDir(sessionId), 'AgileWriter_Validation_Report.docx');
  if (!fs.existsSync(reportFile)) {
    return res.status(404).send('✖️ Report not found');
  }

  res.download(reportFile);
});

app.listen(3000, () => {
  console.log('✔ Server running at http://localhost:3000');
});