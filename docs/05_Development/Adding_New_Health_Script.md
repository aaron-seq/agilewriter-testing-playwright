Document Status: Canonical
Canonical Scope: Standardized workflow for extending health validation capabilities with new document configurations
Owner: Documentation Team
Related Legacy Docs: 
- docs/legacy/original_docs/AgileWriter_Automation_Handbook.md

Last Reviewed: 2026-05-27

Source Documents:
- Repository source tree
- onboarding review sessions

# Adding a New Health Script

> **MANDATORY RULE:**
> Development explains change.
> Architecture explains ownership.
> Execution explains behavior.

## Document Purpose

This document defines the process for safely introducing a new health validation workflow into the repository.

The workflow supports extension while preserving existing validation behavior and historical continuity.

**Confidence**: Observed

## Prerequisites

Configuration awareness
→ identify required templates and sources

Target environment
→ confirm available validation scope

**Confidence**: Observed

## Extension Purpose

New health scripts exist to:

Extend Coverage
→ validate additional scenarios

Preserve Existing Scope
→ avoid changing existing validation intent

Maintain Isolation
→ introduce change without expanding ownership

**Confidence**: Observed

## Configuration Updates

Add required configuration
→ support new validation scope

Preserve existing configuration
→ avoid impacting established workflows

Review environment guidance
→ maintain centralized configuration ownership

**Confidence**: Observed

## Script Creation

Follow existing health script conventions
→ preserve repository consistency

Create isolated validation paths
→ reduce unintended coupling

Avoid modifying shared execution paths
→ minimize regression risk

**Confidence**: Observed

## Validation Steps

Validate new workflow
→ confirm expected behavior

Validate existing workflows
→ identify regressions

Review generated outcomes
→ confirm interpretation remains possible

Update canonical documentation
→ preserve contributor understanding

**Confidence**: Observed

## Extension Boundaries

Supported Extension
→ isolated validation expansion

Escalation Required
→ shared workflow modification

Unsupported Extension
→ undocumented responsibility changes

**Confidence**: Observed

## Validation Expectations

Before considering a new health script complete:

Execute
→ new workflow

Compare
→ existing workflow behavior

Document
→ extension guidance

Preserve
→ historical references

**Confidence**: Observed

## Multi-Folder Source Selection (Ideaya PRODTEST)

Ideaya PRODTEST preflight is a safe validation flow for checking SharePoint picker
selection before an expensive training run begins.

Current confirmed scope:

- Destination template: `IDE196-009 Clinical Study Report_Template_27May_updated.docx`
- Template folder: `Template for SC`
- Source parent folder: `IDE196-009 TFLs`
- Source folder: `Tables_Test_EP`
- Stop behavior: `stopBeforeTraining=true`

The preflight script must select the source folder only after confirming it is
under `IDE196-009 TFLs`. This avoids a false pass where a similarly named
`Tables_Test_EP` folder from another study is selected by mistake.

How to run the safe validation:

```powershell
npx playwright test tests/health_Ideaya_preflight.spec.ts --project=health --headed
```

Expected behavior:

- the template is selected from PRODTEST
- `Tables_Test_EP` is selected under `IDE196-009 TFLs`
- the source document button shows a file count greater than zero
- `Start Training` is visible
- training is not started
- screenshot is saved to `reports/screenshots/ideaya-preflight.png`

To add another confirmed source folder later, update the comma-separated
`HEALTH_SOURCE_FOLDERS_IDEAYA` value. The helper already loops through the
array, so no code change should be needed after the folder is confirmed.

**Confidence**: Observed

## Rollback Expectations

If unexpected instability is observed:

Revert script addition
→ remove introduced changes

Revert configuration
→ restore configuration state

Revalidate
→ revalidate existing workflows

**Confidence**: Observed

## Change Boundaries

Supported Change
→ allowed modifications preserving boundaries

Unsupported Change
→ outside scope

**Confidence**: Observed

## Change Confidence Model

Verified
→ directly confirmed

Observed
→ visible behavior

Inferred
→ interpreted repository behavior

**Confidence**: Observed

## Historical Notes

Canonical documentation defines current development guidance.

Historical documentation preserves:
- prior development guidance
- historical modification approaches
- migration context

---

Next:

[Extension_Points.md](Extension_Points.md)
