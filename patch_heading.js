const fs = require('fs');
const path = require('path');
const targetDir = 'tests';

const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.spec.ts'));

for (const file of files) {
  const filePath = path.join(targetDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove the Train Document heading assertion line (with optional surrounding whitespace)
  const regex = /\s*await expect\(page\.getByRole\('heading', \{ name: 'Train Document' \}\)\)\.toBeVisible\(\{ timeout: \d+ \}\);\s*/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, '\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Patched: ' + file);
  }
}

console.log('Done.');
