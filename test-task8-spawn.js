const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const SESSION = 'test-doc-generate';
const DIR = path.join(__dirname, 'sessions', SESSION);
if (fs.existsSync(DIR)) fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

fs.writeFileSync(path.join(DIR, 'runtime-config.json'), JSON.stringify({ testFile: 'Health: test' }));

// Spawn generate-word-report.js
const child = spawn('node', ['generate-word-report.js'], {
  env: { ...process.env, SESSION_ID: SESSION }
});

let testFinished = false;

// Hammer the download endpoint
const interval = setInterval(() => {
  if (testFinished) return clearInterval(interval);
  http.get(`http://localhost:3000/download-report?sessionId=${SESSION}`, (res) => {
    if (res.statusCode === 200) {
      let size = 0;
      res.on('data', c => size += c.length);
      res.on('end', () => {
        if (!testFinished) {
          testFinished = true;
          clearInterval(interval);
          if (size < 1000) { // arbitrary small size indicating partial/corrupt download
            console.error(`FAIL: Downloaded partial file! Size: ${size}`);
            process.exit(1);
          } else {
            console.log(`PASS: Downloaded complete file. Size: ${size}`);
            process.exit(0);
          }
        }
      });
    }
  }).on('error', () => {});
}, 10); // hammer every 10ms

child.on('exit', () => {
  if (!testFinished) {
    testFinished = true;
    clearInterval(interval);
    console.log('PASS: Child exited before download could catch it, meaning no partial file was served.');
    process.exit(0);
  }
});
