const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');

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

// Run test
app.post('/run-test', (req, res) => {
  const testFile = req.body.testFile;
  if (!testFile) {
    return res.status(400).json({ error: 'testFile is required' });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(req.body, null, 2));

  const testPath = `tests/${testFile}`;

  console.log(`✔ Running Playwright tests: ${testPath}...`);

  exec(`npx playwright test "${testPath}"`, (err, stdout, stderr) => {
    // Log outputs
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    if (err) console.error(`Playwright exited with error code: ${err.code}`);

    // Always generate the report regardless of test failure
    console.log('📄 Generating test report...');
    exec('node generate-word-report.js', (reportErr, reportStdout, reportStderr) => {
      if (reportStdout) console.log(reportStdout);
      if (reportStderr) console.error(reportStderr);

      //  SECURITY FIX — DELETE CONFIG
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
        console.log('✔ runtime-config.json deleted');
      }

      if (err || reportErr) {
        return res.status(500).send('✖️ Test completed with failures');
      }

      res.send({ message: ' ✔ Test completed successfully' });
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