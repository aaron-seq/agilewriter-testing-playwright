# Local Deployment Guide

**Owner Ticket:** SCC-460  
**Status:** Approved  

## 1. Document Purpose
This guide covers the local deployment workflow for the AgileWriter Automation Testing platform. It documents the architecture, volume mounts, environment strategy, and troubleshooting steps required to run the `test-runner` service locally using Docker Compose.

> [!NOTE]
> This guide is for LOCAL deployment only. Production deployment (SCC-464) and the automation wrapper script `develop.sh` (SCC-461) will build upon this foundation.

## 2. Architecture Overview
The platform uses a single-service architecture.

- **Service:** `test-runner` (Express server + Playwright runtime)
- **Port:** `3000` (configurable via `PORT` environment variable)
- **Image:** `mcr.microsoft.com/playwright:v1.58.2-noble`
- **Network:** Default compose bridge network

## 3. Prerequisites
Before deploying the stack locally, ensure the following:

1. **Docker Desktop** is installed and running.
2. **`.env` file** exists in the project root. You can copy the template:
   ```bash
   cp .env.example .env
   ```
3. **Microsoft Auth State** is pre-generated. The container requires a valid `user.json` file for SharePoint connectivity. Generate it by running:
   ```bash
   npx playwright test --project=setup
   ```
   *This creates `playwright/.auth/user.json`.*

## 4. Quick Start
Deploy the entire stack with a single command:

```bash
docker compose -f docker-compose.local.yml up --build
```

To run in detached mode (background):
```bash
docker compose -f docker-compose.local.yml up --build -d
```

## 5. Volume Mount Reference
The container requires several bind mounts to function correctly and persist data. These are explicitly bind-mounted so engineers can provide inputs (like raw QA files) and inspect outputs (like HTML reports) without rebuilding the container.

| Host Path | Container Path | Purpose | Created By |
|-----------|---------------|---------|------------|
| `./sessions` | `/app/sessions` | Test traces, step-results, screenshots | Server auto-creates |
| `./reports` | `/app/reports` | Accuracy reports, Playwright HTML reports | Server auto-creates |
| `./playwright/.auth` | `/app/playwright/.auth` | Microsoft SSO auth state | Manual pre-generation |
| `./reference_files` | `/app/reference_files` | Accuracy scoring reference data | Server auto-creates |
| `./raw_qa_files` | `/app/raw_qa_files` | Raw QA output for scoring | Server auto-creates |

> [!IMPORTANT]
> `reference_files/` and `raw_qa_files/` are user-provided runtime data inputs, not static repository assets. Engineers drop new files here on the host to have them automatically scored by the container.

## 6. Environment Variable Strategy
- Configuration is driven entirely by the `.env` file injected via the `env_file` directive in `docker-compose.local.yml`.
- `.env.example` documents all required and optional variables.
- The `PORT` variable defaults to `3000` if not explicitly set.

## 7. Health Check Architecture
The deployment uses a two-layer health check strategy:

1. **Layer 1: Compose Liveness Check**
   The Docker Compose file checks if the Express server is accepting HTTP connections and serving the UI correctly:
   `curl -fLsS -o /dev/null http://localhost:${PORT:-3000}/`
   (Follows the 302 redirect to verify `/ui/` is accessible).
   
2. **Layer 2: Configuration Validation (SCC-461)**
   A separate endpoint `/api/env-status` validates the environment variables. This is checked *after* the container starts by the `develop.sh` wrapper, preventing configuration errors from causing container restart loops.

## 8. Service Endpoints

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:3000/ui/` | Execution dashboard (Browser entrypoint) |
| `http://localhost:3000/api/env-status` | Configuration health check |
| `http://localhost:3000/list-tests` | Available test suites |

## 9. Useful Commands

| Action | Command |
|--------|---------|
| View logs | `docker compose -f docker-compose.local.yml logs -f` |
| Check health | `docker compose -f docker-compose.local.yml ps` |
| Stop | `docker compose -f docker-compose.local.yml down` |
| Stop + remove volumes | `docker compose -f docker-compose.local.yml down -v` |
| Rebuild from scratch | `docker compose -f docker-compose.local.yml build --no-cache` |

## 10. Troubleshooting

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| Container exits immediately | `docker compose logs` | Check for port conflict or missing `.env` |
| Health status: `unhealthy` | `curl http://localhost:3000/` | Server didn't start — check logs |
| UI loads but tests fail | `curl http://localhost:3000/api/env-status` | Check `ok` field and `missing` array |
| Auth errors during test | Verify `playwright/.auth/user.json` exists | Re-generate: `npx playwright test --project=setup` |
| Port 3000 in use | `netstat -ano \| findstr :3000` (Win) | Kill conflicting process or set `PORT=3001` in `.env` |

## 11. Known Limitations & Failure Modes

> [!WARNING]
> **Failure Mode: Missing `playwright/.auth/user.json`**
> The container will start successfully. The UI will load. Accuracy scoring will remain fully functional. However, any authentication-dependent Playwright tests will fail. This is not a deployment failure; the auth state must be manually generated.

- Auth state (`user.json`) has a time-limited validity and must be regenerated periodically.
- Python `benchmarking_automation` is NOT included in the compose stack.
- Single-service architecture — no service-to-service communication needed.
- Tests require network access to `BASE_URL` (hosted AgileWriter) — cannot run fully offline.

## 12. Rollback Procedure
If local deployment fails and you need to revert to the previous workflow:

```bash
# 1. Stop any running containers
docker compose -f docker-compose.local.yml down

# 2. Revert to previous workflow (Path A: Existing Docker Compose)
docker-compose up --build

# OR Revert to previous workflow (Path B: Local Node)
npm run server
```
