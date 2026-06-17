# Local Deployment Guide

**Owner Ticket:** SCC-460, SCC-461  
**Status:** Approved  

---

## 1. Purpose

This guide covers the automated local deployment workflow for the AgileWriter Automation Testing platform.

**Why `develop.sh` exists:**  
Historically, local deployment required manually validating directories, checking Docker daemon status, executing `docker compose`, and hoping the environment variables were correct. `develop.sh` exists to codify these pre-flight checks into a single, idempotent command.

**What problem it solves:**  
It shifts failure left. Instead of discovering an authentication issue or a stopped Docker daemon *after* starting a test run, `develop.sh` validates all prerequisites and health checkpoints before handing control back to the engineer.

**When engineers should use it:**  
- When starting your daily development session.
- When spinning up the environment to run E2E Playwright tests.
- When you need to tear down and rebuild a fresh container (`./develop.sh down` then `./develop.sh up`).

**When they should NOT use it:**  
- Do not use this for production deployments. Production architecture is governed by SCC-464.
- Do not use this to bypass the test runner entirely (e.g., if you only need `npm run server` for frontend UI debugging without the containerized Playwright environment).

---

## 2. Mental Model

It is critical to understand how the components interact before troubleshooting.

```text
Engineer
   ↓ (Executes)
develop.sh
   ↓ (Validates Docker & Directories, then executes)
docker-compose.local.yml
   ↓ (Spins up)
Docker Container (agilewriter-test-runner)
   ↓ (Boots)
Express Server
   ↓ (Exposes)
Health Checks (Layer 1, 2, 3)
```

**Data Flow (Volumes):**  
When the container boots, it mounts specific folders from your host machine (`sessions/`, `reports/`, `raw_qa_files/`, etc.). When the container runs a test or a script, it writes output back to those mounted folders so you can view the results on your host system without entering the container.

---

## 3. Quick Start (30 Seconds)

Deploy the entire stack with a single command from the repository root:

```bash
./develop.sh
```

**Expected output:**
```text
[INFO] Validating prerequisites...
[INFO] All prerequisites met.
[INFO] Starting local deployment stack...
[+] Running 2/2
 ✔ Network agile-writer-test_default Created
 ✔ Container agilewriter-test-runner Started
[INFO] Waiting for container 'agilewriter-test-runner' to become healthy (timeout: 60s)...
[INFO] Layer 1 Healthcheck passed: Container is healthy.
[INFO] Validating Layer 2 (HTTP 200) and Layer 3 (/api/env-status)...
[INFO] Layer 2 & 3 Healthchecks passed: Service is fully up and configured.
[INFO] Successfully started the Agile Writer local environment.
UI is available at: http://localhost:3000/ui/
```
If you see this, the **LOCAL DEPLOYMENT IS READY**.

---

## 4. Command Reference

| Command | Purpose | Expected Behavior | Exit Codes |
|---------|---------|-------------------|------------|
| `./develop.sh` | Default action (alias for `up`). | Validates prerequisites, starts stack, polls health. | `0` on success, `1` on failure. |
| `./develop.sh up` | Starts the local environment. | Same as default. Idempotent (safe to run twice). | `0` on success, `1` on failure. |
| `./develop.sh down` | Stops and removes the stack. | Gracefully shuts down the container and removes the bridge network. | `0` on success. |
| `./develop.sh status` | Checks the compose stack status. | Prints the output of `docker compose ps`. | `0` on success. |

---

## 5. Health Check Layers

The deployment uses a strict three-layer health check strategy to guarantee environment stability:

| Layer | Purpose | Mechanism |
|-------|---------|-----------|
| **1: Container Health** | Ensures the Docker container is alive and the Express server is accepting connections. | Docker's native `HEALTHCHECK` checking `curl -fLsS http://localhost:3000/` (HTTP 200). Polled by `develop.sh`. |
| **2: HTTP Check** | Ensures the server is responding to host traffic. | `develop.sh` executes `curl -fLsS http://localhost:3000/` directly from the host. |
| **3: Env Validation** | Ensures `.env` configuration is complete and correct. | `develop.sh` executes `curl -s http://localhost:3000/api/env-status`. Must return `{"ok":true}`. |

*This architecture prevents configuration errors from causing silent failures or container restart loops.*

---

## 6. Common Failure Modes

### Docker Not Running
**Error:** `[ERROR] Docker daemon is not running.`
**Fix:** Start the Docker Desktop application on your host machine.

### Missing Authentication File
**Error:** `[ERROR] Missing required path: playwright/.auth/user.json`
**Impact:** `develop.sh` will block execution. Playwright auth tests require this file.
**Fix:** Generate the authentication state by running:
```bash
npx playwright test --project=setup
```

### Port 3000 In Use
**Error:** `bind: address already in use`
**Fix:** Identify and kill the conflicting process:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux / Mac
lsof -i :3000
kill -9 <PID>
```
Alternatively, change the port by setting `PORT=3001` in your `.env` file.

### Environment Validation Failed (Layer 3 Timeout)
**Error:** `[ERROR] Timeout waiting for HTTP health endpoints.`
**Diagnosis:** Run `curl http://localhost:3000/api/env-status`.
**Fix:** If the `missing` array is populated, add the missing variables to your `.env` file and re-run `./develop.sh`.

---

## 7. Architecture Boundaries

Future engineers must know where responsibilities stop. Do not overlap these scopes:

- **SCC-460:** Owns `docker-compose.local.yml`. (Defines *what* the local infrastructure is).
- **SCC-461:** Owns `develop.sh`. (Defines *how* engineers interact with the local infrastructure).
- **SCC-464:** Owns production deployment architecture. (Local deployment files should NEVER be used in production).

---

## 8. Validation Evidence

The architecture has been rigorously tested and validated by the ERB.

**SCC-460 (Compose Architecture) Evidence:**
```text
docker compose config → PASS
docker compose up → PASS
health status → healthy
/ui/ → HTTP 200
/api/env-status → ok=true
```

**SCC-461 (Automation Wrapper) Evidence:**
```text
Running 7 tests using 2 workers

  ok 2 tests\infrastructure\develop.spec.ts:20:7 › develop.sh Infrastructure Tests (No Docker Required) › develop.sh script exists (10ms)
  ok 3 tests\infrastructure\develop.spec.ts:24:7 › develop.sh Infrastructure Tests (No Docker Required) › fails with non-zero exit code if docker is missing (203ms)
  ok 4 tests\infrastructure\develop.spec.ts:34:7 › develop.sh Infrastructure Tests (No Docker Required) › fails if required directories are missing (4.0s)
  ok 5 tests\infrastructure\develop.spec.ts:46:7 › develop.sh Infrastructure Tests (No Docker Required) › supports arguments contract: start, stop, status (194ms)
  ok 1 tests\integration\develop.integration.spec.ts:19:7 › develop.sh Integration Tests (Requires Docker) › develop.sh starts stack and returns healthy status (17.7s)
  ok 6 tests\integration\develop.integration.spec.ts:25:7 › develop.sh Integration Tests (Requires Docker) › develop.sh is idempotent (second run succeeds) (15.1s)
  ok 7 tests\integration\develop.integration.spec.ts:30:7 › develop.sh Integration Tests (Requires Docker) › develop.sh down tears down the stack cleanly (1.6s)

  7 passed (37.1s)
```

---

## 9. Rollback Procedure

If `develop.sh` or local deployment fails completely and you need to revert to the legacy workflow:

```bash
# 1. Stop any running containers cleanly
./develop.sh down

# 2. Revert to previous workflow (Path A: Existing Docker Compose)
docker-compose up --build

# OR Revert to previous workflow (Path B: Local Node)
npm run server
```
