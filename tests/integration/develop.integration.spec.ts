import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

test.describe('develop.sh Integration Tests (Requires Docker)', () => {
  const scriptPath = path.resolve(__dirname, '../../develop.sh');

  const runScript = async (args: string) => {
    const bashPath = fs.existsSync('C:\\Program Files\\Git\\bin\\bash.exe') 
      ? '"C:\\Program Files\\Git\\bin\\bash.exe"' 
      : 'bash';
    return execAsync(`${bashPath} "${scriptPath}" ${args}`);
  };

  test('develop.sh starts stack and returns healthy status', async () => {
    expect(fs.existsSync(scriptPath)).toBeTruthy();
    const { stdout } = await runScript('up');
    expect(stdout).toMatch(/Successfully started/i);
  });

  test('develop.sh is idempotent (second run succeeds)', async () => {
    const { stdout } = await runScript('up');
    expect(stdout).toMatch(/Successfully started/i);
  });

  test('develop.sh down tears down the stack cleanly', async () => {
    const { stdout } = await runScript('down');
    expect(stdout).toMatch(/Successfully tore down/i);
  });
});
