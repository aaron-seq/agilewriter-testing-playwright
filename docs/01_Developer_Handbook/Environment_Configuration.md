Document Status: Canonical
Canonical Scope: Define environment variables, source of truth rules, and rotation processes
Owner: Documentation Team
Related Legacy Docs: 
- docs/legacy/original_docs/Environment_Variables_Reference.md
- docs/legacy/original_docs/baseurl-usage.md

Last Reviewed: 2026-05-25

Source Documents:
- .env.example
- legacy reference files

# Environment Configuration

> **MANDATORY RULE:**
> `Environment_Configuration.md` is the ONLY canonical location for environment variables.

## Environment Philosophy

The AgileWriter Automation Suite relies heavily on environment variables to control execution targets, supply credentials, and define expected outputs. The `.env` file isolates state from the repository and provides runtime flexibility.

In containerized environments (Docker), the `.env` file is injected directly into the container at runtime.

## Source of Truth Rules

Environment variable changes require:

1. Update `.env.example`
2. Update `Environment_Configuration.md`
3. Validate `Setup.md`
4. Validate one health script

**Confidence**: Verified

## Variable Lifecycle

Variables follow this operational progression:

Create → Document → Validate → Consume → Rotate → Migrate → Deprecate → Archive

Rules:
* new variables require `.env.example` presence
* variables must appear in this document
* removal requires migration notes
* Deprecated variables remain documented until migration completes.

## Verified Variables

Variables explicitly present in `.env.example`.

### Baseline Execution Variables

These variables are commonly required for baseline local execution workflows. Specific scripts may require additional variables.

| Variable | Purpose | Example | Primary Consumer | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| `MS_EMAIL` | Microsoft SSO username for AgileWriter authentication. | `<MICROSOFT_EMAIL>` | Playwright authentication | Verified |
| `MS_PASSWORD` | Microsoft SSO password. | `<MICROSOFT_PASSWORD>` | Playwright authentication | Verified |
| `BASE_URL` | The target AgileWriter environment API and backend routing URL. | `<AGILEWRITER_BASE_URL>` | Playwright navigation | Verified |

### Context-Specific Variables

These variables configure metadata or override health check targets. If omitted, specific tests may fail without affecting the baseline local execution workflows.

| Variable | Purpose | Example | Primary Consumer | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| `PLACEHOLDER_REGEX` | Regex pattern matching text placeholders in documents. | `<REGEX_PATTERN>` | Execution parsing | Verified |
| `TESTER_NAME` | Name injected into generated QA reports. | `<TESTER_NAME>` | Reporting | Verified |
| `TEST_ENV` | Environment tag for the generated reports. | `<ENVIRONMENT_TAG>` | Reporting | Verified |
| `APP_URL` | Specific sign-in URL for AgileWriter frontend. | `<APP_URL>` | Playwright authentication | Verified |

#### Configuration Validation Pattern

Health configuration variables are strictly governed by a centralized pattern to prevent silent runtime failures and configuration drift:

1. **Configuration Key**: A specific suite key is defined in `runtime-config.ts` (e.g., `configKeyName`).
2. **Validation Mapping**: The `tests/helpers/validateHealthEnv.ts` file maps the key to its exact required environment variables.
3. **Environment Variables**: The required variables are stubbed in `.env.example` to ensure all developers understand the requirements, and set in the local `.env`.
4. **Runtime Consumption**: The health spec invokes `validateHealthEnv('configKeyName')` as its very first action. If any mapped variables are missing, execution aborts immediately with a clear error listing the missing variables.

**MANDATORY**: Any variables whose absence causes a *functional silent failure* (such as incorrect source selection resulting in an empty report) MUST be classified as required in the validation mapping, rather than remaining optional.

## Derived Configuration Concepts

Concepts inferred from execution patterns.

* **Playwright Dynamic Timeouts**: Timeout limits often inferred by `process.env.TIMEOUT_OVERRIDE` or similar ad-hoc environment variables.
  * **Confidence**: Inferred
* **Accuracy Scoring Targets**: Path offsets and expected accuracy baselines configured locally.
  * **Confidence**: Inferred

## Variable Consumers

| Variable | Consumer | Failure Signal | Confidence |
| :--- | :--- | :--- | :--- |
| `BASE_URL` | Playwright execution | navigation failure | Verified |
| `MS_EMAIL` / `MS_PASSWORD` | Playwright authentication layer | SSO login failure | Verified |
| `HEALTH_TEMPLATE_*` | Playwright health scripts | SharePoint document not found | Verified |
| `TESTER_NAME` / `TEST_ENV` | Reporting scripts | Missing metadata in generated reports | Verified |

## Configuration Resolution Principles

* local configuration takes precedence
* runtime configuration may override defaults
* consumers should not assume resolution order

**Confidence**: Verified

## Environment Validation Checklist

Check `.env` baseline values
→ Populated

Server starts
→ Dashboard reachable

Health script executes
→ Generated output completes

**Confidence**: Verified

## Local Development

For local development:
1. Clone the repository.
2. Run `cp .env.example .env`.
3. Fill in the required `<MICROSOFT_EMAIL>`, `<MICROSOFT_PASSWORD>`, and `<AGILEWRITER_BASE_URL>`.
4. Do NOT commit the `.env` file.

Do not share `.env`.
Do not copy another developer's environment blindly.
Use `.env.example` as initialization only.
Local environments should remain reproducible.
Avoid preserving undocumented local overrides.

## Common Misconfigurations

* **Missing BASE_URL** → navigation failure
* **Incorrect HEALTH_TEMPLATE paths** → script timeout searching SharePoint
* **Trailing Spaces** → authentication or navigation failure
* **Copied values from wrong environment** → unexpected execution targets
* **Stale `.env` after repository update** → missing variables or execution failures
* **Incorrect placeholder replacement** → script errors
* **Editing `.env.example` locally** → accidental commit of credentials

## Safe Rotation Process

Recommended after updates:

- restart orchestration server
- rerun verification flow

## Environment Governance

Environment variables:

- belong in `.env.example`
- belong in this document
- should not exist only in code
- require migration notes before removal

## Historical Environment Decisions

Environment guidance was historically distributed across multiple documents.

Canonical documentation now centralizes guidance.

Historical documents remain preserved for migration and debugging context.

---

Next:

[Execution_Flows.md](Execution_Flows.md)
