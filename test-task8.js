const fs = require('fs');
const http = require('http');
const path = require('path');

const SESSION = 'test-corruption';
const DIR = path.join(__dirname, 'sessions', SESSION);
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const docxPath = path.join(DIR, 'run_Report.docx');
if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
// create an empty file
const fd = fs.openSync(docxPath, 'w');
fs.writeSync(fd, Buffer.from('PK')); // fake zip header

http.get(`http://localhost:3000/download-report?sessionId=${SESSION}`, (res) => {
  let size = 0;
  res.on('data', c => size += c.length);
  res.on('end', () => {
    console.log(`[Test] Downloaded ${size} bytes`);
    
    // Finish writing the file
    fs.writeSync(fd, Buffer.alloc(5000));
    fs.closeSync(fd);
    
    const finalSize = fs.statSync(docxPath).size;
    if (size < finalSize) {
      console.error(`FAIL: Downloaded file is corrupt! Size is ${size} but should be ${finalSize}`);
      process.exit(1);
    } else {
      console.log('PASS: File was downloaded completely or not at all');
      process.exit(0);
    }
  });
});
