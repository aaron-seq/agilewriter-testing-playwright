import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

test.describe('SCC-464 Production Deployment Contract', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const scriptPath = path.join(repoRoot, 'deploy.sh');

  const bashPath = fs.existsSync('C:\\Program Files\\Git\\bin\\bash.exe')
    ? '"C:\\Program Files\\Git\\bin\\bash.exe"'
    : 'bash';

  const runDeploy = async (
    args: string,
    options: { env?: NodeJS.ProcessEnv; cwd?: string } = {}
  ) => execAsync(`${bashPath} "${scriptPath}" ${args}`, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      ...options.env,
    },
  });

  const makeTempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'scc464-deploy-'));

  const writeProductionCompose = (root: string) => {
    fs.writeFileSync(
      path.join(root, 'docker-compose.production.yml'),
      [
        'services:',
        '  app:',
        '    image: agilewriter:test',
        '    ports:',
        '      - "127.0.0.1:3000:3000"',
      ].join('\n')
    );
  };

  const writeNginxConfig = (root: string, body = 'server { listen 443 ssl; location / { proxy_pass http://127.0.0.1:3000; } }') => {
    const nginxDir = path.join(root, 'config', 'nginx');
    fs.mkdirSync(nginxDir, { recursive: true });
    fs.writeFileSync(path.join(nginxDir, 'agilewriter.conf'), body);
  };

  const writeProductionEnv = (root: string) => {
    fs.writeFileSync(
      path.join(root, '.env.production'),
      [
        'PRODUCTION_DOMAIN=agilewriter.example.com',
        'GCP_PROJECT_ID=example-project',
        'GCP_REGION=us-central1',
        'GCP_ZONE=us-central1-a',
        'SECRET_MANAGER_STRATEGY=gcp-secret-manager',
        'SSL_CERT_STRATEGY=managed-certificate',
      ].join('\n')
    );
  };

  test('deploy.sh script exists at repository root', () => {
    expect(fs.existsSync(scriptPath)).toBeTruthy();
  });

  test('usage exposes the manual production command contract', async () => {
    try {
      await runDeploy('unknown-command');
      throw new Error('Expected deploy.sh to reject unknown command');
    } catch (error: any) {
      expect(error.code).toBe(1);
      const output = `${error.stdout}\n${error.stderr}`;
      for (const command of ['validate', 'build', 'deploy', 'status', 'logs', 'rollback']) {
        expect(output).toContain(command);
      }
    }
  });

  test('validate fails closed when production compose file is missing', async () => {
    const root = makeTempRoot();
    try {
      writeNginxConfig(root);
      writeProductionEnv(root);

      await runDeploy('validate', { env: { DEPLOY_ROOT: root } });
      throw new Error('Expected validate to fail without production compose file');
    } catch (error: any) {
      expect(error.code).toBe(2);
      expect(`${error.stdout}\n${error.stderr}`).toContain('docker-compose.production.yml');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('validate fails closed when required production env values are missing', async () => {
    const root = makeTempRoot();
    try {
      writeProductionCompose(root);
      writeNginxConfig(root);

      await runDeploy('validate', { env: { DEPLOY_ROOT: root } });
      throw new Error('Expected validate to fail without production env file');
    } catch (error: any) {
      expect(error.code).toBe(2);
      expect(`${error.stdout}\n${error.stderr}`).toContain('.env.production');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('validate rejects invalid NGINX production proxy configuration', async () => {
    const root = makeTempRoot();
    try {
      writeProductionCompose(root);
      writeProductionEnv(root);
      writeNginxConfig(root, 'server { listen 80; }');

      await runDeploy('validate', { env: { DEPLOY_ROOT: root } });
      throw new Error('Expected validate to fail for invalid NGINX config');
    } catch (error: any) {
      expect(error.code).toBe(1);
      expect(`${error.stdout}\n${error.stderr}`).toMatch(/NGINX|proxy_pass|listen 443/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('validate reports missing Docker as an infrastructure prerequisite', async () => {
    const root = makeTempRoot();
    try {
      writeProductionCompose(root);
      writeNginxConfig(root);
      writeProductionEnv(root);

      await runDeploy('validate', {
        env: {
          DEPLOY_ROOT: root,
          PATH: '',
        },
      });
      throw new Error('Expected validate to fail when Docker is missing');
    } catch (error: any) {
      expect(error.code).toBe(2);
      expect(`${error.stdout}\n${error.stderr}`).toMatch(/Docker is required|Docker daemon/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('rollback fails closed when previous known-good state is missing', async () => {
    const root = makeTempRoot();
    try {
      writeProductionCompose(root);
      writeNginxConfig(root);
      writeProductionEnv(root);

      await runDeploy('rollback', { env: { DEPLOY_ROOT: root } });
      throw new Error('Expected rollback to fail without previous known-good state');
    } catch (error: any) {
      expect(error.code).toBe(2);
      expect(`${error.stdout}\n${error.stderr}`).toMatch(/previous known-good|rollback/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('production contract does not reuse the SCC-461 local compose file', () => {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    expect(script).toContain('docker-compose.production.yml');
    expect(script).not.toContain('docker-compose.local.yml');
  });
});
