Document Status: Canonical
Canonical Scope: Define system responsibilities, boundaries, and architectural principles
Owner: Documentation Team
Related Legacy Docs: 
- docs/legacy/original_docs/AgileWriter_Automation_Handbook.md

Last Reviewed: 2026-05-25

Source Documents:
- Repository source tree
- onboarding review sessions

# System Architecture Deep Dive

> **MANDATORY RULE:**
> Architecture explains responsibilities.
> Execution explains behavior.

## System Purpose

The AgileWriter Automation Suite organizes validation responsibilities outside the primary AgileWriter application.

The suite separates execution, evaluation, and reporting concerns into distinct operational domains.

**Confidence**: Observed

## Architectural Principles

Responsibility Separation
→ execution and evaluation remain independent

Observable Boundaries
→ systems expose outputs that can be reviewed

Operational Independence
→ domains are organized to reduce coupling

**Confidence**: Observed

## System Boundaries

Execution Domain
→ workflow coordination

Validation Domain
→ output evaluation

Reporting Domain
→ outcome summarization

Boundary Rule:
Responsibilities should remain owned by a single domain whenever possible.

**Confidence**: Observed

## Node Execution Layer

Responsibility
→ coordinate validation execution

Observable Input
→ execution request

Observable Output
→ execution outcome

**Confidence**: Observed

## Python Validation Layer

Responsibility
→ evaluate outputs

Observable Input
→ generated artifacts

Observable Output
→ interpreted outcomes

**Confidence**: Observed

## Reporting Layer

Responsibility
→ summarize outcomes

Observable Input
→ execution interpretation

Observable Output
→ report artifact

**Confidence**: Observed

## Cross-System Contracts

Execution
→ Validation
→ outcomes available for evaluation

Validation
→ Reporting
→ interpretation available for summarization

**Confidence**: Observed

## Architecture Ownership Model

Execution
→ workflow coordination

Validation
→ output interpretation

Reporting
→ outcome communication

**Confidence**: Observed

## Operational Constraints

Independent domains
→ coordination effort

Sequential dependencies
→ staged completion

**Confidence**: Observed

## Architecture Confidence Model

Verified
→ explicitly documented or directly confirmed

Observed
→ directly visible

Inferred
→ interpreted from system structure

**Confidence**: Observed

## Architecture Decisions

Decision:
- Strict Environment Separation

Why:
- Combining Python accuracy analysis inside Playwright tests increased complexity and execution fragility.

Architectural Tradeoff:
- Domain separation introduces additional coordination while preserving responsibility clarity.

Confidence:
- Inferred

## Historical Architecture Notes

Canonical documentation defines current architectural guidance.

Historical documentation preserves:
- prior architectural guidance
- historical ownership decisions
- migration context

---

Next:

[Health_Pipeline_Deep_Dive.md](Health_Pipeline_Deep_Dive.md)
