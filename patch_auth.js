const fs = require('fs');
const path = require('path');
const targetDir = 'tests';

const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.spec.ts'));

for (const file of files) {
  if (file === 'AW_01_02_login_authentication.spec.ts') continue;
  if (file === 'AW_00_auth.setup.ts') continue;

  const filePath = path.join(targetDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace any instance of the Microsoft SSO click
  const regex = /await page\.getByRole\('button', \{ name: 'Microsoft Logo Sign In with' \}\)\.click\(\);/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, '// Playwright global session cache enabled, overriding manual SSO login');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${file}`);
  }
}
