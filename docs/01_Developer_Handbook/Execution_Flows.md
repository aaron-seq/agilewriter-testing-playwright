Document Status: Canonical
Canonical Scope: Define repository execution paths, models, and lifecycles
Owner: Documentation Team
Related Legacy Docs: 
- docs/legacy/original_docs/AgileWriter_Automation_Handbook.md
- docs/legacy/historical_walkthroughs/benchmarking-setup.md

Last Reviewed: 2026-05-25

Source Documents:
- Repository source tree (`package.json`, `server/`, `benchmarking_automation/`)
- onboarding review sessions

# Execution Flows

## Execution Philosophy

The AgileWriter Automation Suite operates on a dual-ecosystem execution model. Frontend validation (Playwright) is decoupled from backend accuracy scoring (Python). Execution flows prioritize clear entry points, strict environmental isolation, and deterministic reporting. 

If changing execution:
→ update docs
→ validate one health script
→ validate report generation

## Execution Models

The suite supports four primary models of execution:

Interactive Execution
→ Dashboard-driven

Direct Execution
→ Command-driven

Artifact Validation
→ Existing outputs

Report Generation
→ Aggregation workflow

**Confidence**: Inferred

## Execution Boundaries

Playwright execution:
→ interactive validation

Python execution:
→ artifact analysis

Reporting:
→ output summarization

Rule:

Execution domains should remain independently operable where possible.

**Confidence**: Observed

## Execution Entry Points

* **Orchestration Server:** `npm run server`
* **Local UI Dashboard:** `http://localhost:3000/ui`
* **Accuracy Pipeline:** `python benchmarking_automation/main.py`
* **Report Generator:** `npm run report`

**Confidence**: Verified

## Example Validation Lifecycle

The suite supports multiple execution paths.

The lifecycle below illustrates a common validation sequence and is not required for all workflows.

1. **Initialization:** Server starts, loading configuration.
2. **Execution:** Health scripts are dispatched via the UI dashboard.
3. **Extraction:** Python pipeline extracts data from generated artifacts.
4. **Scoring:** Accuracy is validated against models.
5. **Reporting:** Node scripts generate the final compliance document.

**Confidence**: Inferred

## Execution Checkpoints

Checkpoint
→ Observable Success Signal

Server Start
→ dashboard reachable

Health Execution
→ execution completes

Accuracy Scoring
→ accuracy metric emitted

Report Generation
→ output artifact present

**Confidence**: Observed

## Health Execution Flow

Dashboard receives request
→ browser automation executes
→ result returned

**Confidence**: Observed

## Accuracy Execution Flow

Artifacts provided
→ extraction and normalization scores payload against expected schema
→ result returned

**Confidence**: Observed

## Report Generation Flow

Command executed
→ execution results collected and metadata attached
→ output artifact generated

**Confidence**: Observed

## Failure Recovery Paths

Training timeout
→ Observable Signal: execution stalls
→ Validation Step: verify inputs
→ Next Action: review configuration

Accuracy script fails
→ Observable Signal: parser error
→ Validation Step: verify generated output integrity
→ Next Action: inspect output

Reporting script fails
→ Observable Signal: missing report
→ Validation Step: verify execution trace availability
→ Next Action: escalate investigation

**Confidence**: Observed

## Runtime Signals

* terminal
* dashboard
* progress indicators

## Generated Artifacts

* reports
* logs
* generated outputs

**Confidence**: Verified

## Execution Decision Records

Decision:
- UI Dashboard Over CLI

Why:
- Execution was shifted to a UI dashboard to reduce QA engineer onboarding friction.

Consequence:
- Commands are primarily invoked indirectly rather than directly via Playwright CLI.

Confidence:
- Inferred

Decision:
- Python Decoupling

Why:
- Accuracy scoring was decoupled from Playwright to allow independent execution on pre-generated documents.

Consequence:
- The validation suite requires two separate runtime environments.

Confidence:
- Inferred

## Historical Execution Notes

Canonical documentation defines current execution guidance.

Historical documentation preserves:
- prior workflows
- migration context
- operational history

---

Next:

[Testing_Strategy.md](Testing_Strategy.md)
