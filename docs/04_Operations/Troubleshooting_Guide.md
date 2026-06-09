Document Status: Canonical
Canonical Scope: Define operational troubleshooting, signal collection, and recovery guidance
Owner: Documentation Team
Related Legacy Docs: 
- docs/legacy/original_docs/AgileWriter_Automation_Handbook.md

Last Reviewed: 2026-05-25

Source Documents:
- Repository source tree
- onboarding review sessions

# Troubleshooting Guide

> **MANDATORY RULE:**
> Never retry before collecting signals.

## Troubleshooting Philosophy

Troubleshooting in the AgileWriter Automation Suite prioritizes rapid signal collection and deterministic recovery over root-cause implementation debugging. QA operators are expected to observe failures, collect context, execute known recovery paths, and escalate if issues persist.

**Confidence**: Observed

## Failure Classification

Failures are grouped by the first observable symptom rather than underlying cause.

* **Startup Failures**: The server or dashboard cannot be initialized.
* **Execution Failures**: A validation workflow stalls or errors during the run.
* **Environment Failures**: Missing or invalid configuration prevents workflows from succeeding.
* **Report Failures**: Aggregation scripts fail to produce expected artifacts.
* **Container Failures**: Docker lifecycle or volume mounting issues.

**Confidence**: Observed

## Startup Failures

Startup Failure
→ Observable Signal: service unavailable
→ First Validation Step: verify startup completed
→ Candidate Recovery Path: collect startup signals

**Confidence**: Observed

## Execution Failures

Workflow Stall
→ Observable Signal: observable activity stops
→ First Validation Step: verify expected waiting periods
→ Candidate Recovery Path: safely interrupt and collect signals

Execution Interruption
→ Observable Signal: execution stops abruptly
→ First Validation Step: verify workflow continuity
→ Candidate Recovery Path: collect signals and restart session

**Confidence**: Observed

## Environment Failures

Configuration Missing
→ Observable Signal: authentication unavailable
→ First Validation Step: verify environment configuration presence
→ Candidate Recovery Path: review environment guidance

Configuration Unexpected
→ Observable Signal: execution cannot proceed
→ First Validation Step: verify execution context
→ Candidate Recovery Path: review environment guidance

**Confidence**: Observed

## Report Failures

Missing Report
→ Observable Signal: no new document produced
→ First Validation Step: verify at least one execution completed successfully
→ Candidate Recovery Path: review report generation workflow

**Confidence**: Observed

## Containerization Issues

Docker Lifecycle Failure
→ Observable Signal: container exits prematurely or fails to start
→ First Validation Step: check `docker-compose logs`
→ Candidate Recovery Path: execute a full restart procedure (`docker-compose down -v` followed by `docker-compose up --build`)

Orphaned Volumes / State Corruption
→ Observable Signal: stale reports or old session data persist across fresh runs
→ First Validation Step: inspect mounted host directories
→ Candidate Recovery Path: manually clear local volume directories (`sessions/`, `reports/`)

Artifact Troubleshooting Locations
→ When troubleshooting generated artifacts or session states from a container, retrieve data from the local host directories mounted by Docker:
* **Session Traces**: Check local `sessions/`
* **Run Summaries**: Check local `reports/`
* **Raw DOCX Files**: Check local `reports/` (or designated validation output dir)

**Confidence**: Verified

## Recovery Playbooks

Standard Recovery Scenario
→ Signals: unexpected non-fatal workflow interruption
→ Validation: check recent repository updates
→ Candidate Recovery: review configuration and restart session

**Confidence**: Observed

## Signal Collection

When an issue occurs, collect the following operational captures:

Execution status
→ reproduce sequence

Visible output
→ compare outcomes

Workflow context
→ identify scope

**Confidence**: Observed

## Escalation Guidance

If a candidate recovery path fails to resolve the issue:

1. Compile the collected signals.
2. Note the failed recovery path attempted.
3. Escalate for backend investigation.

**Confidence**: Observed

## Known Limitations

Known limitations represent observed operational constraints and may evolve.

Long-running workflows
→ delayed feedback

Historical visibility
→ limited availability

Headed Browser Execution in Containers
→ Headed execution fails because no display server exists in the container.
→ Resolution: Set `PLAYWRIGHT_HEADLESS=true`. Do not classify this as a defect.

**Confidence**: Observed

## Historical Incident Notes

Canonical documentation defines the current recommended recovery paths.

Historical documentation preserves:
- prior recovery guidance
- historical operational practices
- migration context

---

Next:

[Report_Interpretation_Guide.md](../02_User_Guides/Report_Interpretation_Guide.md)
