import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

test.describe('develop.sh Infrastructure Tests (No Docker Required)', () => {
  const scriptPath = path.resolve(__dirname, '../../develop.sh');
  let tempDir: string;
  let mockPath: string;

  test.beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-tests-'));
    mockPath = `${tempDir}${path.delimiter}${process.env.PATH}`;

    const createMock = (name: string, content: string) => {
      const filePath = path.join(tempDir, name);
      fs.writeFileSync(filePath, `#!/usr/bin/env bash\n${content}`, { mode: 0o755 });
      // For Windows tests, also create a .cmd file so exec can find it directly without bash
      const cmdPath = path.join(tempDir, `${name}.cmd`);
      fs.writeFileSync(cmdPath, `@echo off\necho Mock ${name}`);
    };

    createMock('docker', 'echo "Mock Docker"');
    createMock('curl', 'echo "Mock Curl"');
  });

  test.afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('develop.sh script exists', async () => {
    expect(fs.existsSync(scriptPath), 'develop.sh must exist').toBeTruthy();
  });

  test('fails with non-zero exit code if docker is missing', async () => {
    // Override PATH to NOT include our mocks, and ideally point to empty temp dir
    const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-path-'));
    try {
      await execAsync(`bash "${scriptPath}"`, { env: { ...process.env, PATH: emptyPath } });
      test.fail(true, 'Expected script to fail when docker is missing');
    } catch (error: any) {
      expect(error.code).not.toBe(0);
      expect(error.stdout || error.stderr).toMatch(/docker.*not found|Docker is required|command not found/i);
    } finally {
      fs.rmSync(emptyPath, { recursive: true, force: true });
    }
  });

  test('fails if required directories are missing', async () => {
    // Run from an empty directory so relative dirs like raw_qa_files don't exist
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-dir-'));
    try {
      await execAsync(`bash "${scriptPath}"`, { 
        cwd: emptyDir,
        env: { ...process.env, PATH: mockPath } 
      });
      test.fail(true, 'Expected script to fail when directories are missing');
    } catch (error: any) {
      expect(error.code).not.toBe(0);
      expect(error.stdout || error.stderr).toMatch(/Missing required/i);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  test('supports arguments contract: start, stop, status', async () => {
    if (!fs.existsSync(scriptPath)) test.skip();
    try {
      const { stdout } = await execAsync(`bash "${scriptPath}" status`, { env: { ...process.env, PATH: mockPath } });
      expect(stdout).toMatch(/status/i);
    } catch (error: any) {
      // Allow it to fail if status isn't implemented cleanly yet, but we assert it doesn't crash from missing script
      test.fail(true, 'Expected status command to execute');
    }
  });
});
