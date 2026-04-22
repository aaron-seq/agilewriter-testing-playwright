const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');

let sseClients = [];

function broadcastLog(type, message) {
  // Sanitize message: Remove Windows/Unix paths, emails, URLs, and stack traces
  let sanitized = message.toString()
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL]')
    .replace(/[a-zA-Z]:\\[^\s)]+/gi, '[PATH]') // Windows paths
    .replace(/(?:\/[a-zA-Z0-9._-]+){2,}/g, '[PATH]'); // Unix paths

  // Strip stack trace lines
  if (sanitized.includes(' at ')) {
    sanitized = sanitized.split('\n').filter(line => !line.trim().startsWith('at ')).join('\n');
  }

  const payload = `data: ${JSON.stringify({ type, message: sanitized })}\n\n`;
  sseClients.forEach(client => client.write(payload));
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'ui' directory at the '/ui' path
app.use('/ui', express.static('ui'));

const CONFIG_FILE = './runtime-config.json';
const REPORT_FILE = './reports/AgileWriter_Validation_Report.docx';

const TESTING_DIR = './tests';

// List available test files
app.get('/list-tests', (req, res) => {
  if (!fs.existsSync(TESTING_DIR)) {
    return res.status(404).json({ error: 'Tests directory not found' });
  }
  const files = fs.readdirSync(TESTING_DIR);
  // Filter for .spec.ts files and avoid directories
  const specFiles = files.filter(file => file.endsWith('.spec.ts'));
  res.json(specFiles);
});

// SSE Stream endpoint
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
});

// Run test
app.post('/run-test', (req, res) => {
  const testFile = req.body.testFile;
  if (!testFile) {
    return res.status(400).json({ error: 'testFile is required' });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(req.body, null, 2));

  const testPath = `tests/${testFile}`;
  console.log(`✔ Running Playwright tests: ${testPath}...`);
  broadcastLog('info', `Running Playwright tests: ${testFile}...`);

  const pwProcess = spawn(`npx playwright test "${testPath}"`, { shell: true });

  pwProcess.stdout.on('data', data => {
    process.stdout.write(data);
    broadcastLog('log', data);
  });
  pwProcess.stderr.on('data', data => {
    process.stderr.write(data);
    broadcastLog('error', data);
  });

  pwProcess.on('close', (code) => {
    broadcastLog('info', `Playwright exited with code: ${code}`);

    // Always generate the report regardless of test failure
    console.log('📄 Generating test report...');
    broadcastLog('info', 'Generating test report...');

    const reportProcess = spawn('node generate-word-report.js', { shell: true });
    
    reportProcess.stdout.on('data', data => {
      process.stdout.write(data);
      broadcastLog('log', data);
    });
    reportProcess.stderr.on('data', data => {
      process.stderr.write(data);
      broadcastLog('error', data);
    });

    reportProcess.on('close', (reportCode) => {
      // SECURITY FIX — DELETE CONFIG
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
        console.log('✔ runtime-config.json deleted');
      }

      broadcastLog('done', 'Test cycle completed.');

      if (code !== 0 || reportCode !== 0) {
        return res.status(500).send('✖️ Test completed with failures');
      }

      res.send({ message: '✔ Test completed successfully' });
    });
  });
});

// Download report
app.get('/download-report', (req, res) => {
  if (!fs.existsSync(REPORT_FILE)) {
    return res.status(404).send('✖️ Report not found');
  }

  res.download(REPORT_FILE);
});

app.listen(3000, () => {
  console.log('✔ Server running at http://localhost:3000');
});