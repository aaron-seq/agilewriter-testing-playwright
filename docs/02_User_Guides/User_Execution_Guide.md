Document Status: Canonical
Canonical Scope: Define end-user execution procedures and dashboard interactions
Owner: Documentation Team
Related Legacy Docs: 
- docs/legacy/original_docs/AgileWriter_Automation_Handbook.md

Last Reviewed: 2026-05-25

Source Documents:
- Dashboard UI observation
- onboarding review sessions

# User Execution Guide

> **MANDATORY RULE:**
> If execution fails:
> → stop
> → collect signals
> → check troubleshooting
> → retry

## User Personas

This guide is optimized for:
* **QA Engineers**: Primary executors evaluating system health and validating document generations.
* **Release Managers**: Personnel reviewing aggregated reporting artifacts.
* **Product Owners**: Stakeholders reviewing execution dashboards.

**Confidence**: Observed

## Execution Goals

Run validation
→ execution starts

Observe progress
→ status changes visible

Review outcomes
→ artifacts available

**Confidence**: Observed

## Dashboard Interaction Model

The execution interface provides observable interaction points:

* execution controls
* status feedback
* result visibility

**Confidence**: Observed

## Execution Signals

activity visible
→ execution active

output available
→ execution completed

**Confidence**: Observed

## Discovering and Running Health Scripts

Available health suites are discovered dynamically at runtime. The UI dashboard provides a populated dropdown, but the canonical CLI discovery mechanism is:

```bash
npx playwright test --project=health --list
```

Select validation scenario (via CLI or UI)
→ selected state visible

Start execution
→ execution activity visible

**Confidence**: Observed

## Interpreting Outcomes

Completed
→ workflow finishes

Interrupted
→ execution stops

Needs Review
→ unexpected output

**Confidence**: Observed

## Downloading Reports

Generated reports should be retrieved using the documented repository workflow.

**Confidence**: Observed

## Common User Mistakes

Closing execution session
→ execution interruption

Starting overlapping runs
→ unclear ownership of results

**Confidence**: Observed

## Execution Expectations

Long-running workflows
→ delayed completion

Waiting periods
→ limited visible activity

**Confidence**: Observed

## Escalation Guidance

If you encounter persistent failures after consulting the troubleshooting documentation:

Capture:
→ observable signals

Record:
→ workflow executed

Provide:
→ execution context

**Confidence**: Observed

## Historical User Notes

Canonical documentation defines the current recommended user workflows.

Historical documentation preserves:
- prior execution guidance
- migration context
- historical user workflows

---

Next:

[Troubleshooting_Guide.md](../04_Operations/Troubleshooting_Guide.md)
