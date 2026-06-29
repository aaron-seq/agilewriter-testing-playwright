# Backup & Disaster Recovery Strategy for Generated Files

## Executive Summary

Your application generates **three categories of critical files** that require different backup and recovery strategies based on their value, retention requirements, and compliance needs.

| Category | Files | Retention | RPO | RTO | Backup Target |
|----------|-------|-----------|-----|-----|----------------|
| **Test Reports** | `/app/sessions/*.docx` | 90 days | 1 hour | 4 hours | S3/Archive |
| **Accuracy Scoring** | `/app/reports/accuracy/*.xlsx` + `.json` | 180 days | 1 hour | 2 hours | S3/Compliance Storage |
| **Test Execution Logs** | `step-results.json` | 90 days | 1 hour | 8 hours | Cloud Logging |

---

## Generated Files Requiring Backup

### **1. Test Reports (`.docx` files)**

**Location**: `/app/sessions/<sessionId>/*.docx`

**What they contain**:
- Test execution summary: passed/failed steps
- Validation results with screenshots
- Tester name, environment, timestamp, app URL
- Step-by-step timeline with durations

**Business value**: **CRITICAL**
- Audit trail for test compliance
- Deliverable to stakeholders/regulators
- Proof of validation for clinical trials (if regulated)
- Cannot be regenerated if test data is deleted

**Characteristics**:
- Generated on-demand during test execution
- Filename: `<testname>_<YYYYMMDD_HHmm>_Report.docx`
- Size: 2–5 MB per report
- Auto-cleanup: **60 minutes after test completes** (server-side TTL)
- Volume: 50–100 reports/day (production, 2 parallel runners)

**Backup Strategy**:
```
CRITICAL WINDOW: 60 minutes from test completion
Must backup before session TTL cleanup
```

**Retention Policy**:
- **Active**: 90 days (local fast storage)
- **Archive**: 180+ days (cold storage for compliance/audit)
- **Purge**: After legal hold expires

**Backup Method**:
```bash
#!/bin/bash
# backup_test_reports.sh — runs every 15 minutes

SESSIONS_DIR="/storage/agile-writer/sessions"
S3_BUCKET="s3://agile-writer-backups/test-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Find all .docx files modified in the last 20 minutes
find "$SESSIONS_DIR" -name "*.docx" -mmin -20 -type f | while read report; do
  sessionId=$(basename $(dirname "$report"))
  
  # Upload to S3 with versioning
  aws s3 cp "$report" "$S3_BUCKET/$sessionId/" \
    --metadata "backed-up-at=$TIMESTAMP" \
    --storage-class STANDARD_IA
  
  if [ $? -eq 0 ]; then
    echo "[Backup] $report → S3 (session: $sessionId)"
  else
    echo "[ERROR] Failed to backup $report"
    # Alert monitoring system
  fi
done
```

**Disaster Recovery**:
- If `/app/sessions` is lost:
  1. Restore from S3 backup: `aws s3 sync s3://agile-writer-backups/test-reports /storage/agile-writer/sessions/`
  2. RTO: 15 minutes (S3 download)
  3. Data loss: ≤ 15 minutes (backup frequency)

---

### **2. Accuracy Scoring Reports (`.xlsx` + `.json`)**

**Location**: `/app/reports/accuracy/*.xlsx` and `/app/reports/accuracy/*.json`

**What they contain**:
- Comparison of expected vs. actual placeholder values
- Accuracy percentage per placeholder
- CSV rows with scoring results
- Timestamp of scoring run
- Reference file + raw QA file used for comparison

**Business value**: **HIGH**
- Evidence of accuracy validation
- Compliance/regulatory documentation
- Trending data for quality metrics
- Input for machine learning/model training (possibly)

**Characteristics**:
- Generated on-demand via `POST /api/accuracy/score`
- Filename: `accuracy-report-<ISO8601-timestamp>.xlsx` and `.json`
- Size: 500 KB – 2 MB per report (depends on row count)
- No auto-cleanup (persists indefinitely)
- Volume: 5–20 scoring runs/day

**Backup Strategy**:
```
Created on-demand, no TTL cleanup
Risk: Unlimited accumulation until storage fills
```

**Retention Policy**:
- **Active**: 180 days (local storage for quick access)
- **Archive**: 365+ days (cold storage for compliance/audit)
- **Purge**: Per data retention policy (e.g., after regulatory submission)

**Backup Method**:
```bash
#!/bin/bash
# backup_accuracy_reports.sh — runs daily at midnight

ACCURACY_DIR="/storage/agile-writer/reports/accuracy"
S3_BUCKET="s3://agile-writer-compliance/accuracy-reports"
ARCHIVE_DAYS=180

# Backup all accuracy reports to S3
aws s3 sync "$ACCURACY_DIR/" "$S3_BUCKET/" \
  --exclude "*" \
  --include "accuracy-report-*.xlsx" \
  --include "accuracy-report-*.json" \
  --storage-class GLACIER_IR  # For long-term compliance archival

# Delete local files older than 180 days
find "$ACCURACY_DIR" -name "accuracy-report-*" -mtime +$ARCHIVE_DAYS -delete

echo "[Backup] Accuracy reports synced to S3 Glacier"
```

**Disaster Recovery**:
- If `/app/reports/accuracy` is lost:
  1. List available reports: `aws s3 ls s3://agile-writer-compliance/accuracy-reports/`
  2. Restore specific date range: `aws s3 cp s3://agile-writer-compliance/accuracy-reports/accuracy-report-2026-06-*.xlsx /storage/agile-writer/reports/accuracy/`
  3. RTO: 30 minutes (restore + verification)
  4. Data loss: ≤ 24 hours (daily backup)

---

### **3. Test Execution Logs (`step-results.json`)**

**Location**: `/app/sessions/<sessionId>/step-results.json`

**What they contains**:
- Array of test step objects: `{ stepName, status, duration, timestamp, error, critical }`
- Pass/fail status per step
- Duration of each step (for performance trending)
- Error messages (sanitized)
- Validation details

**Business value**: **MEDIUM**
- Debugging failed tests
- Performance trending
- Audit trail for regulatory compliance
- Input for test analytics

**Characteristics**:
- Generated during test execution by Playwright/test code
- Filename: `step-results.json` (one per session)
- Size: 50–200 KB per session
- Auto-cleanup: **60 minutes after test completes** (session TTL)
- Volume: 50–100 logs/day

**Backup Strategy**:
```
CRITICAL WINDOW: 60 minutes from test completion
Must backup before session TTL cleanup
```

**Retention Policy**:
- **Active**: 90 days (local access via API)
- **Archive**: 180+ days (cloud logging for compliance)
- **Purge**: After regulatory holds expire

**Backup Method** (via container logs):
```bash
#!/bin/bash
# backup_test_logs.sh — runs every 15 minutes

SESSIONS_DIR="/storage/agile-writer/sessions"
LOGS_BUCKET="s3://agile-writer-logs/test-execution"

# Find step-results.json files modified in the last 20 minutes
find "$SESSIONS_DIR" -name "step-results.json" -mmin -20 -type f | while read log; do
  sessionId=$(basename $(dirname "$log"))
  
  # Upload to S3
  aws s3 cp "$log" "$LOGS_BUCKET/$sessionId/" \
    --metadata "session-id=$sessionId,backed-up=$(date -I)"
  
  if [ $? -eq 0 ]; then
    echo "[Backup] $log → S3 (session: $sessionId)"
  fi
done
```

**Disaster Recovery**:
- If step results are lost:
  1. Restore from S3: `aws s3 cp s3://agile-writer-logs/test-execution/<sessionId>/step-results.json /storage/agile-writer/sessions/<sessionId>/`
  2. Re-download report: `curl http://localhost:3000/download-report?sessionId=<sessionId>`
  3. RTO: 10 minutes (restore + regenerate report)
  4. Data loss: ≤ 15 minutes

---

## Files NOT Requiring Backup

### **❌ `/app/test-results/` (Playwright HTML Reports)**
- **Why skip**: Redundant with `step-results.json` + session context
- **Size**: 5–20 MB per test (traces, screenshots)
- **Lifetime**: Ephemeral (useful for debugging)
- **Recovery**: Can be regenerated by re-running test (if needed)
- **Recommendation**: Exclude from backups; clean up after 7 days via cron

### **❌ `/app/playwright-report/` (Playwright Trace Files)**
- **Why skip**: Large (20–100 MB/test); ephemeral debugging artifacts
- **Recovery**: Can be regenerated by re-running test in headed mode
- **Recommendation**: Don't mount in production; use only for development

### **❌ `/app/sessions/runtime-config.json`**
- **Why skip**: Temporary file; deleted after test completes (see server code)
- **Recreatable**: Can be reconstructed from test parameters
- **Lifetime**: ~1 hour (session TTL)
- **Recommendation**: Not backed up

### **❌ `/app/node_modules/`**
- **Why skip**: In Docker image; reproducible via `npm ci`
- **Size**: 115 MB
- **Recommendation**: Never mount as volume; exclude from backups

---

## Backup Architecture & RTO/RPO Targets

### **Backup Tiers**

```
Tier 1: Local Volume (Hot Storage)
├─ Location: /storage/agile-writer/sessions, /storage/agile-writer/reports
├─ Retention: 90 days (live, searchable)
├─ RPO: Real-time (all data present)
├─ Purpose: Fast API access, user downloads
└─ Cost: ~$5/GB/month (NVMe SSD)

Tier 2: S3 Standard-IA (Warm Archive)
├─ Location: s3://agile-writer-backups/test-reports
├─ Retention: 180 days
├─ RPO: 15 minutes (backup frequency)
├─ RTO: 15–30 minutes (S3 download)
├─ Purpose: Disaster recovery, compliance holds
└─ Cost: ~$0.03/GB/month (S3 IA)

Tier 3: S3 Glacier IR (Cold Archive)
├─ Location: s3://agile-writer-compliance/accuracy-reports
├─ Retention: 365+ days
├─ RPO: 24 hours (daily backup)
├─ RTO: 4–24 hours (retrieval time)
├─ Purpose: Long-term compliance, regulatory audit
└─ Cost: ~$0.004/GB/month (S3 Glacier)

Tier 4: CloudWatch/Datadog Logs (Operational Logs)
├─ Location: AWS CloudWatch / Datadog
├─ Retention: 90 days (managed service)
├─ RPO: Real-time (log streaming)
├─ RTO: Instant (searchable)
├─ Purpose: Debugging, alerting, monitoring
└─ Cost: ~$0.50/GB ingested
```

### **Backup Timing & Frequency**

```
Event              Backup Window    Frequency    Criticality
─────────────────────────────────────────────────────────────
Test completes     0–15 min        Every 15min   CRITICAL
Session TTL        55–60 min       Every 5min    CRITICAL
Accuracy scoring   On-demand       Every 1hr     HIGH
Day-end            23:59           Daily        HIGH
Month-end          EOM             Monthly      COMPLIANCE
```

---

## Disaster Recovery Procedures

### **Scenario 1: Container Crash → Data Loss**

**Situation**: Container crashes; `/app/sessions` volume unmounts; session data lost.

**Recovery Time**: 15–30 minutes
**Data Loss**: Last 15 minutes of reports

**Steps**:
```bash
# 1. Identify lost session
aws s3 ls s3://agile-writer-backups/test-reports/ | sort | tail -10

# 2. Restore specific session
SESSION_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
aws s3 sync \
  s3://agile-writer-backups/test-reports/$SESSION_ID/ \
  /storage/agile-writer/sessions/$SESSION_ID/

# 3. Restart container
docker-compose restart test-runner

# 4. Verify report available
curl http://localhost:3000/download-report?sessionId=$SESSION_ID

# 5. Notify stakeholders of data loss window
```

---

### **Scenario 2: Host Storage Failure → Full Data Loss**

**Situation**: NAS/SSD fails; all local volumes lost; no local backup.

**Recovery Time**: 2–4 hours
**Data Loss**: ≤ 15 minutes (backup interval)

**Steps**:
```bash
# 1. Provision new storage
# Create new /storage/agile-writer with sufficient capacity

# 2. Restore all S3 backups
mkdir -p /storage/agile-writer/sessions
mkdir -p /storage/agile-writer/reports/accuracy

aws s3 sync s3://agile-writer-backups/test-reports/ \
  /storage/agile-writer/sessions/ \
  --exclude "*.tmp"

aws s3 sync s3://agile-writer-compliance/accuracy-reports/ \
  /storage/agile-writer/reports/accuracy/

# 3. Restore auth state
mkdir -p /storage/agile-writer/playwright/.auth
aws s3 cp s3://agile-writer-backups/playwright-auth/user.json \
  /storage/agile-writer/playwright/.auth/

# 4. Restart all containers
docker-compose restart

# 5. Verify data integrity
# Check file counts match
ls /storage/agile-writer/sessions | wc -l
aws s3 ls s3://agile-writer-backups/test-reports --recursive | wc -l

# 6. Alert oncall: "Storage recovered from S3"
```

---

### **Scenario 3: Ransomware / Malicious Deletion**

**Situation**: Attacker or malware deletes all files in `/app/reports/accuracy`.

**Recovery Time**: 4 hours
**Data Loss**: ≤ 24 hours (daily backup + versioning)

**Steps**:
```bash
# 1. IMMEDIATE: Isolate affected container
docker stop agilewritertest-test-runner

# 2. Check S3 versioning (should be enabled)
aws s3api list-object-versions \
  --bucket agile-writer-compliance \
  --prefix accuracy-reports/ \
  | jq '.Versions[] | select(.IsLatest==false)'

# 3. Restore from point-in-time backup
RESTORE_TIMESTAMP=$(date -d "1 day ago" -u +%Y-%m-%dT%H:%M:%S)

aws s3 sync \
  s3://agile-writer-compliance/accuracy-reports/ \
  /storage/agile-writer/reports/accuracy/ \
  --exclude "*" \
  --include "accuracy-report-*" \
  --no-progress

# 4. Verify checksums against backup manifest
# (compare sha256 hashes with pre-attack snapshots)

# 5. Re-enable container
docker start agilewritertest-test-runner

# 6. Forensics
# - Review Docker audit logs
# - Check IAM permissions
# - Enable S3 Object Lock (prevent deletion)
```

**Prevention**:
```bash
# Enable S3 versioning
aws s3api put-bucket-versioning \
  --bucket agile-writer-compliance \
  --versioning-configuration Status=Enabled

# Enable Object Lock on sensitive buckets (if using S3 Glacier)
# Configure MFA Delete to prevent accidental deletion
# Restrict IAM permissions on delete/destroy operations
```

---

## Implementation: Backup Scripts

### **Script 1: Continuous Backup (every 15 minutes)**

```bash
#!/bin/bash
# /usr/local/bin/backup_test_reports.sh

set -e

SESSIONS_DIR="/storage/agile-writer/sessions"
S3_BUCKET="s3://agile-writer-backups/test-reports"
LOG_FILE="/var/log/agile-writer-backup.log"
ALERT_EMAIL="oncall@example.com"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Verify S3 connectivity
aws s3 ls "$S3_BUCKET" > /dev/null 2>&1 || {
  log "ERROR: Cannot reach S3 bucket $S3_BUCKET"
  echo "S3 backup failed at $(date)" | mail -s "Backup Alert: S3 Unreachable" "$ALERT_EMAIL"
  exit 1
}

# Find recent .docx files (modified in last 20 minutes)
find "$SESSIONS_DIR" -name "*.docx" -mmin -20 -type f 2>/dev/null | while read report; do
  sessionId=$(basename $(dirname "$report"))
  
  # Upload to S3
  aws s3 cp "$report" "$S3_BUCKET/$sessionId/" \
    --metadata "backed-up=$(date -I),session-id=$sessionId" \
    --storage-class STANDARD_IA \
    --no-progress \
    2>&1 | tee -a "$LOG_FILE" || {
      log "ERROR: Failed to backup $report"
      echo "Backup failed for $report" | mail -s "Backup Alert: Upload Failed" "$ALERT_EMAIL"
    }
  
  log "Backed up: $report → $S3_BUCKET/$sessionId/"
done

# Cleanup old local sessions (older than 90 days but keep recent ones)
# Only delete if backup succeeded
find "$SESSIONS_DIR" -maxdepth 1 -type d -mtime +90 -exec rm -rf {} \; 2>/dev/null || true

log "Backup cycle complete"
```

**Cron job**:
```bash
# Run every 15 minutes
*/15 * * * * /usr/local/bin/backup_test_reports.sh

# Run daily cleanup at 2 AM
0 2 * * * /usr/local/bin/cleanup_old_reports.sh
```

---

### **Script 2: Daily Compliance Archive**

```bash
#!/bin/bash
# /usr/local/bin/archive_accuracy_reports.sh

set -e

ACCURACY_DIR="/storage/agile-writer/reports/accuracy"
S3_BUCKET="s3://agile-writer-compliance/accuracy-reports"
ARCHIVE_DAYS=180
LOG_FILE="/var/log/agile-writer-archive.log"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Sync all accuracy reports to Glacier IR (long-term compliance)
aws s3 sync "$ACCURACY_DIR/" "$S3_BUCKET/" \
  --exclude "*" \
  --include "accuracy-report-*.xlsx" \
  --include "accuracy-report-*.json" \
  --storage-class GLACIER_IR \
  --metadata "archived=$(date -I)" \
  2>&1 | tee -a "$LOG_FILE" || {
    log "ERROR: S3 sync failed"
    exit 1
  }

log "Synced accuracy reports to S3 Glacier"

# Delete local copies older than ARCHIVE_DAYS
deleted_count=0
find "$ACCURACY_DIR" -name "accuracy-report-*" -mtime +$ARCHIVE_DAYS | while read file; do
  rm -f "$file"
  log "Deleted: $file"
  ((deleted_count++))
done

log "Cleanup complete: Deleted $deleted_count files"
```

**Cron job**:
```bash
# Run daily at 2 AM
0 2 * * * /usr/local/bin/archive_accuracy_reports.sh
```

---

### **Script 3: Backup Integrity Verification**

```bash
#!/bin/bash
# /usr/local/bin/verify_backups.sh

set -e

S3_BUCKET="s3://agile-writer-backups/test-reports"
LOCAL_DIR="/storage/agile-writer/sessions"
REPORT_FILE="/var/log/backup-verification-$(date +%Y%m%d).txt"

echo "=== Backup Verification Report ===" > "$REPORT_FILE"
echo "Date: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Count local files
local_count=$(find "$LOCAL_DIR" -name "*.docx" 2>/dev/null | wc -l)
echo "Local .docx files: $local_count" >> "$REPORT_FILE"

# Count S3 files
s3_count=$(aws s3 ls "$S3_BUCKET" --recursive --include "*.docx" 2>/dev/null | wc -l)
echo "S3 .docx files: $s3_count" >> "$REPORT_FILE"

# Check for missing files (in local but not in S3)
echo "" >> "$REPORT_FILE"
echo "=== Verification Checks ===" >> "$REPORT_FILE"

if [ $s3_count -lt $((local_count - 5)) ]; then
  echo "WARNING: S3 has fewer files than local. Possible sync failure." >> "$REPORT_FILE"
  mail -s "Backup Verification: Sync Mismatch" oncall@example.com < "$REPORT_FILE"
fi

# Check S3 versioning is enabled
versioning=$(aws s3api get-bucket-versioning --bucket agile-writer-backups | jq -r '.Status')
if [ "$versioning" != "Enabled" ]; then
  echo "WARNING: S3 versioning not enabled!" >> "$REPORT_FILE"
fi

echo "Verification complete" >> "$REPORT_FILE"
cat "$REPORT_FILE"
```

---

## Retention Policy & Compliance

### **Legal Hold & Compliance**

```yaml
Test Reports:
  Retention: 90 days (active use)
  Archive: 180 days (legal hold)
  Purge: After investigation/audit completion
  
  Compliance Drivers:
    - FDA 21 CFR Part 11 (if regulated)
    - Clinical trial data retention (2–7 years)
    - Internal audit requirements

Accuracy Scoring:
  Retention: 180 days (active compliance)
  Archive: 365+ days (regulatory audit)
  Purge: Per data retention policy
  
  Use Cases:
    - Regulatory submissions
    - Quality trending
    - Vendor audits
    - Incident investigations

Test Logs:
  Retention: 90 days (debugging)
  Archive: 180 days (compliance)
  Purge: After legal hold expires
  
  Use Cases:
    - Debugging failed tests
    - Performance trending
    - Security auditing
```

---

## Monitoring & Alerting

### **Backup Health Dashboard**

```yaml
Metrics to Monitor:

1. Backup Frequency
   - Last backup timestamp (alert if >20 min old)
   - Backup success rate (alert if <95%)
   - Target: Every 15 minutes

2. Data Completeness
   - Files backed up vs. files expected
   - S3 vs. local file count mismatch
   - Target: 100% consistency

3. Storage Capacity
   - Local disk usage (alert if >80%)
   - S3 bucket size (alert if >500 GB)
   - Target: Auto-archive when >70%

4. Recovery Readiness
   - S3 accessibility (ping every hour)
   - Backup manifest integrity
   - Target: 99.9% availability

Alerting:

- Backup failure: Page oncall immediately
- Sync mismatch: Alert within 1 hour
- Storage capacity warning: Alert at 70%, block new uploads at 90%
- S3 unreachable: Page immediately (blocks recovery)
```

**CloudWatch Alarms**:
```python
import boto3

cloudwatch = boto3.client('cloudwatch')

# Alert if no S3 uploads in 20 minutes
cloudwatch.put_metric_alarm(
    AlarmName='agile-writer-backup-stalled',
    MetricName='NumberOfBackupObjects',
    Namespace='AgileWriter/Backup',
    Statistic='Sum',
    Period=1200,  # 20 minutes
    EvaluationPeriods=1,
    Threshold=0,
    ComparisonOperator='LessThanOrEqualTo',
    AlarmActions=['arn:aws:sns:us-east-1:123456789:OnCallPager']
)
```

---

## Summary: Backup Checklist

- [ ] Enable S3 versioning on all backup buckets
- [ ] Set up S3 Object Lock or MFA Delete (prevent ransomware)
- [ ] Configure S3 lifecycle policies (Standard → IA → Glacier)
- [ ] Deploy backup scripts (15-min, daily, weekly cycles)
- [ ] Set up backup monitoring & alerting
- [ ] Document RTO/RPO targets and SLAs
- [ ] Test disaster recovery monthly (restore from S3)
- [ ] Audit backup integrity weekly
- [ ] Review compliance retention policies with legal
- [ ] Set up CloudWatch/Datadog dashboards for backup health

**Estimated Costs (Annual)**:
```
Local Storage (90 days): ~$100/month = $1,200/year
S3 Standard-IA (180 days): ~$50/month = $600/year
S3 Glacier IR (365+ days): ~$20/month = $240/year
Total: ~$2,040/year for full backup + disaster recovery
```

**Key Targets**:
- RPO (acceptable data loss): ≤ 15 minutes
- RTO (acceptable downtime): ≤ 30 minutes
- Backup success rate: ≥ 99%
- Recovery test frequency: Monthly
