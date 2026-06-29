# Senior DevOps Architecture Analysis: AgileWriter Test Runner
## Comprehensive Production Deployment Architecture

**Analysis Date**: 2026-06-22  
**Container ID**: 283865b9ebcb  
**Image**: agilewritertest-test-runner:latest  
**Build Date**: 2026-06-18T06:37:40Z  
**Analyst Role**: Senior DevOps Architect

---

# SECTION 1: OBSERVED FACTS

## A. Docker Image Metadata (Evidence-Based)

### Image Specifications
```
Image ID:             sha256:ae3be3a93581959f8d814b3f737836650d9268340b02fe22b11f606913607b19
Uncompressed Size:    2.63 GB (virtual)
Compressed Size:      958 MB (on disk)
Architecture:         amd64 (x86-64)
OS:                   Linux (Ubuntu 24.04 Noble)
Build System:         Docker BuildKit
Dockerfile Version:   Buildkit v0
```

### Image Layers (8 total, largest to smallest)
```
Layer 1: /ms-playwright installation      2.02 GB  (Playwright browser binaries + Chromium)
Layer 2: Ubuntu base                      87.6 MB  (Base OS)
Layer 3: Node + build tools               362 MB   (Node 20 LTS, npm, git, openssh-client, yarn)
Layer 4: npm ci (node_modules)            115 MB   (Production dependencies)
Layer 5: Application code                 45.7 MB  (Source code + tests)
Layer 6: EXPOSE instruction               0 B      (Metadata only)
Layer 7: WORKDIR                          8.19 KB  (Metadata only)
Layer 8: Package files                    94.2 KB  (package*.json)
─────────────────────────────────────────────────
Total:                                    2.63 GB  (uncompressed)
```

### Base Image Dependencies
```
FROM: mcr.microsoft.com/playwright:v1.58.2-noble

This base image includes:
- Ubuntu 24.04 (noble) base OS
- Node.js 20 LTS (pre-installed)
- Playwright 1.58.2
- Chromium browser (pre-installed)
- All graphics/font libraries for browser rendering
- Git, curl, wget, ca-certificates
- User: pwuser (for Playwright sandboxing)
```

## B. Runtime Metrics (Observed in Container)

### CPU Usage (Idle State)
```
Observed CPU %:       0.00%
Host CPUs Visible:    8 CPUs (from docker exec cpuinfo count)
CPU Model:            (from host, not container-restricted)
Throttling:           None detected (no CPU limits set)
Process:              node server/test-runner-server.js (PID 1)
```

### Memory Usage (Idle State)
```
Current Memory:       112.4 MiB (idle, no active tests)
Memory Limit:         7.44 GiB (host memory, no limit set)
Memory %:             1.47% of host
Node.js Heap:         5.8 MB total, 4.3 MB in use
Node.js RSS:          ~120 MB (including system libs)
Memory Swapping:      0 B (not swapping)
```

### Network I/O (56 minutes uptime)
```
RX (Inbound):         1.75 kB (minimal, idle server)
TX (Outbound):        126 B   (minimal, idle server)
Network Model:        Bridge (default Docker network)
Port Exposure:        3000/tcp → 0.0.0.0:3000 (IPv4 + IPv6)
```

### Disk I/O (56 minutes uptime)
```
Read (BlockIO):       168 MB  (startup: library loading)
Write (BlockIO):      5.12 MB (logs, temporary files)
I/O Model:            Container storage driver (overlay2/aufs)
```

## C. Mounted Volumes (From docker-compose.yml)

```yaml
Bind Mounts (3):
  1. ./sessions → /app/sessions              (rw)   # Test outputs
  2. ./reports → /app/reports                (rw)   # Legacy reports
  3. ./playwright/.auth → /app/playwright/.auth (ro) # Auth state
```

## D. Storage State Analysis (Local Directory Contents)

```
Current Storage Usage (Development Environment):

sessions/
├─ File Count:        94 files
├─ Total Size:        5.18 MB
├─ File Types:        JSON (step-results), DOCX (reports), TMP (temp)
├─ TTL Cleanup:       60 minutes (server-side, running)
└─ State:             Active accumulation (tests running)

reports/
├─ File Count:        0 files
├─ Total Size:        0 MB (unused, legacy)
└─ State:             Fallback location (not actively used)

raw_qa_files/
├─ File Count:        3 files
├─ Total Size:        0.57 MB
├─ File Type:         XLSX (spreadsheets)
└─ State:             Test input data (static in dev)

reference_files/
├─ File Count:        3 files
├─ Total Size:        ~1 MB (estimated)
└─ State:             Accuracy scoring baseline

playwright/.auth/
├─ File Count:        1 file (user.json)
├─ Total Size:        ~100 KB
├─ State:             Pre-generated, static, read-only
└─ Lifetime:          Until token expiry (30+ days)
```

## E. Application Dependencies (From package.json)

### Production Dependencies (5)
```
cors@2.8.6                  # Cross-Origin Resource Sharing
docx@9.6.1                  # Word document generation
dotenv@17.3.1               # Environment variable loading
express@5.2.1               # HTTP web framework
html-to-docx@1.8.0          # HTML → DOCX conversion
```

### Development Dependencies (6, bundled in image)
```
@playwright/test@1.58.2     # Browser automation testing
@types/node@25.5.0          # TypeScript types
@types/string-similarity@4.0.2
string-similarity@4.0.4     # String matching for accuracy scoring
ts-node@10.9.2              # TypeScript execution
typescript@6.0.2            # TypeScript compiler
xlsx@0.18.5                 # Excel file parsing/generation
```

### Test Suites (24 discovered)
```
Playwright test specs found: 24 *.spec.ts files
Categories:
  - health_*.spec.ts          (Health checks)
  - AW_*.spec.ts              (AgileWriter workflow tests)
  - accuracy.spec.ts          (Accuracy validation)
  - diagnostics/*.spec.ts     (Debug utilities)

Test Execution Model:
  - Playwright workers: 1 (serial execution, no parallelization)
  - Timeout per test: 600 seconds (10 minutes)
  - Browser headless: true (production mode)
  - Browser: Chromium (from /ms-playwright)
```

## F. Server Architecture (From test-runner-server.js)

### HTTP Server
```
Framework:           Express 5.2.1
Port:                3000/tcp
Connection Model:    Stateful (WebSocket/SSE streams)
CORS:                Enabled (accepts all origins)
Body Parser:         JSON (express.json())
Logging:             Console stdout/stderr
Health Check:        MISSING (critical gap)
Graceful Shutdown:   MISSING (critical gap)
```

### Session Management
```
Session Model:       In-memory Map<sessionId, session>
Session TTL:         60 minutes (auto-cleanup after completion)
Session Data:        { clients: [ServerResponse[]], startTime: number }
Session Lifetime:    From test start → TTL expiry
Max Concurrent:      Unlimited (no pooling)
Persistence:         None (lost on container restart)
```

### File System Operations
```
Directories Watched:
  - /app/raw_qa_files         (fs.watch for new .xlsx files)
  
Directories Created/Managed:
  - /app/sessions/<sessionId> (test output)
  - /app/reports/accuracy     (accuracy scoring results)
  - /app/reference_files      (user-provided baselines)
  - /app/raw_qa_files         (user-provided test data)

File Operations:
  - Watch/Monitor:   fs.watch() (native, inefficient on Windows NFS)
  - Read/Write:      Synchronous fs calls (blocks event loop)
  - Cleanup:         setTimeout() → fs.rmSync() (node TTL)
```

### Background Processes
```
Spawned Child Processes:
  1. npx tsc --noEmit --pretty                (TypeScript compiler)
  2. npx playwright test <testFile>           (Browser automation)
  3. node generate-word-report.js             (Report generation)

Process Management:
  - Launch Method:    spawn() with shell: true
  - Lifecycle:        Sequential (tsc → playwright → report)
  - Cleanup:          On close event (async)
  - Error Handling:   Broadcast to clients via SSE
  - Resource Cleanup: NOT implemented (risk: zombie processes)
```

### API Endpoints (12 active)
```
GET  /                                  (Redirect to /ui)
GET  /ui/*                              (Static UI files)
GET  /list-tests                        (List available test specs)
GET  /stream                            (WebSocket: test output stream)
GET  /api/env-status                    (Environment variable check)
POST /run-test                          (Start test execution)
GET  /download-report                   (Download .docx report)
GET  /api/accuracy/reference-files      (List baseline files)
GET  /api/accuracy/raw-qa-files         (List QA input files)
POST /api/accuracy/score                (Run accuracy scoring)
GET  /api/accuracy/results              (List scoring results)
GET  /api/accuracy/watch                (WebSocket: file watcher stream)
GET  /api/accuracy/download/:filename   (Download accuracy report)
```

## G. Security Posture (Current State)

### User & Permissions
```
Container User:       root (uid 0, gid 0, CRITICAL GAP)
Process UID:          0 (full system privileges)
Capabilities:         All (CAP_SYS_ADMIN, etc. - unrestricted)
Privilege Escalation: Possible (root user can escalate)
AppArmor/SELinux:     None detected
```

### Secrets & Credentials
```
Environment Variables Loaded:
  - MS_EMAIL           (Microsoft account email)
  - MS_PASSWORD        (Microsoft account password)
  - BASE_URL           (Target application URL)
  - TEST_ENV           (QA/Production identifier)
  - PLACEHOLDER_REGEX  (Pattern matching config)
  - 30+ HEALTH_* vars  (Test configuration)

Secret Storage:
  - Source:            .env file (mounted at runtime)
  - Risk:              If .env committed to git, credentials leaked forever
  - Baking:            NOT in image (.dockerignore excludes .env ✓)
  - Handling:          Loaded via dotenv, potentially in logs ✗
  - Sanitization:      Sanitized in step-results.json (email, URL masked)
```

### Image Content
```
Vulnerabilities:
  - Base OS:          Ubuntu 24.04 (April 2026 packages)
  - Node.js:          20 LTS (latest 20.x)
  - Playwright:       1.58.2 (latest 1.58.x)
  - Dependencies:     No known CVEs (as of June 2026)

Build Quality:
  - Layer Caching:    ✓ Good (package*.json layer separated)
  - .dockerignore:    ✓ Correct (excludes node_modules, .env, sessions, reports)
  - Secrets in Build: ✗ Risk (npm ci could install vulnerable packages)
```

### Network & Ports
```
Port 3000/tcp:        Published to 0.0.0.0 (all interfaces)
IPv4 Binding:         0.0.0.0:3000 (accepts external traffic)
IPv6 Binding:         [::]:3000 (accepts IPv6 traffic)
Authentication:       NONE (no API key, no auth middleware)
HTTPS/TLS:            NOT configured (http only)
Rate Limiting:        NOT configured
```

---

# SECTION 2: ASSUMPTIONS

## A. Production Workload Assumptions

### Test Execution Model
**Assumption**: Based on code analysis (serial workers: 1, 24 test specs)
```
Assumption 1: Single test execution per container
  - Evidence: Playwright workers: 1 (serial execution)
  - Evidence: No connection pooling or queue management
  - Business Question: Will tests be parallelized?

Assumption 2: Test duration distribution
  - Normal case:        10–30 minutes per test
  - Health checks:      30 minutes (HEALTH_EXPECTED_MINUTES_IDEAYA=30)
  - Accuracy scoring:   5–10 minutes (scoring 100–1000 rows)
  - Outlier:            >60 minutes (if network issues or data overload)
  - Business Question: What's the actual P95 test duration?

Assumption 3: Test scheduling
  - Hypothesis 1:       Manual on-demand runs (current model)
  - Hypothesis 2:       Scheduled nightly/daily CI/CD
  - Hypothesis 3:       Continuous test queue
  - Business Question: Is this 100% on-demand or scheduled?

Assumption 4: Concurrent test runners needed
  - Current:            1 container (serial tests)
  - Estimated:          1–5 concurrent runners (for production)
  - Business Question: How many parallel test runners?
```

### Data Volume Assumptions

#### Generated Files (per test run)
```
Test Report (.docx):         2–5 MB (1 file per test)
Step Results (.json):        50–200 KB (1 file per test)
Accuracy Reports (.xlsx):    500 KB–2 MB (1 file per scoring run)
Total per test:              2–7 MB

Calculation Basis:
  - Test count:      24 specs
  - Estimated runs:  50–100 tests/day (business assumption)
  - Test duration:   30 min average
  - Concurrency:     2–4 parallel (estimated)
  - Daily volume:    100–700 MB (test reports alone)
```

#### Storage Growth Rate (Production, Annual)
```
Conservative (50 tests/day):
  - Daily:           350 MB
  - Monthly:         ~10 GB
  - Annual:          ~120 GB (test reports + accuracy scoring)

Aggressive (200 tests/day):
  - Daily:           1.4 GB
  - Monthly:         ~42 GB
  - Annual:          ~500 GB

Business Question: What's the actual test volume target?
```

### Network Assumptions
```
Assumption 1: Target system access
  - Source:          Container (internal Docker network or cloud VPC)
  - Destination:     BASE_URL (https://app-v2-rc1-aw.smarter.codes)
  - Latency:         <100 ms (production SLA)
  - Bandwidth:       <10 Mbps per test (browser automation)

Assumption 2: Cloud environment
  - Region:          US-EAST-1 (from docker-compose.yml timezone)
  - Network:         VPC with NAT (for external app access)
  - Firewall:        Egress allows HTTPS to app-v2-rc1-aw.smarter.codes

Business Question: What's the exact target environment? SaaS, on-prem, hybrid?
```

### Compliance & Retention Assumptions
```
Assumption 1: Regulatory requirements
  - Hypothesis 1:    FDA 21 CFR Part 11 (if clinical trial related)
  - Hypothesis 2:    GxP compliance (QA/QC standards)
  - Hypothesis 3:    Internal audit requirements only
  - Business Question: Are there regulatory requirements?

Assumption 2: Data retention
  - Test reports:    90 days (active) + 180 days (archive)
  - Accuracy data:   180 days (active) + 365+ days (compliance)
  - Logs:            30–90 days (operational debugging)
  - Business Question: What are your data retention policies?

Assumption 3: Disaster recovery requirements
  - RTO Target:      1–4 hours
  - RPO Target:      1 hour (acceptable data loss)
  - Backup Frequency: Hourly to 15-minute intervals
  - Business Question: What's your RTO/RPO SLA?
```

---

# SECTION 3: RECOMMENDATIONS

## 1. ESTIMATED CPU REQUIREMENTS

### Analysis

**Idle State** (Observed):
```
Current CPU Usage:    0.00% (server waiting for requests)
Memory Overhead:      ~120 MB Node.js process
```

**Active State (During Test Execution)**:
```
Components with CPU Load:

1. Playwright/Chromium (Main Consumer)
   - Browser rendering:    0.5–1.5 cores (depends on page complexity)
   - JavaScript execution: 0.2–0.5 cores (test script execution)
   - Network I/O wait:     Mostly blocked I/O (low CPU)

2. Node.js Event Loop
   - Test coordination:    0.1–0.2 cores (lightweight)
   - SSE/WebSocket:        0.05–0.1 cores (streaming logs)

3. Document Generation (Occasional Spike)
   - HTML → DOCX render:   0.3–0.8 cores (30–60 second spike)
   - Spike Frequency:      Every 30 minutes (after each test)

4. TypeScript Compilation (Pre-Test)
   - tsc --noEmit:         0.5–1.0 cores (20–60 second spike)
   - Frequency:            Once per test run

Total CPU During Test Execution:
  - Normal case:          0.8–2.0 cores
  - Peak (compile + render):  1.5–2.5 cores
  - Burst (compile + playwright + render):  2.0–3.0 cores
```

### Recommendation

**Development/QA**:
```yaml
CPU Allocation:
  - Limit:            2 cores (hard limit, prevent runaway)
  - Reservation:      1 core (guaranteed baseline)
  - Rationale:        Single test serial; 1 core sufficient, 2 for bursts
```

**Production (Single Runner)**:
```yaml
CPU Allocation:
  - Limit:            2 cores
  - Reservation:      1.5 cores
  - Rationale:        One-at-a-time tests; need headroom for Playwright peak
```

**Production (3 Parallel Runners)**:
```yaml
Per Container:
  - Limit:            2 cores
  - Reservation:      1.5 cores

Total Cluster:
  - CPU Needed:       6 cores reserved + headroom for peaks
  - GCP Recommendation:  n2-standard-8 (8 vCPU) or n2-standard-4 (4 vCPU) + 1 container
```

---

## 2. ESTIMATED MEMORY REQUIREMENTS

### Analysis

**Idle State** (Observed):
```
Current Memory:       112 MiB
Components:
  - Node.js process:  ~120 MB (base overhead)
  - System libraries: ~50 MB (kernel + shared libs)
  - Total minimum:    ~120 MB
```

**Active State (During Test)**:
```
Memory Consumption by Component:

1. Node.js Heap
   - Baseline:         ~50 MB
   - Idle sessions:    ~100 MB (Map of active sessions)
   - Active test:      ~200 MB (test state + SSE buffers)
   - Worst case:       ~300 MB (multiple simultaneous uploads)

2. Playwright/Chromium (Dominant Consumer)
   - Browser startup:  ~300–400 MB
   - Single tab:       ~100–200 MB
   - Heavy page load:  ~500–1000 MB (depending on DOM complexity)
   - Two browser contexts:  ~800–1200 MB
   - Worst case:       ~1200–1500 MB

3. Document Generation
   - HTML parsing:     ~50–100 MB
   - DOCX rendering:   ~100–200 MB (temporary buffers)
   - Total spike:      ~200–300 MB

4. Accuracy Scoring (Optional, Overlaps Test Execution)
   - XLSX parsing:     ~50–200 MB (depends on file size)
   - String similarity engine:  ~100–300 MB (full workbook in memory)
   - Concurrent with test:  +500 MB additional

Memory Peak Scenarios:

Scenario A: Single Test
  - Baseline:         120 MB
  - + Playwright:     +400 MB
  - + SSE buffers:    +50 MB
  - Total:            ~570 MB

Scenario B: Test + Accuracy Scoring
  - Single test:      570 MB
  - + XLSX scoring:   +150 MB
  - Total:            ~720 MB

Scenario C: Multiple Concurrent Tests (if scaled)
  - Not supported (workers: 1, serial execution)
  - Would require:    1.2–1.5 GB per concurrent test

Observed Evidence:
  - Idle container:   112 MiB
  - Max observed:     ~120 MiB (no active test in 56-minute uptime)
  - Extrapolated peak (single test): ~800 MB–1.2 GB
```

### Recommendation

**Development/QA**:
```yaml
Memory Allocation:
  - Limit:            2 GB (hard limit, OOM kill if exceeded)
  - Reservation:      1.5 GB (guaranteed allocation)
  - Rationale:        Breathing room for Playwright + DOCX generation + spikes
  - Monitoring:       Alert at 1.2 GB (75% of limit)
```

**Production (Single Runner)**:
```yaml
Memory Allocation:
  - Limit:            3 GB
  - Reservation:      2.5 GB
  - Rationale:        Peak test execution (Playwright 1.2 GB + DOCX 200 MB + overhead)
  - Monitoring:       Alert at 2.1 GB (70% of limit)
```

**Production (Multiple Runners)**:
```yaml
Per Runner:
  - Limit:            3 GB
  - Reservation:      2.5 GB

3-Runner Cluster:
  - Total Reserved:   7.5 GB
  - Total Max:        9 GB
  - Host VM Minimum:  12 GB (includes system overhead)
  - GCP Recommendation:  n2-standard-4 (16 GB RAM) or n2-highmem-2 (16 GB RAM)
```

---

## 3. PERSISTENT STORAGE REQUIREMENTS

### Critical (Must Mount)

**`/app/sessions`** (Read-Write)
```
Purpose:              Test execution output + reports
Content:              .docx reports, step-results.json, runtime-config.json
Size per Test:        2–5 MB
TTL Cleanup:          60 minutes (server-side auto-deletion)
Lifetime:             1 hour max (unless backed up before TTL)
Risk Level:           CRITICAL (reports are primary deliverable)

Recommendation:
  - Mount:            YES (required)
  - Mode:             rw
  - Storage Class:    Fast SSD (NVMe or local fast storage)
  - Size:             10 GB (local peak concurrent tests)
  - Backup:           Every 15 minutes to S3 (before TTL expiry)
```

**`/app/reports`** (Read-Write, Legacy)
```
Purpose:              Fallback report storage (deprecated)
Content:              .docx files (if SESSION_ID not set)
Size:                 Minimal in production (using sessions/ instead)
Retention:            Indefinite (no auto-cleanup)
Risk Level:           HIGH (accumulation risk)

Recommendation:
  - Mount:            YES (keep for backward compatibility)
  - Mode:             rw
  - Storage Class:    Standard (not frequently accessed)
  - Size:             5 GB
  - Cleanup:          Manual or 180-day archive rotation
```

**`/app/playwright/.auth`** (Read-Only)
```
Purpose:              Pre-generated browser auth state (cookies/tokens)
Content:              user.json (Playwright serialized session)
Size:                 ~100 KB (static)
Lifetime:             Until token expiry (30–90 days)
Risk Level:           CRITICAL (required for test execution)

Recommendation:
  - Mount:            YES (must pre-exist)
  - Mode:             ro (read-only, prevent corruption)
  - Storage Class:    Any (static, rarely accessed)
  - Pre-deployment:   Generate locally: npx playwright test --project=setup
  - Refresh:          Every 30 days (before expiry)
```

### Recommended (Should Mount)

**`/app/reference_files`** (Read-Only)
```
Purpose:              Accuracy scoring baseline data
Content:              .xlsx files (user-provided reference data)
Size:                 10–50 MB (static, grows slowly)
Lifetime:             Indefinite (user-managed)
Risk Level:           HIGH (needed for accuracy validation)

Recommendation:
  - Mount:            YES
  - Mode:             ro (managed externally)
  - Storage Class:    Standard (infrequent access)
  - Size:             50 GB
```

**`/app/raw_qa_files`** (Read-Write)
```
Purpose:              QA test data input files
Content:              .xlsx files (AgileWriter output)
Size:                 20–100 GB (accumulates; needs archival)
Lifetime:             30–90 days (then archive to cloud)
Risk Level:           MEDIUM (needed for scoring, but replaceable)

Recommendation:
  - Mount:            YES
  - Mode:             rw
  - Storage Class:    Standard or Nearline (cost-optimized)
  - Size:             100 GB
  - Cleanup Policy:   Archive files >30 days old to Cloud Storage
  - Example Script:   Move to gs://agile-writer-backups/raw_qa_files/
```

### Optional (Development Only)

**`/app/test-results`** (Read-Write, Debug)
```
Purpose:              Playwright JSON test results
Content:              .json test metadata
Size:                 5–20 MB per test
Risk Level:           LOW (redundant with step-results.json)

Recommendation:
  - Mount:            SKIP in production (ephemeral)
  - Alternative:      Mount if actively debugging; clean up after 7 days
```

**`/app/playwright-report`** (Read-Write, Trace)
```
Purpose:              Playwright trace files + screenshots
Content:              .zip traces, PNG screenshots
Size:                 20–100 MB per test (large!)
Risk Level:           LOW (debug-only, not audit-required)

Recommendation:
  - Mount:            SKIP in production (too large)
  - Alternative:      Use local development only
```

### Storage Tier Recommendation

```
Tier 1: Local Hot Storage (/app/sessions, /app/reports)
  - Capacity:         20 GB
  - Type:             NVMe SSD or fast local disk
  - Latency:          <5 ms
  - Cost:             $100–200/month (on GCP)
  - Retention:        90 days live

Tier 2: Cloud Standard Storage (/app/raw_qa_files)
  - Capacity:         100 GB
  - Type:             GCS Standard or S3
  - Latency:          <100 ms
  - Cost:             $2/month (GCS)
  - Retention:        30–90 days active

Tier 3: Cloud Archive Storage (Backup)
  - Capacity:         1 TB (annual backups)
  - Type:             GCS Nearline / S3 Glacier
  - Latency:          4–24 hours (not for production read)
  - Cost:             $0.01/month (GCS Archive)
  - Retention:        180+ days (compliance)
```

---

## 4. STORAGE GROWTH EXPECTATIONS (Annual)

### Conservative Scenario (50 tests/day)

```
Daily Volume:
  - Tests/day:                    50
  - Avg report size:              3 MB
  - Daily test reports:           150 MB
  - Accuracy scoring (5 runs):    3 MB
  - Daily total:                  ~153 MB

Monthly Growth:
  - Test reports:                 ~4.5 GB
  - Accuracy reports:             ~0.1 GB
  - Monthly total:                ~4.6 GB

Annual Growth:
  - Test reports:                 ~54 GB
  - Accuracy reports:             ~1.2 GB
  - Raw QA files (if kept):       ~20 GB (estimated)
  - Total annual:                 ~75 GB
```

### Moderate Scenario (100–150 tests/day)

```
Daily Volume:
  - Tests/day:                    100–150
  - Daily test reports:           300–450 MB
  - Accuracy scoring (10 runs):   6 MB
  - Daily total:                  ~306–456 MB

Monthly Growth:
  - Monthly total:                ~9–14 GB

Annual Growth:
  - Test reports:                 ~110–170 GB
  - Accuracy reports:             ~2.5 GB
  - Raw QA files (if kept):       ~50 GB
  - Total annual:                 ~150–220 GB
```

### Aggressive Scenario (500+ tests/day, automated CI/CD)

```
Daily Volume:
  - Tests/day:                    500+
  - Daily test reports:           1.5–2.5 GB
  - Accuracy scoring (50 runs):   30 MB
  - Daily total:                  ~1.5–2.5 GB

Monthly Growth:
  - Monthly total:                ~45–75 GB

Annual Growth:
  - Test reports:                 ~550–900 GB
  - Accuracy reports:             ~12 GB
  - Raw QA files (if kept):       ~200 GB
  - Total annual:                 ~750–1100 GB

Cost Impact:
  - Storage cost:                 ~$200–300/month (GCP)
  - Backup cost:                  ~$50–100/month
  - Total:                        ~$3000–4800/year
```

### Recommendation

```
Storage Provisioning Strategy:

Year 1:
  - Local hot storage:            50 GB
  - Cloud tier 2:                 200 GB
  - Archive tier:                 500 GB backup space
  - Estimated cost:               $50–100/month

Year 2–3:
  - Monitor actual growth rate
  - Implement archival automation (move >90 days to archive)
  - Scale based on actual volume
  - Estimated cost:               $100–200/month (steady state)

Growth Rate Assumption:
  - Conservative assumption:      75 GB/year
  - Monitor actual:               Track monthly growth rate
  - Alert threshold:              If growth >100 GB/month, review archival policy
```

---

## 5. REPORT RETENTION CONSIDERATIONS

### Regulatory & Compliance Requirements

**Unknown (Business Input Needed)**:
```
Question 1: Is this FDA 21 CFR Part 11 regulated?
  - If YES → 7-year retention minimum
  - If NO → Proceed with business retention policy

Question 2: Is this clinical trial data?
  - If YES → 2–7 year retention per protocol + regulatory requirements
  - If NO → Standard business retention (1–2 years)

Question 3: Industry compliance (GxP, ISO, SOC 2)?
  - If YES → Specify requirements (usually 3–7 years)
  - If NO → Standard business retention
```

### Recommended Retention Policy (Standard Business)

```
Active Tier (Hot, Searchable):
  - Duration:         90 days
  - Storage:          Local fast disk
  - Cost:             Minimal
  - Access:           API, download, search
  - Use Case:         User access, recent reports

Archive Tier (Warm, Compliance):
  - Duration:         180–365 days (after active TTL)
  - Storage:          Cloud Standard-IA
  - Cost:             $0.03/GB/month
  - Access:           Slow (4–24 hour retrieval)
  - Use Case:         Regulatory audit, compliance

Cold Tier (Archive, Long-term):
  - Duration:         2–7 years (per regulatory requirement)
  - Storage:          Cloud Archive (GCS Archive, S3 Glacier)
  - Cost:             $0.004/GB/month
  - Access:           Very slow (4–48 hours)
  - Use Case:         Legal hold, post-audit reference

Purge:
  - Duration:         After legal hold expiry + retention grace period
  - Storage:          Deleted from all tiers
  - Compliance:       Document deletion with timestamp/hash
```

### Implementation (Automation)

```bash
#!/bin/bash
# Automated retention policy enforcement

# Daily cron job

# 1. Move reports >90 days old to Cloud Standard-IA
find /storage/reports -mtime +90 -type f | while read file; do
  gs_path="gs://agile-writer-archive/reports/$(basename $file)"
  gsutil -m cp "$file" "$gs_path"
  gsutil -m rewrite -s STANDARD_IA "$gs_path"
  rm "$file"
done

# 2. Move reports >365 days old to Archive
gsutil -m rewrite -s ARCHIVE "gs://agile-writer-archive/reports/2024-*"

# 3. Verify archive integrity (monthly)
gsutil -m hash gs://agile-writer-archive/reports/*.docx
```

---

## 6. BACKUP REQUIREMENTS

### Backup Strategy (3-Tier)

**Tier 1: Continuous/Real-Time (RPO: 15 minutes)**
```
Backup Interval:      Every 15 minutes
Source:               /app/sessions (live test reports)
Destination:          GCS Standard (s3://agile-writer-backups)
Retention:            30 days
Purpose:              Disaster recovery (recent data)
RTO:                  15 minutes (download from GCS)
Cost:                 ~$10/month (GCS Standard)

Implementation:
  - Cron: */15 * * * * /usr/local/bin/backup_recent_reports.sh
  - Script: aws s3 sync /app/sessions s3://agile-writer-backups/sessions --exclude "*.tmp"
```

**Tier 2: Daily Archive (RPO: 24 hours)**
```
Backup Interval:      Once daily (2 AM UTC)
Source:               /app/sessions + /app/reports
Destination:          GCS Nearline (archive tier)
Retention:            180 days
Purpose:              Compliance, long-term audit trail
RTO:                  2–4 hours (retrieval + restore)
Cost:                 ~$2/month (GCS Nearline)

Implementation:
  - Cron: 0 2 * * * /usr/local/bin/archive_daily_reports.sh
  - Script: Tar + compress → GCS Nearline with retention lock
```

**Tier 3: Off-Site (RPO: 7 days)**
```
Backup Interval:      Weekly (Friday 2 AM UTC)
Source:               Archive tier snapshot
Destination:          Multi-region GCS Archive
Retention:            365+ days
Purpose:              Ransomware protection, geographic redundancy
RTO:                  4–24 hours
Cost:                 ~$0.50/month (GCS Archive)

Implementation:
  - Cron: 0 2 * * 5 /usr/local/bin/offsite_backup.sh
  - Script: Replicate from Nearline to Archive (different region)
```

### Backup Monitoring

```yaml
CloudWatch Alarms:
  - Last backup: Alert if >20 min old
  - Backup size: Alert if <expected (indicates data loss)
  - Backup success: Alert if 3 consecutive failures
  - Storage growth: Alert if >expected growth rate

Dashboard Metrics:
  - Backup success rate (target: 99%+)
  - Average backup duration
  - Bytes backed up per interval
  - Restore success rate (test monthly)
```

---

## 7. RECOMMENDED GCP VM SIZING

### Single Runner (Development/QA)

```yaml
Instance Type:        n2-standard-2
vCPU:                 2 vCPU
Memory:               8 GB RAM
Disk:                 50 GB (standard persistent disk)
Network:              1 Gbps
Cost:                 ~$55/month

Configuration:
  - CPU Limit:        2 cores
  - Memory Limit:     2 GB (application) + 2 GB (system)
  - Storage:          20 GB (/app/sessions) + 30 GB (/tmp)

Use Case:
  - Manual test runs
  - Single test execution (serial)
  - Development/QA environment
```

### Single Runner (Production, Small Volume)

```yaml
Instance Type:        n2-standard-4
vCPU:                 4 vCPU
Memory:               16 GB RAM
Disk:                 100 GB (SSD persistent disk)
Network:             1 Gbps
Cost:                 ~$110/month

Configuration:
  - CPU Limit:        2 cores (per container)
  - Memory Limit:     3 GB (per container)
  - Storage:          50 GB (/app/sessions) + 50 GB (/app/raw_qa_files)

Justification:
  - 1 container running
  - Headroom for OS/system services
  - Room to scale to 2 containers if needed
  - Recommended for <100 tests/day
```

### Multiple Runners (Production, Medium Volume)

```yaml
Instance Type:        n2-standard-8 (or 2x n2-standard-4)
vCPU:                 8 vCPU
Memory:               32 GB RAM
Disk:                 200 GB SSD
Network:              10 Gbps (if using GKE)
Cost:                 ~$220/month (single instance) or ~$220 (2x n2-4)

Configuration (3 Parallel Runners):
  Per Container:
    - CPU Limit:      2 cores
    - Memory Limit:   3 GB
  Total:
    - CPU Reserved:   6 cores (leaving 2 for system)
    - Memory Needed:  10 GB (3 × 3 + system)
    - Storage:        100 GB local + 100 GB network (raw_qa_files)

Deployment Option A: Single Instance (Docker Compose)
  - Pros:       Simpler, cheaper ($220/month)
  - Cons:       Single point of failure
  - Suitable:   Development, test environments

Deployment Option B: GKE Cluster (3 Nodes)
  - 3x n2-standard-4 (or 1x n2-standard-8 + 2x smaller)
  - Pros:       High availability, auto-scaling, managed
  - Cons:       More expensive (~$300–400/month)
  - Suitable:   Production, regulated environments
```

### Recommended Production Architecture

```yaml
Deployment:           Google Kubernetes Engine (GKE)

Cluster Config:
  Node Pool 1 (Test Runners):
    - Machine Type:   n2-standard-4
    - Node Count:     3 (for HA)
    - vCPU/Node:      4
    - Memory/Node:    16 GB
    - Disk/Node:      100 GB SSD
    - Total Cluster:  12 vCPU, 48 GB memory
    - Monthly Cost:   ~$300 (nodes) + ~$50 (storage) + ~$20 (ingress)

  Node Pool 2 (Storage/Backup):
    - Attached Storage: GCS bucket (100–200 GB)
    - Type:           Standard + Archive tiers
    - Monthly Cost:   ~$5–10

  Node Pool 3 (Logging):
    - Cloud Logging:  Integrated
    - Retention:      90 days (Google default)
    - Monthly Cost:   ~$10 (ingestion)

Total Monthly Cost:    ~$385–400

Scaling Policy:
  - Min Nodes:        2 (HA requirement)
  - Max Nodes:        5 (cost safety limit)
  - Scale Trigger:    CPU >70% for 5 minutes
  - Scale Down:       CPU <30% for 10 minutes
```

### Cost Comparison (Annual)

```
Option A: Single n2-standard-4 (Docker Compose)
  - Compute:         $110 × 12 = $1,320
  - Storage:         $50 × 12 = $600
  - Networking:      $20 × 12 = $240
  - Total:           ~$2,160/year
  - Limitation:      Max 1–2 parallel tests (shared vCPU)

Option B: GKE Cluster (3x n2-standard-4)
  - Compute:         $300 × 12 = $3,600
  - Storage:         $50 × 12 = $600
  - Networking:      $30 × 12 = $360
  - Logging/Monitor: $120
  - Total:           ~$4,680/year
  - Benefit:         Auto-scaling, HA, 3+ parallel tests

Option C: GKE with n2-highmem-2 (if memory-intensive tests)
  - Compute:         $250 × 12 = $3,000
  - Storage:         $50 × 12 = $600
  - Networking:      $30 × 12 = $360
  - Logging/Monitor: $120
  - Total:           ~$4,080/year
  - Benefit:         More memory per node (13 GB), lower vCPU cost
```

**Recommendation**:
- **Development**: Option A (single n2-standard-2, $660/year)
- **Production (Start-up)**: Option A (single n2-standard-4, $2,160/year)
- **Production (Scale-up)**: Option B (GKE 3-node cluster, $4,680/year)

---

## 8. RECOMMENDED DOCKER COMPOSE PRODUCTION ARCHITECTURE

### Production docker-compose.yml (Single Host)

```yaml
version: '3.8'

services:
  test-runner:
    image: agilewritertest-test-runner:1.0.0  # Pinned version, not 'latest'
    
    container_name: agile-writer-test-runner-1
    
    restart: unless-stopped
    
    ports:
      - "3000:3000"
    
    environment:
      # Secrets (from external .env file, NOT in compose)
      - MS_EMAIL=${MS_EMAIL}
      - MS_PASSWORD=${MS_PASSWORD}
      - BASE_URL=${BASE_URL}
      - TEST_ENV=production
      
      # Application config
      - PORT=3000
      - NODE_ENV=production
      - LOG_LEVEL=info
      - SESSION_TTL_MINUTES=60
    
    env_file:
      - /etc/agile-writer/.env.production
    
    volumes:
      # CRITICAL: Test execution output
      - /mnt/storage/agile-writer/sessions:/app/sessions:rw
      
      # CRITICAL: Legacy report fallback
      - /mnt/storage/agile-writer/reports:/app/reports:rw
      
      # CRITICAL: Pre-generated auth state (read-only)
      - /mnt/storage/agile-writer/playwright/.auth:/app/playwright/.auth:ro
      
      # RECOMMENDED: Accuracy scoring data
      - /mnt/storage/agile-writer/reference_files:/app/reference_files:ro
      - /mnt/storage/agile-writer/raw_qa_files:/app/raw_qa_files:rw
      
      # OPTIONAL: Debug traces (for development)
      # - /mnt/storage/agile-writer/test-results:/app/test-results:rw
    
    networks:
      - agile-writer-net
    
    # Resource constraints (CRITICAL)
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 3G
        reservations:
          cpus: '1.5'
          memory: 2.5G
    
    # Health check (CRITICAL)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    
    # Logging (CRITICAL for production)
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
        labels: "service=agile-writer,env=production"
    
    # Security (CRITICAL)
    user: "nodeapp:nodeapp"  # Non-root user (requires Dockerfile update)
    
    read_only_root_filesystem: false  # Cannot be true (Node.js writes to /tmp)
    
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only capability needed for port 3000
    
    security_opt:
      - no-new-privileges:true
    
    # No privileged access
    privileged: false

networks:
  agile-writer-net:
    driver: bridge

# Volumes for bind mounts (pre-provisioned on host)
# No need to define here if using host paths
```

### Production docker-compose.yml (Multi-Container Horizontal Scaling)

```yaml
version: '3.8'

services:
  # Load Balancer (optional, for multiple runners)
  nginx-lb:
    image: nginx:1.27-alpine
    container_name: agile-writer-lb
    
    ports:
      - "80:80"
      - "443:443"
    
    volumes:
      - /etc/agile-writer/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/agile-writer/ssl:/etc/nginx/ssl:ro
    
    networks:
      - agile-writer-net
    
    restart: unless-stopped
    
    depends_on:
      - test-runner-1
      - test-runner-2
  
  # Runner 1
  test-runner-1:
    image: agilewritertest-test-runner:1.0.0
    container_name: agile-writer-test-runner-1
    
    environment:
      - MS_EMAIL=${MS_EMAIL}
      - MS_PASSWORD=${MS_PASSWORD}
      - BASE_URL=${BASE_URL}
      - TEST_ENV=production
      - INSTANCE_ID=runner-1
    
    env_file:
      - /etc/agile-writer/.env.production
    
    volumes:
      # Shared volumes (NFS or cloud mount for multi-host)
      - /mnt/storage/agile-writer/sessions:/app/sessions:rw
      - /mnt/storage/agile-writer/reports:/app/reports:rw
      - /mnt/storage/agile-writer/playwright/.auth:/app/playwright/.auth:ro
      - /mnt/storage/agile-writer/reference_files:/app/reference_files:ro
      - /mnt/storage/agile-writer/raw_qa_files:/app/raw_qa_files:rw
    
    networks:
      - agile-writer-net
    
    restart: unless-stopped
    
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 3G
        reservations:
          cpus: '1.5'
          memory: 2.5G
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
        labels: "service=agile-writer,instance=runner-1,env=production"
    
    user: "nodeapp:nodeapp"
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
  
  # Runner 2
  test-runner-2:
    image: agilewritertest-test-runner:1.0.0
    container_name: agile-writer-test-runner-2
    
    # (Identical config to runner-1, different INSTANCE_ID)
    environment:
      - MS_EMAIL=${MS_EMAIL}
      - MS_PASSWORD=${MS_PASSWORD}
      - BASE_URL=${BASE_URL}
      - TEST_ENV=production
      - INSTANCE_ID=runner-2
    
    # ... (rest of config identical)
  
  # Optional: Backup Agent
  backup-agent:
    image: google/cloud-sdk:latest
    container_name: agile-writer-backup-agent
    
    volumes:
      - /mnt/storage/agile-writer:/data/agile-writer:ro
      - /etc/agile-writer/backup-script.sh:/backup-script.sh:ro
    
    environment:
      - GOOGLE_APPLICATION_CREDENTIALS=/etc/agile-writer/gcp-credentials.json
      - GCS_BUCKET=gs://agile-writer-backups
    
    entrypoint: /bin/bash
    command: -c "while true; do /backup-script.sh; sleep 900; done"  # Every 15 min
    
    networks:
      - agile-writer-net
    
    restart: unless-stopped

networks:
  agile-writer-net:
    driver: bridge
```

### Pre-Deployment Checklist

```bash
# 1. Create storage directories on host
mkdir -p /mnt/storage/agile-writer/{sessions,reports,raw_qa_files,reference_files}
mkdir -p /mnt/storage/agile-writer/playwright/.auth

# 2. Set correct permissions
chown -R 1000:1000 /mnt/storage/agile-writer/sessions
chown -R 1000:1000 /mnt/storage/agile-writer/reports
chmod -R 755 /mnt/storage/agile-writer/reference_files
chmod -R 755 /mnt/storage/agile-writer/raw_qa_files

# 3. Pre-generate auth state locally
npx playwright test --project=setup
cp -r playwright/.auth /mnt/storage/agile-writer/

# 4. Verify mount permissions
docker run --rm -v /mnt/storage/agile-writer/sessions:/app/sessions:rw \
  busybox touch /app/sessions/test.txt && echo "✓ sessions writable"

# 5. Start services
docker-compose -f docker-compose.production.yml up -d

# 6. Verify health
curl http://localhost:3000/health && echo "✓ server healthy"

# 7. Test backup integration
/usr/local/bin/backup_recent_reports.sh && echo "✓ backup working"
```

---

## 9. SECURITY RISKS & MITIGATION

### Critical Risks (Require Immediate Attention)

| Risk | Current State | Impact | Mitigation | Effort |
|------|---------------|--------|-----------|--------|
| Running as root | ✗ YES (uid 0) | Full system compromise if app breached | Add non-root USER + chown app dirs | 10 min |
| No health check | ✗ MISSING | Zombie containers serve traffic; Kubernetes can't detect failure | Add /health endpoint + HEALTHCHECK | 15 min |
| No SIGTERM handler | ✗ NO | Tests killed abruptly; incomplete reports | Add process.on('SIGTERM') cleanup | 20 min |
| Credentials in .env | ✓ Excluded (.dockerignore) | If .env committed to git, leaked forever | Verify .gitignore; use external secrets | 30 min |
| Unversioned base image | ✗ Uses tag (v1.58.2-noble) | Non-deterministic builds; security scanning fails | Pin to SHA256 digest | 10 min |
| No resource limits | ✗ MISSING | Memory spike kills sibling containers | Set memory/CPU limits in compose | 5 min |
| No TLS/HTTPS | ✗ HTTP only (port 3000) | Credentials/reports in plaintext on network | Enable HTTPS with TLS cert + reverse proxy | 30 min |
| No API authentication | ✗ OPEN (no auth middleware) | Anyone can start tests, download reports | Add bearer token validation or IP whitelist | 30 min |

### High Risks (Should Fix Before Production)

| Risk | Mitigation | Effort |
|------|-----------|--------|
| No graceful shutdown | Add dumb-init + SIGTERM handler | 20 min |
| Logging captures credentials | Sanitize logs on stdout/stderr | 30 min |
| No rate limiting | Add express-rate-limit middleware | 20 min |
| Secrets in container env | Use external secret manager (GCP Secret Manager) | 1 hour |
| No CORS restriction | Restrict CORS to trusted origins | 10 min |
| No audit logging | Log all API calls (who, what, when) | 1 hour |
| Process orphaning | Kill child processes on SIGTERM | 20 min |
| Large attack surface (yarn unused) | Remove yarn from base image or document use | 0 (accept as-is) |

### Recommended Security Hardening

```dockerfile
# 1. Non-root user (add to Dockerfile)
RUN groupadd -r nodeapp && useradd -r -g nodeapp nodeapp
RUN chown -R nodeapp:nodeapp /app /ms-playwright
USER nodeapp

# 2. Health check endpoint (add to server code)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

# 3. SIGTERM handler (add to server code)
process.on('SIGTERM', () => {
  console.log('[Server] Graceful shutdown initiated');
  // ... cleanup logic
  process.exit(0);
});

# 4. TLS reverse proxy (nginx in front)
server {
  listen 443 ssl http2;
  ssl_certificate /etc/ssl/certs/agile-writer.crt;
  ssl_certificate_key /etc/ssl/private/agile-writer.key;
  proxy_pass http://localhost:3000;
}

# 5. API authentication (express middleware)
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || token !== process.env.API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

---

## 10. MONITORING REQUIREMENTS

### Metrics (Real-Time)

```yaml
Application Metrics:
  - CPU Usage:              Per container, alert at >75%
  - Memory Usage:           Per container, alert at >80%
  - Memory Growth Rate:     Alert if >100 MB/minute (leak detector)
  - Disk Usage:             /app/sessions alert at >80%, /raw_qa_files at >85%
  - Network I/O:            Alert if >100 Mbps sustained
  - Test Count:             Running tests / queued tests
  - Test Success Rate:      % passing / % failing
  - Test Duration:          P50, P95, P99 (trending)
  - API Latency:            /run-test, /download-report, /api/accuracy/score
  - Errors:                 Exception count, error rate

Container Metrics:
  - CPU %:                  Per container
  - Memory %:               Per container
  - Restart Count:          Alert if >3 restarts in 1 hour
  - Uptime:                 Alert on restart
  - I/O Read/Write:         Bytes per second

Host Metrics:
  - Disk Free:              Alert if <20% free space
  - Network Connectivity:   Alert if unreachable
  - Load Average:           Alert if >CPU count
  - File Descriptor Usage:  Alert if >80%
```

### Logs (Aggregation Required)

```yaml
Log Levels:
  - ERROR:   Immediate alert (Slack/PagerDuty)
  - WARN:    Summary alert (daily)
  - INFO:    Informational (archived)
  - DEBUG:   Development only

Log Destinations:
  - Container stdout/stderr:    Captured by Docker daemon
  - Docker json-file driver:    Local /var/lib/docker/containers/...json-log.log
  - Cloud Logging:              Google Cloud Logging (centralized)
  - Audit Trail:                Separate log for API calls (compliance)

Critical Log Events:
  - Test execution start:       INFO level, include sessionId
  - Test execution complete:    INFO level, include duration + pass/fail
  - Report generation failure:  ERROR level, immediate alert
  - Out of memory (OOMKilled):  ERROR level, immediate alert + auto-restart
  - Unauthorized API access:    WARN level, track attempts
  - File system errors:         ERROR level, immediate alert
```

### Alerting Policy

```yaml
Severity Levels:

P0 (Critical, Page Oncall Immediately):
  - Container OOMKilled or repeated restarts
  - Disk full (no space for reports)
  - S3/GCS backup unreachable
  - API authentication bypass attempt
  - All tests failing (100% failure rate)

P1 (High, Alert within 15 minutes):
  - Memory usage >85%
  - Disk usage >90%
  - Test success rate <80%
  - API latency >5 seconds (p95)
  - Backup failure (3 consecutive)

P2 (Medium, Daily summary):
  - Memory growth >500 MB/hour
  - Slow test (>45 minutes)
  - API latency >2 seconds (p95)
  - Low disk space (<30%)
  - Backup latency >20 minutes

P3 (Low, Weekly summary):
  - Test count trending up/down
  - Storage growth tracking
  - Accuracy scoring performance

Alert Channels:
  - P0: PagerDuty (immediate page)
  - P1: Slack #oncall
  - P2: Slack #devops (summary)
  - P3: Email weekly report
```

### Dashboard (Grafana/Data Studio)

```
Dashboard 1: Real-Time Operations
  - CPU/Memory utilization (per container)
  - Disk usage (stacked bar)
  - Active tests count
  - Test success rate (gauge)
  - API latency percentiles (graph)

Dashboard 2: Test Analytics
  - Tests completed today/week/month
  - Test duration distribution (histogram)
  - Accuracy scoring success rate
  - Report generation duration

Dashboard 3: Storage & Backup
  - /app/sessions disk usage + growth rate
  - /app/raw_qa_files size
  - Backup success rate (% backed up)
  - S3 sync lag (latest backup time vs now)

Dashboard 4: Reliability
  - Container restart count
  - Error rate (errors/total requests)
  - Health check pass rate
  - Database connectivity (if applicable)
```

### Implementation (GCP Stack Monitoring)

```bash
# Deploy Cloud Monitoring agent
gcloud compute instances create agile-writer-prod \
  --enable-display-device \
  --scopes compute-rw,logging-write,monitoring-write,service-management,service-control

# Create custom metrics
gcloud monitoring metrics-descriptors create \
  custom.googleapis.com/agile_writer/test_count \
  --metric-kind GAUGE \
  --value-type INT64

# Create alert policies
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Test Runner OOMKilled" \
  --condition-display-name="Container restarts >3 in 1 hour"
```

---

## 11. DISASTER RECOVERY REQUIREMENTS

### RTO/RPO Targets

```yaml
Test Reports (/app/sessions):
  - RTO (Recovery Time Objective):  15 minutes
  - RPO (Recovery Point Objective): 15 minutes (backup every 15 min)
  - Backup Frequency:               Every 15 minutes to GCS
  - Restore Method:                 gsutil sync from GCS

Accuracy Reports (/app/reports/accuracy):
  - RTO:                            30 minutes
  - RPO:                            1 hour (daily backup)
  - Backup Frequency:               Daily (2 AM UTC)
  - Restore Method:                 Restore from daily archive

Authentication (/app/playwright/.auth):
  - RTO:                            N/A (pre-generated, not backed up per se)
  - RPO:                            30+ days (token lifetime)
  - Backup Frequency:               Store in GCS (versioning enabled)
  - Restore Method:                 Restore from git or GCS backup
```

### Backup-to-Recovery Flow

```
Scenario 1: Container Storage Lost
  1. Container crashes, /app/sessions unmounted
  2. Alert: "Backup sync stalled for >20 min"
  3. Restore window: 15 minutes
  4. Action: gsutil -m sync s3://agile-writer-backups/sessions /mnt/storage/sessions
  5. Restart container
  6. Verify: curl http://localhost:3000/health
  7. Data loss: <15 minutes (since last backup)

Scenario 2: Host Node Failure (GKE)
  1. Node dies → Kubernetes auto-restarts pod on new node
  2. New node mounts same GCS buckets (Persistent Volumes)
  3. No data loss (storage persisted in GCS)
  4. RTO: <2 minutes (pod restart)

Scenario 3: Database/Storage Corruption
  1. Detect: Backup integrity check fails
  2. Isolate: Disable write access to affected storage
  3. Restore: Restore from point-in-time backup (24 hours old)
  4. Verify: Run test on restored data, verify reports intact
  5. Restore time: 4 hours
  6. Data loss: <24 hours (last daily backup)

Scenario 4: Ransomware/Malicious Deletion
  1. Detect: File count anomaly or manual discovery
  2. Isolate: Stop container, revoke API keys
  3. Restore: Restore from offsite backup (weekly archive in different region)
  4. Restore time: 4–24 hours (retrieval + restore)
  5. Data loss: <7 days (last weekly backup)
```

### Disaster Recovery Testing (Monthly)

```bash
#!/bin/bash
# dr_test_monthly.sh - Run monthly on first Friday

set -e

echo "[DR Test] Starting monthly disaster recovery test..."

# Test 1: Backup restoration
echo "[DR Test] 1. Testing backup restoration..."
TEST_DIR=$(mktemp -d)
gsutil -m cp gs://agile-writer-backups/sessions/test-sample-2026-06-22* "$TEST_DIR/"
if [ $(find "$TEST_DIR" -name "*.docx" | wc -l) -gt 0 ]; then
  echo "✓ Backup restore successful"
else
  echo "✗ Backup restore FAILED"
  exit 1
fi

# Test 2: Container restart + health check
echo "[DR Test] 2. Testing container restart..."
docker restart agile-writer-test-runner-1
sleep 10
if curl -f http://localhost:3000/health > /dev/null; then
  echo "✓ Health check passed"
else
  echo "✗ Health check FAILED"
  exit 1
fi

# Test 3: Report download after restore
echo "[DR Test] 3. Testing report download..."
SESSION_ID=$(ls -t /mnt/storage/agile-writer/sessions | head -1)
if curl -f "http://localhost:3000/download-report?sessionId=$SESSION_ID" > /tmp/test_report.docx; then
  echo "✓ Report download successful ($(du -h /tmp/test_report.docx | cut -f1))"
else
  echo "✗ Report download FAILED"
  exit 1
fi

# Test 4: Backup integrity check
echo "[DR Test] 4. Checking backup integrity..."
BACKUP_COUNT=$(gsutil ls -r gs://agile-writer-backups/sessions/ | wc -l)
echo "✓ Backups found: $BACKUP_COUNT files"

# Log results
echo "[DR Test] Monthly DR test completed successfully"
echo "Results logged to /var/log/agile-writer-dr-test-$(date +%Y-%m-%d).log"
```

---

## 12. RECOMMENDED PRODUCTION DEPLOYMENT TOPOLOGY

### Architecture Option A: Single-Region, Single-Instance (GCP VM)

```
┌─────────────────────────────────────────────────────┐
│  GCP Project: agile-writer-prod                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ GCP Zone: us-central1-a                      │  │
│  │                                              │  │
│  │  ┌───────────────────────────────────────┐  │  │
│  │  │ VM: n2-standard-4                     │  │  │
│  │  │ vCPU: 4  |  Memory: 16 GB             │  │  │
│  │  │                                       │  │  │
│  │  │  ┌─────────────────────────────────┐ │  │  │
│  │  │  │ Docker Container               │ │  │  │
│  │  │  │ agile-writer-test-runner      │ │  │  │
│  │  │  │                               │ │  │  │
│  │  │  │ CPU: 2 limit / 1.5 reserved  │ │  │  │
│  │  │  │ Memory: 3G limit / 2.5 reserved │  │  │
│  │  │  └─────────────────────────────────┘ │  │  │
│  │  │                                       │  │  │
│  │  │  ┌─────────────────────────────────┐ │  │  │
│  │  │  │ Storage (Local SSD)             │ │  │  │
│  │  │  │ /mnt/storage/ (100 GB)          │ │  │  │
│  │  │  │ ├─ sessions/ (50 GB)            │ │  │  │
│  │  │  │ ├─ reports/ (20 GB)             │ │  │  │
│  │  │  │ └─ raw_qa_files/ (30 GB)        │ │  │  │
│  │  │  └─────────────────────────────────┘ │  │  │
│  │  └───────────────────────────────────────┘  │  │
│  │                                              │  │
│  │  ┌───────────────────────────────────────┐  │  │
│  │  │ GCS Bucket: agile-writer-backups    │  │  │
│  │  │ (Backup every 15 min via Cron)      │  │  │
│  │  └───────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Cloud Monitoring & Logging                   │  │
│  │ ├─ CPU/Memory metrics                        │  │
│  │ ├─ Disk usage alerts                         │  │
│  │ └─ Log aggregation (Cloud Logging)           │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Cloud Identity & Access Management (IAM)     │  │
│  │ ├─ Service Account for VM                    │  │
│  │ └─ GCS read/write permissions                │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

Cost: ~$2,300/year
Suitable For: Dev/QA, small production deployments
Limitation: Single point of failure, no HA
```

### Architecture Option B: Multi-Container Horizontal Scaling (GCP VM)

```
┌──────────────────────────────────────────────────────────┐
│ GCP VM: n2-standard-8 (8 vCPU, 32 GB)                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Docker Compose / Docker Swarm                      │ │
│  │                                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ Container 1  │  │ Container 2  │              │ │
│  │  │ CPU: 2/1.5   │  │ CPU: 2/1.5   │              │ │
│  │  │ Memory: 3/2.5│  │ Memory: 3/2.5│              │ │
│  │  │              │  │              │              │ │
│  │  │ Port 3001    │  │ Port 3002    │              │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  │                                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ Container 3  │  │ nginx-lb     │              │ │
│  │  │ CPU: 2/1.5   │  │ (load balance)│             │ │
│  │  │ Memory: 3/2.5│  │ Port 80, 443 │              │ │
│  │  │              │  │              │              │ │
│  │  │ Port 3003    │  └──────────────┘              │ │
│  │  └──────────────┘                                │ │
│  │                                                    │ │
│  │  ┌────────────────────────────────────────────┐ │ │
│  │  │ Shared Storage (NFS Mount)                 │ │ │
│  │  │ /mnt/storage/agile-writer/                 │ │ │
│  │  │ ├─ sessions/ (RW by all containers)        │ │ │
│  │  │ ├─ reports/  (RW by all containers)        │ │ │
│  │  │ └─ raw_qa_files/ (RW by all containers)    │ │ │
│  │  └────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Local SSD (100 GB)                                 │ │
│  │ └─ Container image cache                           │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘

   ├─ GCS Backup Bucket (15-min sync)
   ├─ Cloud Monitoring (metrics + alerts)
   └─ Cloud Logging (log aggregation)

Cost: ~$3,500/year
Suitable For: Production (small-medium workload)
Benefit: 3 parallel tests, load balancing
Limitation: No cross-region HA, single VM single point of failure
```

### Architecture Option C: Kubernetes (GKE) High Availability

```
┌────────────────────────────────────────────────────────────────┐
│ GCP Project: agile-writer-prod                                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ GKE Cluster: agile-writer-cluster (3 nodes)             │  │
│  │                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │ Node 1       │  │ Node 2       │  │ Node 3       │  │  │
│  │  │ n2-std-4     │  │ n2-std-4     │  │ n2-std-4     │  │  │
│  │  │              │  │              │  │              │  │  │
│  │  │  Pod 1.1     │  │  Pod 2.1     │  │  Pod 3.1     │  │  │
│  │  │  runner      │  │  runner      │  │  runner      │  │  │
│  │  │              │  │              │  │              │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │ PVC 1        │  │ PVC 2        │  │ PVC 3        │  │  │
│  │  │ sessions     │  │ sessions     │  │ sessions     │  │  │
│  │  │ (10 GB)      │  │ (10 GB)      │  │ (10 GB)      │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Persistent Volume (NFS Backend, 100 GB)         │  │  │
│  │  │ ├─ /storage/sessions (shared read-write)        │  │  │
│  │  │ ├─ /storage/reports (shared read-write)         │  │  │
│  │  │ └─ /storage/raw_qa_files (shared read-write)    │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Ingress (HTTPS, TLS termination)                 │  │  │
│  │  │ ├─ Cloud Load Balancer                           │  │  │
│  │  │ ├─ TLS Certificate (Google-managed)              │  │  │
│  │  │ └─ DNS: agile-writer.example.com                │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ HPA (Horizontal Pod Autoscaler)                  │  │  │
│  │  │ Min: 3 pods  |  Max: 10 pods                     │  │  │
│  │  │ Trigger: CPU >70% for 2 min                      │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Monitoring                                       │  │  │
│  │  │ ├─ Cloud Monitoring (Prometheus metrics)         │  │  │
│  │  │ ├─ Cloud Logging (Stackdriver logs)              │  │  │
│  │  │ ├─ Pod disruption budgets (min 2 running)        │  │  │
│  │  │ └─ Network policies (ingress/egress rules)       │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cloud Storage (GCS) - Backup & Archive                   │  │
│  │ ├─ gs://agile-writer-backups (Standard, 30 days)         │  │
│  │ ├─ gs://agile-writer-archive (Nearline, 180 days)        │  │
│  │ └─ gs://agile-writer-compliance (Archive, 365+ days)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Identity & Access (Workload Identity)                    │  │
│  │ └─ Service Account with GCS permissions                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘

Cost: ~$4,500/year (compute + storage + networking)
Suitable For: Production (mission-critical, regulated)
Benefits: 
  - HA (3+ nodes)
  - Auto-scaling (dynamic workload)
  - Managed Kubernetes (Google-maintained)
  - Network policies & Pod disruption budgets
  - Built-in monitoring & logging
  - Automatic updates & patches
Limitation: More complex, higher operational overhead
```

### Deployment Flow (Recommended for All Topologies)

```
┌─────────────────────┐
│ Development (Local) │
│ docker-compose up   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Build & Test Docker Image               │
│ ├─ docker build -t agile-writer:X.Y.Z   │
│ ├─ Scan for vulnerabilities (Trivy)     │
│ ├─ Run integration tests in container   │
│ └─ Push to registry (gcr.io)            │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Deploy to Staging (QA Environment)      │
│ ├─ docker-compose -f compose.staging.yml│
│ ├─ Run full test suite (24 specs)       │
│ ├─ Validate accuracy scoring            │
│ └─ Verify backup/restore                │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Production Deployment                   │
│ ├─ Apply infrastructure (Terraform/gcloud)
│ ├─ Deploy via kubectl apply / compose   │
│ ├─ Health check: curl /health           │
│ ├─ Smoke test (run 1 test)              │
│ └─ Monitor metrics for 24 hours         │
└─────────────────────────────────────────┘
```

### Monitoring Stack (All Topologies)

```
┌──────────────────────────────────────────────┐
│ Container Logs                               │
│ ├─ Docker json-file driver (local)           │
│ └─ Cloud Logging (streamed)                  │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│ Metrics Collection                           │
│ ├─ Prometheus scrape: /metrics               │
│ ├─ Cloud Monitoring (GCP native)             │
│ └─ Custom metrics (test count, duration)     │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│ Alerting                                     │
│ ├─ Cloud Monitoring Alert Policies           │
│ ├─ Notifications: Slack, PagerDuty, Email    │
│ └─ Alert Rules (P0, P1, P2 severity)         │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│ Visualization                                │
│ ├─ Cloud Console Dashboard                   │
│ ├─ Grafana (optional, for Prometheus data)   │
│ └─ Cloud Logging Insights (log analysis)     │
└──────────────────────────────────────────────┘
```

---

# SECTION 4: UNKNOWN INPUTS NEEDED FROM BUSINESS OWNERS

## Critical Business Questions (Must Answer Before Production Deployment)

| # | Question | Impact | Depends On |
|---|----------|--------|-----------|
| 1 | **Test Volume**: How many tests/day in production? (50, 100, 500+) | Storage sizing, VM sizing, scaling strategy | Business goals |
| 2 | **Parallelization**: Will tests run in parallel (e.g., 2–5 concurrent)? | Memory, CPU, disk IOPS, container count | CI/CD pipeline design |
| 3 | **Test Schedule**: On-demand, scheduled daily, continuous queue? | Auto-scaling, deployment model | Business process |
| 4 | **Geographic Distribution**: Single region or multi-region? | HA architecture, backup strategy, latency SLA | Regulatory/ops requirement |
| 5 | **Retention Policy**: How long keep test reports (90 days, 1 year, 7 years)? | Storage cost, archival strategy | Legal/compliance requirement |
| 6 | **Regulatory Requirements**: FDA, GxP, ISO, SOC 2 compliance? | Audit logging, data retention, access controls | Industry/customer requirement |
| 7 | **RTO/RPO Targets**: Acceptable downtime & data loss? | Backup frequency, HA architecture, redundancy | Business SLA |
| 8 | **Target Environment**: SaaS, on-prem, or hybrid? What's the BASE_URL? | Network architecture, VPN/firewall rules, VPC peering | Infrastructure team |
| 9 | **Data Sensitivity**: Are test reports/logs sensitive/confidential? | Encryption, access controls, auditing | Security/legal team |
| 10 | **Budget Constraint**: Estimated annual cost cap for compute/storage? | VM sizing, auto-scaling policy, archival strategy | Finance |

---

# SECTION 5: IMPLEMENTATION ROADMAP

## Phase 1: Foundation (Weeks 1–2, Low Risk)

**Goal**: Production-ready Docker image + secure docker-compose configuration

```
Week 1:
  ✓ Add non-root USER to Dockerfile (10 min)
  ✓ Pin base image to SHA256 digest (10 min)
  ✓ Add /health endpoint (15 min)
  ✓ Add HEALTHCHECK instruction (10 min)
  ✓ Add SIGTERM handler (20 min)
  ✓ Test image locally (30 min)
  ✓ Push to container registry (5 min)
  
Week 2:
  ✓ Create production docker-compose.yml (30 min)
  ✓ Add resource limits (10 min)
  ✓ Add security context (user, cap_drop) (20 min)
  ✓ Pre-generate auth state (20 min)
  ✓ Test locally with volume mounts (30 min)
  ✓ Create pre-deployment checklist (30 min)

Deliverables:
  - Hardened Dockerfile (security + health checks)
  - docker-compose.production.yml
  - .env.example (for secrets)
  - Deployment guide
```

## Phase 2: Infrastructure (Weeks 3–4, Medium Risk)

**Goal**: GCP VM provisioned with production-ready storage + monitoring

```
Week 3:
  ✓ Create GCP project & service account (1 hour)
  ✓ Provision n2-standard-4 VM (30 min)
  ✓ Attach SSD persistent disk (100 GB) (30 min)
  ✓ Create GCS buckets (backup, archive, compliance) (30 min)
  ✓ Configure IAM permissions (1 hour)
  ✓ Install Docker + Docker Compose on VM (30 min)
  
Week 4:
  ✓ Deploy container via docker-compose (30 min)
  ✓ Verify health check endpoint (10 min)
  ✓ Test volume mounts (20 min)
  ✓ Configure Cloud Logging (30 min)
  ✓ Configure Cloud Monitoring (1 hour)
  ✓ Create monitoring dashboard (1 hour)
  ✓ Set up alert policies (30 min)

Deliverables:
  - GCP VM running test-runner (1 instance)
  - GCS buckets with lifecycle policies
  - Cloud Logging aggregation
  - Cloud Monitoring dashboard + alerts
```

## Phase 3: Backup & Disaster Recovery (Week 5, Medium Risk)

**Goal**: Automated backup every 15 minutes with restore verification

```
Week 5:
  ✓ Create backup script (backup_recent_reports.sh) (1 hour)
  ✓ Schedule backup cron job (15-min interval) (30 min)
  ✓ Create daily archive script (archive_daily_reports.sh) (1 hour)
  ✓ Schedule archive cron job (daily 2 AM) (30 min)
  ✓ Test restore flow (manual restore from GCS) (1 hour)
  ✓ Create disaster recovery runbook (1 hour)
  ✓ Test monthly DR exercise (2 hours)

Deliverables:
  - Automated backup scripts
  - Cron jobs configured
  - DR runbook (procedures for container loss, host failure, ransomware)
  - Backup integrity verification script
  - Monthly DR test results
```

## Phase 4: Hardening & Compliance (Week 6, Low Risk)

**Goal**: Security audit + compliance certification

```
Week 6:
  ✓ Enable TLS/HTTPS (reverse proxy + cert) (2 hours)
  ✓ Add API authentication (bearer token) (1 hour)
  ✓ Add CORS restrictions (trusted origins only) (30 min)
  ✓ Enable audit logging (API call logging) (1 hour)
  ✓ Run Trivy security scan (vulnerabilities) (30 min)
  ✓ Document security posture (30 min)
  ✓ Security review with team (1 hour)

Deliverables:
  - HTTPS endpoint with valid TLS certificate
  - API authentication token mechanism
  - Audit logs integration
  - Security scan report (CVE mitigation)
  - Security documentation
```

## Phase 5: Load Testing & Scaling (Week 7, Medium Risk)

**Goal**: Validate performance, determine scaling needs, identify bottlenecks

```
Week 7:
  ✓ Load test single container (simulate 2 concurrent tests) (4 hours)
  ✓ Monitor CPU/memory during load (observe peak usage) (1 hour)
  ✓ Identify memory leaks (heap snapshots if needed) (2 hours)
  ✓ Validate disk I/O performance (report generation speed) (1 hour)
  ✓ Test scaling to 2–3 containers (if needed) (2 hours)
  ✓ Document findings (1 hour)

Deliverables:
  - Load test report (throughput, latency, resource usage)
  - Performance baseline (CPU%, Memory%, Disk I/O)
  - Scaling recommendations (1 vs 2 vs 3 containers)
  - Bottleneck analysis (e.g., document generation CPU-bound)
```

## Phase 6: Production Validation (Week 8, High Risk)

**Goal**: Smoke tests, failover testing, user acceptance testing

```
Week 8:
  ✓ Smoke test suite (run 5 test specs) (2 hours)
  ✓ Validate report generation end-to-end (1 hour)
  ✓ Test accuracy scoring (1 hour)
  ✓ Failover test (stop container, verify restart) (30 min)
  ✓ Backup/restore test (simulate data loss) (1 hour)
  ✓ User acceptance testing (with stakeholders) (4 hours)
  ✓ Sign-off from security/ops/business teams (1 hour)

Deliverables:
  - Smoke test results (all passed)
  - Failover test results (successful restart)
  - UAT sign-off document
  - Production readiness checklist (signed)
```

---

# SECTION 6: SIGN-OFF & RECOMMENDATIONS

## Summary Table: Estimated Production Costs (Annual)

```
┌──────────────────────────────────────────────────────────────────────┐
│ DEPLOYMENT OPTION                                    │ Annual Cost    │
├────────────────────────────────────────────────────────────────────┤
│ A. Single VM (n2-standard-2, Dev/QA)                 │ $660           │
│ B. Single VM (n2-standard-4, Small Production)       │ $2,160         │
│ C. 2x VMs + NFS (n2-standard-4, Medium Production)   │ $4,320         │
│ D. GKE Cluster (3x n2-standard-4, High Availability) │ $4,680         │
│ E. GKE + Auto-scaling (3–10 nodes)                   │ $7,200–12,000  │
│                                                                        │
│ Storage (All Options):                                               │
│ ├─ Local SSD (100 GB, hot):                           +$1,200/year    │
│ ├─ GCS Standard (backup, 30 days):                    +$150/year      │
│ ├─ GCS Nearline (archive, 180 days):                  +$60/year       │
│ └─ GCS Archive (compliance, 365+ days):               +$15/year       │
│                                                                        │
│ Monitoring & Logging:                                                │
│ ├─ Cloud Monitoring (metrics):                        +$120/year      │
│ ├─ Cloud Logging (100 GB/month ingestion):            +$600/year      │
│ └─ Alert Policies & Dashboards:                       +$0 (included)  │
│                                                                        │
│ TOTAL (Option B + Storage + Monitoring):              ~$3,150/year    │
│ TOTAL (Option D + Storage + Monitoring):              ~$5,700/year    │
└────────────────────────────────────────────────────────────────────┘
```

## Recommended Path Forward

**For Small/Medium Production Deployments (100–300 tests/day)**:
```
✓ RECOMMENDED: Option B (Single n2-standard-4 VM)
  Cost: ~$3,150/year
  Timeline: 6–8 weeks to production
  Complexity: Low (single container, docker-compose)
  Scaling: Can upgrade to Option C/D if needed
```

**For Large/Enterprise Production Deployments (500+ tests/day, HA required)**:
```
✓ RECOMMENDED: Option D (GKE Cluster, 3 nodes)
  Cost: ~$5,700/year
  Timeline: 8–10 weeks to production
  Complexity: Medium (Kubernetes, managed infrastructure)
  Scaling: Auto-scales 3–10 nodes based on workload
```

---

## Final Checklist: Pre-Production Sign-Off

- [ ] **Dockerfile**: Non-root user, HEALTHCHECK, SIGTERM handler, pinned base image
- [ ] **docker-compose.yml**: Resource limits, security context, health checks, logging configured
- [ ] **Storage**: Volumes mounted, permissions verified, backup tested
- [ ] **Monitoring**: Cloud Logging enabled, alerts configured, dashboard created
- [ ] **Backup**: 15-min automated backup confirmed, restore tested, RTO/RPO verified
- [ ] **Security**: No root user, TLS/HTTPS enabled, API authentication added, audit logging
- [ ] **Disaster Recovery**: Monthly DR test passed, runbook documented, team trained
- [ ] **Business Questions**: All 10 critical questions answered by stakeholders
- [ ] **Cost Approval**: Annual budget confirmed with finance
- [ ] **Sign-Off**: Security, Operations, and Business teams sign off

---

**Report Generated**: 2026-06-22  
**Analyst**: Senior DevOps Architect  
**Next Review**: Post-deployment (Week 2 of production), then quarterly
