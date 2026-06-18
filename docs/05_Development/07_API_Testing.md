# 07. API Testing

**Browser tests** open Chrome, move the mouse, and click buttons. They are great, but they are slow.
**API tests** skip the UI entirely. They send raw HTTP requests (`GET`, `POST`) directly to the backend.

### Why use API Tests?
If you are testing backend validation (e.g., "Does the server reject an invalid payload?"), you don't need a browser. API tests run in milliseconds.

### Example: Testing an Endpoint
Playwright provides a `request` context specifically for this:

```typescript
// Location: tests/api/health.spec.ts
import { test, expect } from '@playwright/test';

test('Server returns 200 OK for health check', async ({ request }) => {
  // We send a direct GET request. No browser opens!
  const response = await request.get('/api/health');
  
  // Verify the HTTP status code
  expect(response.status()).toBe(200);
  
  // Verify the JSON body
  const body = await response.json();
  expect(body.status).toBe('up');
});

test('Server rejects POST without authorization', async ({ request }) => {
  const response = await request.post('/api/run-test', {
    data: { scriptName: 'health_CSR.spec.ts' }
  });
  
  expect(response.status()).toBe(401);
});
```
