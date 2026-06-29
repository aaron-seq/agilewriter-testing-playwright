# Production Volume Mounting Strategy

## Quick Reference: Which Folders to Mount

| Folder | Mount? | Mode | Purpose | Persistence | Size |
|--------|--------|------|---------|-------------|------|
| `/app/sessions` | ✅ **YES** | `rw` | Test execution output, reports | **CRITICAL** | 10–50 MB/test |
| `/app/reports` | ✅ **YES** | `rw` | Legacy report fallback | **CRITICAL** | 5–10 MB/month |
| `/app/playwright/.auth` | ✅ **YES** | `ro` | Browser auth state (pre-generated) | **CRITICAL** | ~100 KB (static) |
| `/app/reference_files` | ✅ **YES** | `ro` | Accuracy scoring references | **SHOULD** | ~10 MB (static) |
| `/app/raw_qa_files` | ✅ **YES** | `rw` | QA test data input files | **SHOULD** | 20–50 GB |
| `/app/test-results` | ⚠️ OPTIONAL | `rw` | Playwright JSON test results | **OPTIONAL** | 5–20 MB/test |
| `/app/playwright-report` | ⚠️ OPTIONAL | `rw` | Playwright trace/screenshots | **OPTIONAL** | 20–100 MB/test |
| `/app/node_modules` | ❌ **NO** | N/A | Dependencies (in image) | Not needed | 115 MB |

---

## Production Docker Compose (Recommended)

```yaml
version: '3.8'

services:
  test-runner:
    image: agilewritertest-test-runner:1.0.0  # Use specific tag, not 'latest'
    
    ports:
      - "3000:3000"
    
    volumes:
      # ─────────────────────────────────────────────────────────────
      # CRITICAL: Test Execution & Output
      # ─────────────────────────────────────────────────────────────
      # Sessions: Generated test reports, step-results.json, runtime configs
      # Auto-cleanup after 60 minutes (server-side TTL)
      - /storage/agile-writer/sessions:/app/sessions:rw
      
      # Reports: Legacy fallback (deprecated, but keep for backward compat)
      # Contains final .docx reports if SESSION_ID env var not set
      - /storage/agile-writer/reports:/app/reports:rw
      
      # ─────────────────────────────────────────────────────────────
      # CRITICAL: Authentication
      # ─────────────────────────────────────────────────────────────
      # Auth State: Pre-generated browser auth cookies/tokens
      # Read-only: Never modified by container
      # MUST exist before container start (generated locally)
      - /storage/agile-writer/playwright/.auth:/app/playwright/.auth:ro
      
      # ─────────────────────────────────────────────────────────────
      # RECOMMENDED: Test Data
      # ─────────────────────────────────────────────────────────────
      # Reference Files: Accuracy scoring baseline data
      # Read-only: User manages these files
      - /storage/agile-writer/reference_files:/app/reference_files:ro
      
      # Raw QA Files: Test input data, watched by server for new uploads
      # Read-write: Server watches this directory for file-added events
      - /storage/agile-writer/raw_qa_files:/app/raw_qa_files:rw
      
      # ─────────────────────────────────────────────────────────────
      # OPTIONAL: Debugging (remove in production if not needed)
      # ─────────────────────────────────────────────────────────────
      # Test Results: Playwright JSON reports (useful for post-mortem)
      - /storage/agile-writer/test-results:/app/test-results:rw
      
      # Playwright Report: HTML traces, screenshots (large, ephemeral)
      - /storage/agile-writer/playwright-report:/app/playwright-report:rw
    
    environment:
      # Load secrets from external .env (NOT baked into image)
      - MS_EMAIL=${MS_EMAIL}
      - MS_PASSWORD=${MS_PASSWORD}
      - BASE_URL=${BASE_URL}
      - TEST_ENV=production
      # ... other env vars
    
    env_file:
      - /etc/agile-writer/.env.production
    
    restart: unless-stopped
    
    # Resource constraints (prevent OOM cascade)
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 3G
        reservations:
          cpus: '1'
          memory: 2G
    
    # Logging configuration (persist logs beyond container lifetime)
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
        labels: "service=agile-writer-test-runner"
    
    # Security context (non-root user)
    # Note: Compose v3 doesn't support security options; use compose v3.8+ or use docker run --user
    user: "nodeapp:nodeapp"
    
    # Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s

# Named volumes (alternative to bind mounts for cloud deployments)
volumes:
  sessions:
    driver: local
  reports:
    driver: local
  reference_files:
    driver: local
  raw_qa_files:
    driver: local
```

---

## Volume Mount Breakdown by Use Case

### **1. CRITICAL: `/app/sessions` (Read-Write)**

**What it contains**:
- `<sessionId>/step-results.json` — test timeline, pass/fail status
- `<sessionId>/runtime-config.json` — test parameters
- `<sessionId>/<testname>_<timestamp>_Report.docx` — final test report
- Temporary files during test execution

**Why mount**:
- Test reports are the PRIMARY OUTPUT of the application
- Users download reports from the UI or API
- Without mounting, reports are LOST when container restarts

**Auto-cleanup**:
- Server deletes sessions 60 minutes after completion (TTL in `test-runner-server.js`)
- Safe to mount on ephemeral storage if TTL is respected
- Archive to S3/Backblaze before 60 minutes for compliance

**Storage estimate**:
- Per test: 5–50 MB (depends on document size, screenshots)
- Concurrent storage: `2 parallel tests × 50 MB = 100 MB` (peak)
- Long-term: Archive after TTL; don't accumulate locally

**Production mount strategy**:
```yaml
# Option A: Local fast storage (NVMe SSD)
- /mnt/nvme/agile-writer/sessions:/app/sessions:rw

# Option B: Network storage with caching (NFS + local cache layer)
- /mnt/nfs/agile-writer/sessions:/app/sessions:rw

# Option C: Docker named volume + local driver (best for Compose)
volumes:
  sessions:
    driver: local
    driver_opts:
      type: tmpfs
      device: tmpfs
      o: "size=5G,uid=1000"  # Faster for ephemeral data
```

---

### **2. CRITICAL: `/app/reports` (Read-Write)**

**What it contains**:
- Generated `.docx` reports (fallback/legacy path)
- Used only if `SESSION_ID` env var is NOT set

**Why mount**:
- Backup for reports if session-scoped storage fails
- Maintains backward compatibility with older test runners

**When used**:
- Legacy tests that don't set `SESSION_ID`
- Direct script execution: `node generate-word-report.js` (without SESSION_ID)

**In production**:
- Most tests use session-scoped storage (`/app/sessions`)
- This folder is a safety net; expect low traffic

**Storage estimate**:
- Minimal (~100 MB/month if used at all)

**Production mount strategy**:
```yaml
# Keep it, but secondary priority
- /storage/agile-writer/reports:/app/reports:rw
```

---

### **3. CRITICAL: `/app/playwright/.auth` (Read-Only)**

**What it contains**:
- `user.json` — Playwright browser auth state
- Serialized session cookies, tokens, local storage
- Generated by running: `npx playwright test --project=setup`

**Why mount**:
- Tests need pre-authenticated browser session
- Avoids repeated login on every test run
- Auth state is MACHINE-SPECIFIC (can't be shared across hosts)

**Important**:
- `.dockerignore` correctly excludes this (not baked into image)
- Must exist BEFORE container starts
- Read-only prevents accidental modification

**Generation**:
```bash
# On your local machine (once)
npx playwright test --project=setup

# Creates ./playwright/.auth/user.json
# Then commit to git (no secrets in auth state)
# Or copy to production server
```

**Storage estimate**:
- Static: ~100 KB
- Never changes per test

**Production mount strategy**:
```yaml
# Read-only: prevents corruption
- /storage/agile-writer/playwright/.auth:/app/playwright/.auth:ro

# Pre-deployment check:
# Test that /storage/agile-writer/playwright/.auth/user.json exists
```

**Risk if not mounted**:
- Every test run must re-authenticate
- Adds 2–5 minutes per test (login process)
- Auth failures block all tests

---

### **4. RECOMMENDED: `/app/reference_files` (Read-Only)**

**What it contains**:
- User-provided `.xlsx` spreadsheets (accuracy scoring baseline)
- Example: `CSR_baseline.xlsx`, `M264_reference.xlsx`, `ICF_template.xlsx`

**Why mount**:
- Server watches this directory and lists files via API
- Users upload reference files through the UI
- Never modified by the container (read-only)

**Usage**:
- Accuracy scoring workflow compares test output against reference files
- API: `GET /api/accuracy/reference-files` lists available files
- API: `POST /api/accuracy/score` runs scoring against reference file

**Storage estimate**:
- 5–20 MB total (reference data is small)
- Static; grows infrequently

**Production mount strategy**:
```yaml
# Read-only: Users manage these files
- /storage/agile-writer/reference_files:/app/reference_files:ro

# Pre-deployment: Seed with known reference files
# curl -F "file=@baseline.xlsx" http://localhost:3000/upload-reference
```

---

### **5. RECOMMENDED: `/app/raw_qa_files` (Read-Write)**

**What it contains**:
- User-provided `.xlsx` test data files (QA output from AgileWriter)
- Example: `Mock_CSR_Tables_30Oct25.rtf`, `Protocol_Example.docx`
- Server watches this directory for new files (fs.watch)

**Why mount**:
- Uploaded through UI or manual file drop
- Server watches and broadcasts file-added events to accuracy scoring clients
- Never deleted by container (but should archive old files)

**Usage**:
- Users upload QA output files for accuracy scoring
- WebSocket/SSE watches for new files: `GET /api/accuracy/watch`
- Files fed into accuracy scoring: `POST /api/accuracy/score`

**Storage estimate**:
- 20–50 GB (accumulates over time)
- Should implement archival policy: move files >30 days old to cloud storage

**Production mount strategy**:
```yaml
# Read-write: Server watches for new files
- /storage/agile-writer/raw_qa_files:/app/raw_qa_files:rw

# Maintenance:
# 1. Implement archival job (move files to S3 after 30 days)
# 2. Keep local storage for active tests (last 7 days)
# 3. Monitor disk usage; alert if >80%
```

**Example archival script**:
```bash
#!/bin/bash
# archive_old_qa_files.sh — run daily via cron

find /storage/agile-writer/raw_qa_files -type f -mtime +30 \
  -exec aws s3 mv {} s3://agile-writer-backups/raw_qa_files/ \;
```

---

### **6. OPTIONAL: `/app/test-results` (Read-Write)**

**What it contains**:
- Playwright JSON test results
- Generated during test execution: `.json` test reports
- Redundant with `sessions/<sessionId>/step-results.json`

**Why mount** (optional):
- Useful for post-mortem debugging
- Can be parsed to extract detailed test metadata
- Playwright's native format; good for integrations

**When to skip**:
- If you only care about final `.docx` reports
- If disk space is constrained

**Production mount strategy**:
```yaml
# Optional: Include if you want detailed test debugging
- /storage/agile-writer/test-results:/app/test-results:rw

# Alternative: Don't mount (let it be ephemeral)
# Clean up container state between tests
```

---

### **7. OPTIONAL: `/app/playwright-report` (Read-Write)**

**What it contains**:
- Playwright HTML trace files
- Screenshots, video recordings
- Chromium DevTools Protocol (CDP) logs
- 20–100 MB per test run (large!)

**Why mount** (optional):
- Useful during development/debugging
- Can inspect failed test steps visually
- Heavy storage cost; not needed in production

**When to skip** (recommended for production):
- If not actively debugging
- If compliance doesn't require trace files
- To save storage costs

**Production mount strategy**:
```yaml
# SKIP in production unless actively debugging
# If needed, mount to temporary storage:
# - /mnt/tmp/playwright-report:/app/playwright-report:rw
# And clean up after each test run (cron job)
```

---

## Storage Architecture Recommendations

### **Option 1: Single Host (Development/QA)**
```
Host: /storage/agile-writer/
├── sessions/              (10 GB, SSD)
├── reports/               (5 GB, SSD)
├── playwright/.auth/      (100 KB, SSD)
├── reference_files/       (10 MB, SSD or HDD)
├── raw_qa_files/          (50 GB, HDD for cost)
└── test-results/          (optional, 20 GB HDD)

docker run ... \
  -v /storage/agile-writer/sessions:/app/sessions:rw \
  -v /storage/agile-writer/reports:/app/reports:rw \
  -v /storage/agile-writer/playwright/.auth:/app/playwright/.auth:ro \
  -v /storage/agile-writer/reference_files:/app/reference_files:ro \
  -v /storage/agile-writer/raw_qa_files:/app/raw_qa_files:rw
```

### **Option 2: Kubernetes (Production)**
```yaml
# Use PersistentVolumeClaim (PVC) for each mount
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: agile-writer-sessions
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 50Gi

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: agile-writer-reports
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: ssd
  resources:
    requests:
      storage: 20Gi

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: agile-writer-auth
spec:
  accessModes: [ReadOnlyMany]  # Multiple pods can read
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 1Gi

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: agile-writer-raw-qa
spec:
  accessModes: [ReadWriteMany]  # Needed for scaling
  storageClassName: nfs
  resources:
    requests:
      storage: 100Gi

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agile-writer-test-runner
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: test-runner
        image: agilewritertest-test-runner:1.0.0
        volumeMounts:
        - name: sessions
          mountPath: /app/sessions
        - name: reports
          mountPath: /app/reports
        - name: auth
          mountPath: /app/playwright/.auth
          readOnly: true
        - name: reference-files
          mountPath: /app/reference_files
          readOnly: true
        - name: raw-qa-files
          mountPath: /app/raw_qa_files
      
      volumes:
      - name: sessions
        persistentVolumeClaim:
          claimName: agile-writer-sessions
      - name: reports
        persistentVolumeClaim:
          claimName: agile-writer-reports
      - name: auth
        persistentVolumeClaim:
          claimName: agile-writer-auth
      - name: reference-files
        persistentVolumeClaim:
          claimName: agile-writer-reference-files
      - name: raw-qa-files
        persistentVolumeClaim:
          claimName: agile-writer-raw-qa
```

### **Option 3: Docker Swarm (Multi-Host)**
```yaml
version: '3.8'

services:
  test-runner:
    image: agilewritertest-test-runner:1.0.0
    deploy:
      replicas: 3
      placement:
        constraints: [node.role == worker]
    volumes:
      # Use named volumes (managed by Swarm)
      - sessions_vol:/app/sessions:rw
      - reports_vol:/app/reports:rw
      - auth_vol:/app/playwright/.auth:ro
      - reference_vol:/app/reference_files:ro
      - raw_qa_vol:/app/raw_qa_files:rw

volumes:
  sessions_vol:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.local,vers=4,soft,timeo=180,bg,tcp,rw
      device: ":/exports/agile-writer/sessions"
  
  auth_vol:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.local,vers=4,soft,timeo=180,bg,tcp,ro
      device: ":/exports/agile-writer/auth"
  
  # ... other volumes
```

---

## Pre-Deployment Checklist

### **Before First Deploy**

- [ ] Create all mount point directories on host:
  ```bash
  mkdir -p /storage/agile-writer/{sessions,reports,reference_files,raw_qa_files,test-results}
  mkdir -p /storage/agile-writer/playwright/.auth
  ```

- [ ] Set correct permissions:
  ```bash
  chown 1000:1000 /storage/agile-writer/sessions
  chown 1000:1000 /storage/agile-writer/reports
  chmod 755 /storage/agile-writer/reference_files
  chmod 755 /storage/agile-writer/raw_qa_files
  ```

- [ ] Pre-generate auth state locally:
  ```bash
  npx playwright test --project=setup
  cp -r playwright/.auth /storage/agile-writer/
  ```

- [ ] Seed reference files:
  ```bash
  cp reference_files/*.xlsx /storage/agile-writer/reference_files/
  ```

- [ ] Test mount permissions:
  ```bash
  docker run --rm \
    -v /storage/agile-writer/sessions:/app/sessions:rw \
    -v /storage/agile-writer/playwright/.auth:/app/playwright/.auth:ro \
    agilewritertest-test-runner \
    sh -c "touch /app/sessions/test.txt && cat /app/playwright/.auth/user.json"
  ```

- [ ] Verify `.env` is in `.gitignore` (never commit secrets):
  ```bash
  grep ".env" .gitignore  # Should match
  git status .env  # Should show "ignored"
  ```

- [ ] Enable log rotation (prevent disk fill):
  ```bash
  docker inspect agilewritertest-test-runner | grep -A5 LogConfig
  ```

### **Monitoring & Maintenance**

- [ ] Monitor `/app/sessions` disk usage:
  ```bash
  df -h /storage/agile-writer/sessions
  # Alert if >70%
  ```

- [ ] Monitor `/app/raw_qa_files` for old files (implement archival):
  ```bash
  find /storage/agile-writer/raw_qa_files -type f -mtime +30 -delete
  ```

- [ ] Verify `/app/playwright/.auth` is read-only (no accidental writes):
  ```bash
  ls -la /storage/agile-writer/playwright/.auth/
  # Should be: -r--r--r-- (readable, not writable)
  ```

- [ ] Test cleanup after container stop:
  ```bash
  # Sessions should auto-cleanup after 60 minutes
  # Verify no orphaned directories
  ls -la /storage/agile-writer/sessions/
  ```

---

## Summary: Mount These in Production

| Mount | Path | Mode | Why |
|-------|------|------|-----|
| **CRITICAL** | `/app/sessions` | `rw` | Test output; auto-cleanup after 60 min |
| **CRITICAL** | `/app/reports` | `rw` | Fallback report storage |
| **CRITICAL** | `/app/playwright/.auth` | `ro` | Pre-generated auth state |
| **RECOMMENDED** | `/app/reference_files` | `ro` | Accuracy scoring baseline |
| **RECOMMENDED** | `/app/raw_qa_files` | `rw` | QA test data input; watch for new files |
| **OPTIONAL** | `/app/test-results` | `rw` | Debugging (remove if space-constrained) |
| **OPTIONAL** | `/app/playwright-report` | `rw` | Traces/screenshots (remove for production) |

**Don't mount** `/app/node_modules` — it's in the image and adding 115 MB per replica.

Use the provided docker-compose.yml and follow the pre-deployment checklist. Ask if you need help setting up specific storage backends (NFS, S3, Kubernetes StorageClass, etc.).
