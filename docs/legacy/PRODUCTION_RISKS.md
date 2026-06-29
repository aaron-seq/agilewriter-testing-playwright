# Production Deployment Risk Analysis: AgileWriter Test Runner Dockerfile

## Executive Summary
The Dockerfile has **7 critical production risks** and **3 high-risk issues** that could cause security breaches, OOM failures, data loss, and deployment failures. Most are remediable with configuration changes; the base image size is a fundamental architecture concern.

---

## Critical Risks (Must Fix Before Production)

### 🔴 RISK #1: Running as Root User
**Severity**: CRITICAL  
**Current State**: Container runs as `root` (uid 0)  
**Impact**: 
- Compromise of the application = full host system compromise (especially in Kubernetes)
- Child processes spawned by Playwright/Node inherit root privileges
- Volume mounts can be modified maliciously
- Browser isolation (Chromium) is weakened

**Evidence**:
```
uid=0(root) gid=0(root) groups=0(root)
```

**Remediation**:
```dockerfile
# Add after WORKDIR /app
RUN groupadd -r nodeapp && useradd -r -g nodeapp nodeapp
RUN chown -R nodeapp:nodeapp /app /ms-playwright
USER nodeapp
```

**Risk if unfixed**: A compromised test runner can read all container volumes, inject malicious code into reports, or escape the container in Kubernetes.

---

### 🔴 RISK #2: Unversioned Base Image
**Severity**: CRITICAL  
**Current State**: `FROM mcr.microsoft.com/playwright:v1.58.2-noble` (pinned to patch, but uses generic "noble" Ubuntu distro tag)  
**Impact**:
- Ubuntu 24.04 (noble) may receive security patches that cause compatibility breaks
- Playwright 1.58.2 may receive updates to the base OS dependencies
- Different developers rebuild on different dates → different images
- Non-deterministic deployments

**Evidence**:
```
Image created 4 months ago via buildkit
Base: ubuntu:24.04 (fixed point in time, but tagged "noble" can shift)
```

**Remediation**:
```dockerfile
# Use immutable digest instead of tag
FROM mcr.microsoft.com/playwright:v1.58.2-noble@sha256:<full-digest>
```

Find the digest:
```bash
docker inspect mcr.microsoft.com/playwright:v1.58.2-noble --format='{{index .RepoDigests 0}}'
```

**Risk if unfixed**: Silent security updates to the base OS cause unpredictable behavior; vulnerability scanning fails because the image hash is not deterministic.

---

### 🔴 RISK #3: No Health Check
**Severity**: CRITICAL  
**Current State**: No `HEALTHCHECK` instruction in Dockerfile; no health probe in docker-compose  
**Impact**:
- Docker/Kubernetes will not detect if the server crashes but the container stays alive
- Zombie containers serve 503/connection refused to clients
- In Kubernetes, node will not restart failed pods automatically
- Load balancer will route traffic to dead containers

**Evidence**:
```
No HEALTHCHECK in Dockerfile
No healthcheck in docker-compose.yml
```

**Remediation**:
```dockerfile
# Add before CMD
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode !== 200) throw new Error(r.statusCode)})"
```

And add health endpoint to `server/test-runner-server.js`:
```javascript
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
```

Or update docker-compose:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 5s
```

**Risk if unfixed**: Failed containers are not detected; Kubernetes deployments may have 0 healthy replicas while appearing "running".

---

### 🔴 RISK #4: No Resource Limits in Dockerfile
**Severity**: CRITICAL  
**Current State**: Image includes no default resource constraints  
**Impact**:
- A runaway test can consume all host memory → OOM Kill container AND other containers
- Playwright memory leak (known issue) can exhaust 50+ GB on multi-test runs
- No limit on CPU → test can monopolize host CPU
- No swap limit → container can swap to disk and become unresponsive

**Evidence**:
```
docker inspect: HostConfig.Memory = 0, HostConfig.CpuShares = 0
```

**Remediation**: Not in Dockerfile — **must be set in docker-compose or orchestrator**:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 3G
    reservations:
      cpus: '1'
      memory: 2G
```

**Risk if unfixed**: Memory spike during multi-test run or accuracy scoring kills the container AND sibling containers on the same host.

---

### 🔴 RISK #5: Credentials Possible in Source Code
**Severity**: CRITICAL  
**Current State**: `.dockerignore` correctly excludes `.env`, but source code might contain hardcoded credentials  
**Impact**:
- If `.env` is ever committed, all containers have access to secrets
- Playwright `.auth` state contains session tokens
- Generated images baked with production credentials become credentials distribution mechanism

**Evidence**:
```
.dockerignore excludes .env and playwright/.auth correctly
But server code reads process.env.MS_PASSWORD, MS_EMAIL (from .env)
If .env is accidentally committed to git, it's in git history forever
```

**Remediation**:
1. **Never commit .env**: Add to `.gitignore` (verify it's there):
```
.env
.env.local
playwright/.auth/
```

2. **Use Docker secrets in production** (Swarm/Kubernetes):
```yaml
# docker-compose.production.yml
services:
  test-runner:
    environment:
      MS_EMAIL: ${MS_EMAIL}  # Injected from deploy script
      MS_PASSWORD: ${MS_PASSWORD}
    secrets:
      - ms_password
secrets:
  ms_password:
    external: true  # Pre-created: docker secret create ms_password <file>
```

3. **Use external secret manager** (Vault, AWS Secrets Manager):
```javascript
// server/test-runner-server.js
const secrets = await fetch('http://vault:8200/v1/secret/data/test-runner')
  .then(r => r.json());
const msPassword = secrets.data.data.password;
```

4. **Scan image for secrets** (before push):
```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image agilewritertest-test-runner
```

**Risk if unfixed**: A leaked image contains production credentials; attackers can run tests against production, inject malicious code, or access the test account's data.

---

### 🔴 RISK #6: Image Size 958 MB — Excessive for a Test Runner
**Severity**: HIGH  
**Current State**: 
- Base image (Playwright): 2.5 GB (uncompressed in layers)
- App layer: 45.7 MB source code
- node_modules: 115 MB
- Final image push: 958 MB

**Impact**:
- **Slow container startup**: 30–60 seconds to pull + unpack (Kubernetes)
- **Registry storage**: 958 MB × number of versions × replicas = expensive storage
- **Network overhead**: Every scale-up operation needs to pull 958 MB
- **Cold start latency**: 30–60 second delay on pod spin-up in auto-scaling scenarios

**Breakdown**:
```
Playwright browser binaries (/ms-playwright): 1.2 GB
Ubuntu 24.04 OS layer: 87.6 MB
Node 20 + build tools: 362 MB
Application code (/app): 45.7 MB + 115 MB (node_modules)
```

**Analysis**: The base image (Playwright) is inherently large because it bundles Chromium + all graphics libraries. This is not easily reduced without losing browser functionality.

**Mitigation Options**:

**Option A: Multi-stage build** (saves ~10–15 MB, minimal impact)
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["node", "server/test-runner-server.js"]
```
**Savings**: ~10 MB (node_modules duplication avoided)

**Option B: Use lightweight Playwright image** (if available)
- Microsoft doesn't publish a "slim" Playwright image
- Building custom image from scratch would require ~2 hours of setup and lose support

**Option C: Base on debian:bookworm-slim** (saves ~100 MB, but requires manual Playwright install)
```dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y nodejs npm
# ... manual Playwright install ... (complex, not recommended)
```
**Risk**: Loses official support; maintenance burden high.

**Recommendation**: Accept the 958 MB size. Browser automation requires the full browser stack. Focus on:
- Layer caching optimization
- Image pull caching in Kubernetes (ImagePullPolicy: IfNotPresent)
- Using private registry with faster network

**Risk if unfixed**: Kubernetes pod startup latency increases by 30–60 seconds per scale-up event; registry egress costs increase.

---

### 🔴 RISK #7: No SIGTERM/SIGKILL Handler
**Severity**: HIGH  
**Current State**: `CMD ["node", "server/test-runner-server.js"]` runs directly (no init process)  
**Impact**:
- When Kubernetes/Docker sends SIGTERM (graceful shutdown), Node may not exit cleanly
- Active test sessions may be abruptly killed mid-execution
- Database connections/file handles not flushed
- Temporary files in `/tmp` not cleaned up
- Session cleanup TTL may not complete

**Evidence**:
```
No PID 1 process manager (like dumb-init or tini)
Node directly as PID 1 means it receives all signals immediately
```

**Remediation**:

**Option A: Install dumb-init** (recommended)
```dockerfile
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/test-runner-server.js"]
```

**Option B: Add signal handlers to Node app**:
```javascript
// server/test-runner-server.js
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  
  // Close all active test sessions
  for (const [sessionId, session] of sessions) {
    session.clients.forEach(client => client.end());
  }
  
  // Close HTTP server (stop accepting new connections)
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30000);
});
```

**Risk if unfixed**: When Kubernetes terminates a pod, active tests are killed abruptly; reports may be incomplete or partially written.

---

## High-Risk Issues (Should Fix Before Production)

### 🟠 RISK #8: Yarn Installed But Not Used
**Severity**: MEDIUM  
**Current State**: Base image installs yarn: `npm install -g yarn`, but Dockerfile uses `npm ci`  
**Impact**:
- Unused package manager adds ~50 MB to container
- Inconsistency in dependency management
- Yarn in PATH but not used → developer confusion

**Remediation**:
```dockerfile
# If using npm, remove yarn from base image entirely (rebuild base)
# OR if switching to yarn:
RUN yarn install --frozen-lockfile
```

**Risk if unfixed**: Minor — just wasted space; functional impact is zero.

---

### 🟠 RISK #9: No Non-Root User Pre-Baked in Base Image
**Severity**: MEDIUM  
**Current State**: Base image creates `pwuser` (for Playwright), but app runs as root  
**Impact**:
- `pwuser` exists but is unused; app runs as root anyway
- When adding non-root USER instruction, must change `/app` and `/ms-playwright` ownership
- Delayed security fix

**Remediation**: See RISK #1 remediation above.

---

### 🟠 RISK #10: No Graceful Shutdown of Playwright Processes
**Severity**: MEDIUM  
**Current State**: When container stops, active Playwright test processes may not clean up browser instances  
**Impact**:
- Chromium processes left running on the host
- File descriptors not released
- Stale process locks on files

**Remediation**: Already partially handled in `server/test-runner-server.js` via spawn process tracking, but should add explicit cleanup:
```javascript
process.on('SIGTERM', () => {
  // Kill all spawned child processes (tsc, playwright, report generator)
  for (const child of childProcesses) {
    child.kill('SIGTERM');
  }
  // ... rest of shutdown logic
});
```

---

## Medium-Risk Issues (Nice to Have)

### 🟡 RISK #11: No Log Aggregation / Stdout Capture
**Severity**: LOW  
**Current State**: Logs go to container stdout/stderr only; no persistent logging mechanism  
**Impact**:
- Logs lost when container exits
- Difficult to debug production issues after container is gone
- Kubernetes `kubectl logs` only shows recent entries

**Remediation**:
```yaml
# In docker-compose
services:
  test-runner:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
```

Or use external logging (ELK, CloudWatch, Datadog):
```javascript
// server/test-runner-server.js
const logger = require('winston');
logger.info('Server started', { port: PORT });
```

---

### 🟡 RISK #12: No OOM Kill Behavior Specified
**Severity**: LOW  
**Current State**: If memory limit is hit, container gets OOM killed with no graceful shutdown  
**Impact**:
- Active reports interrupted mid-generation
- Sessions not cleaned up
- Client connections dropped

**Remediation**: Combine with SIGTERM handler and aggressive monitoring. Set memory limit with a buffer:
```yaml
deploy:
  resources:
    limits:
      memory: 3G      # Hard limit
    reservations:
      memory: 2G      # Soft limit; alerts should trigger at 1.8G
```

---

## Summary Table

| Risk # | Issue | Severity | Effort to Fix | Impact if Unfixed |
|--------|-------|----------|--------------|------------------|
| 1 | Running as root | CRITICAL | 5 mins | Full system compromise on container breach |
| 2 | Unversioned base image | CRITICAL | 10 mins | Non-deterministic deployments, security scanning fails |
| 3 | No health check | CRITICAL | 15 mins | Zombie containers serve traffic; Kubernetes doesn't detect failures |
| 4 | No resource limits | CRITICAL | 5 mins (config) | OOM cascades to sibling containers |
| 5 | Credentials in source | CRITICAL | 30 mins | Leaked credentials in image; production account compromised |
| 6 | Image size 958 MB | HIGH | Architectural | 30–60 sec scale-up latency; high registry costs |
| 7 | No SIGTERM handler | HIGH | 20 mins | Abrupt test interruption; incomplete reports |
| 8 | Unused yarn | MEDIUM | 0 mins | Wasted space only |
| 9 | No pre-baked non-root user | MEDIUM | 10 mins (per RISK #1) | Blocks root user fix |
| 10 | No Playwright cleanup | MEDIUM | 15 mins | Stale processes on host |
| 11 | No log aggregation | LOW | 10 mins | Logs lost after container exit |
| 12 | No OOM behavior spec | LOW | 5 mins | No graceful degradation on memory pressure |

---

## Recommended Actions (Priority Order)

### **Phase 1: Pre-Production (Must Do)**
1. ✅ Add non-root USER + chown app directories (RISK #1)
2. ✅ Pin base image to digest (RISK #2)
3. ✅ Add healthcheck endpoint + instruction (RISK #3)
4. ✅ Add resource limits to docker-compose (RISK #4)
5. ✅ Verify `.env` not in git; add to `.gitignore` (RISK #5)
6. ✅ Add SIGTERM handler to Node app (RISK #7)

### **Phase 2: Post-Deployment (Should Do)**
7. Implement log aggregation (RISK #11)
8. Add graceful Playwright process cleanup (RISK #10)
9. Consider multi-stage build for marginal savings (RISK #6)
10. Remove unused yarn or document why it exists (RISK #8)

### **Phase 3: Monitoring (Operational)**
11. Set up memory/CPU alerting at 70% threshold
12. Monitor container restarts and OOM events
13. Regular security scanning with Trivy
14. Image digest pinning in all deployments

---

## Patched Dockerfile Example

```dockerfile
FROM mcr.microsoft.com/playwright:v1.58.2-noble@sha256:<full-digest-here>

WORKDIR /app

# Create non-root user early
RUN groupadd -r nodeapp && useradd -r -g nodeapp nodeapp

COPY package*.json ./

RUN npm ci

COPY . .

# Fix ownership
RUN chown -R nodeapp:nodeapp /app /ms-playwright

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

# Graceful shutdown with init process
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

USER nodeapp

CMD ["node", "server/test-runner-server.js"]
```

**Note**: Requires companion changes:
- `.gitignore` to exclude `.env`
- `server/test-runner-server.js` to add `/health` endpoint and SIGTERM handler
- `docker-compose.yml` to add resource limits
