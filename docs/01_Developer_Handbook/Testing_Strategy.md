Document Status: Canonical
Canonical Scope: Define testing philosophy, taxonomy, cost models, and extension rules
Owner: Documentation Team
Related Legacy Docs: 
- docs/legacy/original_docs/AgileWriter_Automation_Handbook.md

Last Reviewed: 2026-05-25

Source Documents:
- Repository source tree (`tests/`, `benchmarking_automation/`)
- onboarding review sessions

# Testing Strategy

## Testing Philosophy

The AgileWriter Automation Suite primarily emphasizes integration-oriented validation workflows over exhaustive unit testing. Tests are designed to evaluate end-to-end functionality, assess model accuracy, and verify business workflows as observed by a real user or a machine scoring agent. 

If changing tests:
→ update docs
→ validate one existing health script
→ validate one new path

**Confidence**: Observed

## Testing Boundaries

Health Validation
→ execution confidence

Artifact Validation
→ output evaluation

Reporting
→ result summarization

Testing outcomes should not be interpreted as complete product certification.

**Confidence**: Observed

## Repository Test Categories

The suite divides tests into distinct functional categories based on repository organization:

* **Health Tests**: Lightweight browser automation scripts assessing basic document generation workflows.
* **Accuracy Validations**: Python-driven forensic comparisons evaluating generated document content against baseline schema models.

**Confidence**: Observed

## Validation Objectives

Operational Confidence
→ core document paths execute

Output Evaluation
→ generated artifacts can be analyzed

**Confidence**: Observed

## Health Testing Strategy

Health tests (`health_*.spec.ts`) verify that core document paths execute successfully end-to-end. 

* **Focus**: Assess operational stability (e.g., successful upload, training, and generation).
* **Environment**: Local Node/Playwright or Docker Container.
* **Targeting**: Isolated by document type.
* **Discovery**: Available suites are discovered dynamically via CLI (`npx playwright test --project=health --list`).

**Confidence**: Observed

## Accuracy Validation Strategy

Accuracy validations (`benchmarking_automation/main.py`) evaluate generated output against expected structures.

* **Focus**: Data extraction correctness and template adherence assessment.
* **Environment**: Python extraction and normalization pipeline.
* **Targeting**: Existing generated artifacts (`.docx`, `.xml`).

**Confidence**: Observed

## Broader Validation Scope

Additional validation workflows may exist outside health execution.

**Confidence**: Inferred

## Test Selection Rules

Selection guidance based on common repository usage:

* **Need a quick deployment check?** → Execute a health test.
* **Need to validate training model updates?** → Execute the accuracy validation pipeline.

**Confidence**: Inferred

## Execution Cost Model

Testing carries observable operational overhead:

Health Execution
→ Relative Effort: Higher
→ browser automation, waiting stages

Artifact Validation
→ Relative Effort: Lower
→ local processing

Report Generation
→ Relative Effort: Lower
→ aggregation only

**Confidence**: Observed

## Test Execution Signals

Health Validation
→ workflow completes

Artifact Validation
→ output available

Report Generation
→ report artifact produced

**Confidence**: Observed

## Test Reliability Principles

* prefer reproducible configuration
* avoid unnecessary coupling
* favor observable completion signals
* minimize environment drift
* avoid undocumented environment assumptions
* preserve deterministic onboarding

**Confidence**: Observed

## Adding New Tests

When adding a new validation scenario:

New health path
→ execute one existing path
→ update execution docs

New artifact validation
→ validate baseline output
→ update testing docs

**Confidence**: Observed

## Test Decision Records

Decision:
- Health Validation Isolation

Why:
- Combining exhaustive QA validation with deployment health checks creates a fragile and slow feedback loop.

Operational Tradeoff:
- Health tests were isolated into dedicated scripts prefixed with `health_` to allow rapid confidence testing, potentially leaving broader areas unverified during quick checks.

Confidence:
- Inferred

Decision:
- Playwright Over Python for UI

Why:
- Playwright became the observed primary UI automation mechanism.

Operational Tradeoff:
- The UI automation stack is strictly Node-based, requiring the maintenance of two separate environments since Python is used for backend textual analysis.

Confidence:
- Inferred

## Historical Testing Notes

Canonical documentation defines current testing guidance.

Historical documentation preserves:
- prior validation approaches
- migration context
- historical testing practices
- repository evolution decisions

---

Next:

[User_Execution_Guide.md](../02_User_Guides/User_Execution_Guide.md)
