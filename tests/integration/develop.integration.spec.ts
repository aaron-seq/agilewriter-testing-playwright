import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

test.describe('develop.sh Integration Tests (Requires Docker)', () => {
  const scriptPath = path.resolve(__dirname, '../../develop.sh');

  test('develop.sh starts stack and returns healthy status', async () => {
    expect(fs.existsSync(scriptPath), 'develop.sh must exist').toBeTruthy();
    
    try {
      const { stdout } = await execAsync(`bash "${scriptPath}" up`);
      expect(stdout).toMatch(/Successfully started/i);
      expect(stdout).toMatch(/Healthcheck passed/i);
    } catch (error: any) {
      test.fail(true, `Integration test failed: ${error.stdout || error.stderr || error.message}`);
    }
  });

  test('develop.sh is idempotent (second run succeeds)', async () => {
    try {
      const { stdout } = await execAsync(`bash "${scriptPath}" up`);
      expect(stdout).toMatch(/Successfully started/i);
    } catch (error: any) {
      test.fail(true, `Idempotency test failed: ${error.stdout || error.stderr || error.message}`);
    }
  });

  test('develop.sh down tears down the stack cleanly', async () => {
    try {
      const { stdout } = await execAsync(`bash "${scriptPath}" down`);
      expect(stdout).toMatch(/Stopped and removed/i);
    } catch (error: any) {
      test.fail(true, `Teardown test failed: ${error.stdout || error.stderr || error.message}`);
    }
  });
});
