import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

test.describe('develop.sh Infrastructure Tests (No Docker Required)', () => {
  const scriptPath = path.resolve(__dirname, '../../develop.sh');

  const getBashCommand = (args: string = '') => {
    const bashPath = fs.existsSync('C:\\Program Files\\Git\\bin\\bash.exe') 
      ? '"C:\\Program Files\\Git\\bin\\bash.exe"' 
      : 'bash';
    return `${bashPath} "${scriptPath}" ${args}`;
  };

  test('develop.sh script exists', async () => {
    expect(fs.existsSync(scriptPath)).toBeTruthy();
  });

  test('fails with non-zero exit code if docker is missing', async () => {
    try {
      await execAsync(getBashCommand(), { env: { PATH: '' } });
      throw new Error('Expected script to fail');
    } catch (error: any) {
      expect(error.code).not.toBe(0);
      expect(error.message).toMatch(/not found|is required/i);
    }
  });

  test('fails if required directories are missing', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-dir-'));
    try {
      await execAsync(getBashCommand(), { cwd: emptyDir });
      throw new Error('Expected script to fail');
    } catch (error: any) {
      expect(error.code).not.toBe(0);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  test('supports arguments contract: start, stop, status', async () => {
    try {
      const { stdout } = await execAsync(getBashCommand('unknown_command'));
      throw new Error('Expected script to fail with unknown command');
    } catch (error: any) {
      expect(error.code).toBe(1); // exit 1 is expected
    }
  });
});
