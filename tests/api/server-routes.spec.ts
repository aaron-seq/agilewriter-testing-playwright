/**
 * API tests for the web runner in server/test-runner-server.js.
 *
 * No browser. Starts the server on its own port so it never collides with a
 * dev server on 3000, and shuts it down afterwards.
 *
 * Only read-only routes and the validation (4xx) paths of POST /run-test are
 * exercised. A POST that passes validation spawns a real Playwright run, so
 * these tests deliberately use inputs that are guaranteed to be rejected.
 */

import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const PORT = 3399;
const BASE = `http://127.0.0.1:${PORT}`;
const SERVER = path.join(__dirname, '..', '..', 'server', 'test-runner-server.js');

let server: ChildProcess;

/** Poll until the server answers, so tests never race the boot. */
async function waitForServer(request: any, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await request.get(`${BASE}/list-tests`, { timeout: 1_000 });
      if (response.ok()) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready on ${BASE} within ${timeoutMs}ms`);
}

test.beforeAll(async ({ request }) => {
  server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await waitForServer(request);
});

test.afterAll(() => {
  server?.kill();
});

test.describe('GET /list-tests', () => {
  test('returns the health specs the UI dropdown offers', async ({ request }) => {
    const response = await request.get(`${BASE}/list-tests`);

    expect(response.status()).toBe(200);

    const files = await response.json();
    expect(Array.isArray(files)).toBe(true);
    // Paths are relative to tests/ - health specs live in their own folder.
    expect(files).toContain('template-format-health-reports/health_CSR.spec.ts');
  });

  test('offers only specs a tester can actually launch', async ({ request }) => {
    const files: string[] = await (await request.get(`${BASE}/list-tests`)).json();

    // accuracy.spec.ts needs file arguments; the rest are developer tooling.
    expect(files).not.toContain('accuracy.spec.ts');
    for (const excluded of ['__tests__/', 'api/', 'infrastructure/', 'integration/', 'diagnostics/']) {
      expect(files.filter((f) => f.includes(excluded))).toHaveLength(0);
    }
  });

  test('offers the manual-input spec the Template/Source form configures', async ({ request }) => {
    const files = await (await request.get(`${BASE}/list-tests`)).json();

    // This spec is the ONLY consumer of the Template/Source fields in the UI.
    // It used to be filtered out, leaving that form permanently unreachable.
    expect(files).toContain('AW_11_to_20_manual_input.spec.ts');
    expect(files).toContain('AW_11_to_20_QA_folder.spec.ts');
  });
});

test.describe('GET /api/env-status', () => {
  test('reports configuration state without leaking values', async ({ request }) => {
    const response = await request.get(`${BASE}/api/env-status`);

    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(() => JSON.parse(body)).not.toThrow();

    // A status endpoint must never echo the password back.
    if (process.env.MS_PASSWORD) {
      expect(body).not.toContain(process.env.MS_PASSWORD);
    }
  });
});

test.describe('GET /api/accuracy/reference-files', () => {
  test('lists the reference workbooks', async ({ request }) => {
    const response = await request.get(`${BASE}/api/accuracy/reference-files`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.files)).toBe(true);
  });
});

test.describe('POST /run-test — validation gate', () => {
  test('rejects a request with no testFile', async ({ request }) => {
    const response = await request.post(`${BASE}/run-test`, { data: {} });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain('testFile is required');
  });

  test('rejects a health spec that is not in HEALTH_SPEC_CONFIG_MAP', async ({ request }) => {
    const response = await request.post(`${BASE}/run-test`, {
      data: { testFile: 'health_DoesNotExist.spec.ts' },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toContain('Health spec not found in validation map');
    // The error has to say how to fix it — this is the message a developer
    // sees after adding a spec and forgetting to register it.
    expect(body.hint).toContain('HEALTH_SPEC_CONFIG_MAP');
  });
});

test.describe('GET /stream', () => {
  test('404s for an unknown session instead of hanging open', async ({ request }) => {
    const response = await request.get(`${BASE}/stream?sessionId=not-a-real-session`);

    expect(response.status()).toBe(404);
    expect((await response.json()).error).toContain('Session not found');
  });
});

test.describe('GET /', () => {
  test('redirects to the UI', async ({ request }) => {
    const response = await request.get(`${BASE}/`, { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe('/ui/');
  });
});
