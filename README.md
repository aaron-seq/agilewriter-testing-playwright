# Automation Validation Tests

Automation Validation Tests is a repository used to validate document generation workflows and reporting behavior in Agile Writer.

This guide helps you:

* Set up the project
* Configure your environment
* Run health validation workflows
* View results
* Troubleshoot common issues

---

# Before You Start

Install the following:

* Node.js (Version 18 or higher)
* Git

Check installation:

```bash
node -v
git --version
```

---

# Clone the Repository

```bash
git clone https://bitbucket.org/smartercodes-repo/automation-validation-tests.git
cd automation-validation-tests
```

---

# Install Dependencies

Install all required packages:

```bash
npm install
```

Install Playwright browsers:

```bash
npx playwright install
```

---

# Configure Environment Variables

Create a file named:

```text
.env
```

in the repository root.

Copy values from:

```text
.env.example
```

and update them with your environment credentials.

Example:

```env
MS_EMAIL=your-email
MS_PASSWORD=your-password
BASE_URL=https://your-environment-url

PLACEHOLDER_REGEX=<\s*([^<>]+?)\s*>
```

## Important

Environment variables control:

* Login credentials
* Target environment
* Health workflow configuration
* Validation settings

Environment configuration should always be managed through:

```text
.env
```

and

```text
.env.example
```

---

# Verify Configuration

Before running any health workflow:

Confirm:

* `.env` exists
* Required variables are populated
* Credentials are valid
* Target environment is accessible

---

# Running Health Workflows

## Discover Available Health Suites

List available health workflows:

```bash
npx playwright test --project=health --list
```

This command shows all available health validation suites.

### What is a Suite?

A suite is a group of related automated validation steps.

---

## Run All Health Workflows

```bash
npx playwright test --project=health
```

---

## Run a Specific Health Workflow

Example:

```bash
npx playwright test tests/health_CSR.spec.ts
```

Replace the filename with the workflow you want to execute.

---

## Run Playwright UI Mode

UI Mode provides a visual interface for running tests.

```bash
npx playwright test --ui
```

### What is UI Mode?

UI Mode is a visual dashboard that lets you:

* Start tests
* Stop tests
* View results
* Debug failures

without using command-line commands repeatedly.

---

## Required Environment Variables per Health Suite

Each health suite requires specific environment variables to be set in `.env`
before it can run. If any required variable is missing or empty, the server
will return a `400` error immediately — no test will be spawned.

Use `.env.example` as the reference for all variable names and groupings.

| Suite | Required Variables |
|---|---|
| CSR | `HEALTH_TEMPLATE_CSR`, `HEALTH_TEMPLATE_FOLDER_CSR`, `HEALTH_SOURCES_CSR`, `HEALTH_SOURCE_FOLDER_CSR` |
| ICF Full | `HEALTH_TEMPLATE_ICF_FULL`, `HEALTH_TEMPLATE_FOLDER_ICF_FULL`, `HEALTH_SOURCES_ICF_FULL`, `HEALTH_SOURCE_FOLDER_ICF_FULL` |
| ICF Trimmed | `HEALTH_TEMPLATE_ICF_TRIMMED`, `HEALTH_TEMPLATE_FOLDER_ICF_TRIMMED`, `HEALTH_SOURCES_ICF_TRIMMED`, `HEALTH_SOURCE_FOLDER_ICF_TRIMMED` |
| Ideaya (ORG) | `HEALTH_TEMPLATE_IDEAYA`, `HEALTH_TEMPLATE_FOLDER_IDEAYA`, `HEALTH_SOURCE_FILE_IDEAYA`, `HEALTH_SOURCE_PARENT_FOLDER_IDEAYA`, `HEALTH_SOURCE_NESTED_FOLDERS_IDEAYA` |
| Ideaya Preflight | `HEALTH_TEMPLATE_IDEAYA_PREFLIGHT`, `HEALTH_TEMPLATE_FOLDER_IDEAYA_PREFLIGHT`, `HEALTH_PARENT_FOLDER_IDEAYA_PREFLIGHT`, `HEALTH_CLIENT_IDEAYA_PREFLIGHT` |
| Ideaya PRODTEST CSR | `HEALTH_TEMPLATE_IDEAYA_PRODTEST_CSR`, `HEALTH_TEMPLATE_FOLDER_IDEAYA_PRODTEST_CSR`, `HEALTH_TEMPLATE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR`, `HEALTH_SOURCES_IDEAYA_PRODTEST_CSR`, `HEALTH_SOURCE_PARENT_FOLDER_IDEAYA_PRODTEST_CSR` |
| M264 | `HEALTH_TEMPLATE_M264`, `HEALTH_TEMPLATE_FOLDER_M264`, `HEALTH_SOURCES_M264`, `HEALTH_SOURCE_FOLDER_M264` |

---

## How to Run Health Checks via the Web UI

The test runner includes a local web interface for running health checks
without using the command line.

**Local:**
1. Start the server: `npm run server`
2. Open: `http://localhost:3000/ui`
3. Select a health suite from the dropdown
4. Click **Execute**
5. Wait for the run to complete
6. Download the generated DOCX report from the session output

**Cloud (hosted instance):**
Access the shared hosted URL provided by your team lead.
No local setup required — all configuration is managed server-side.
Contact Aaron Sequeira or check the SCC-224 Jira ticket for the current URL.

---

## Reading the DOCX Health Report

Every health run generates a DOCX report saved to `sessions/<sessionId>/`.
The report contains a step-by-step timeline of the run.

**Overall Status values:**
| Status | Meaning |
|---|---|
| `PASS` | All critical steps completed successfully |
| `FAIL` | One or more critical steps failed |

**Placeholder color meanings (training workspace):**
| Color | Meaning |
|---|---|
| 🟢 Green | Replacement done — placeholder was successfully populated |
| ⬜ Grey | Not matched — no matching content found in sources |
| 🔵 Blue | Match found — content matched but not yet applied |
| 🔴 Red | Replacement not found — matching failed |
| 🟡 Yellow | Matching in progress — still processing |

---

## Troubleshooting Health Check Failures

**Error: `[validateHealthEnv] Missing required env vars for 'csr': HEALTH_TEMPLATE_CSR`**
The server returned a 400 before spawning any test.
Fix: Open `.env` and add the missing variable. Use `.env.example` as a reference.

**Error: `Health spec not found in validation map`**
A new health spec was added but not registered in `utils/validateHealthEnv.js`.
Fix: Add the spec filename and its config key to `HEALTH_SPEC_CONFIG_MAP`
in both `utils/validateHealthEnv.js` and `utils/validateHealthEnv.ts`.

**DOCX shows `Overall Status: FAIL` with `No steps were recorded`**
The test failed before execution began — likely a `beforeAll` error.
Fix: Check the server log for the error message. Most likely a missing env var.

**DOCX shows `Overall Status: PASS` but the suite ran with 0 placeholders**
The training ran but found no matching content.
Fix: Verify the source documents configured in `.env` contain content
that matches the template placeholders.

**Health suite count changed unexpectedly**
Run the isolation validation script:
```bash
npx playwright test tests/helpers/__tests__/healthIsolation.spec.ts --no-deps
```
This will identify which spec is missing or which unexpected spec was added.

---

# Running Other Validation Tests

Run all tests:

```bash
npx playwright test
```

Run a specific test:

```bash
npx playwright test tests/example.spec.ts
```

---

# Viewing Results

## HTML Report

Generate and open the report:

```bash
npx playwright show-report
```

The report opens in your browser.

The report contains:

* Passed tests
* Failed tests
* Execution duration
* Screenshots
* Traces

---

## What is a Trace?

A trace is a recording of test activity.

It may include:

* Screenshots
* Page activity
* Network requests
* User actions

Traces help investigate failures.

---

# Common Workflow

Typical execution sequence:

```text
1. Pull latest code
2. Update .env
3. Install dependencies
4. Verify configuration
5. Run health workflow
6. Review report
7. Investigate failures if needed
```

---

# Troubleshooting Guide

## Problem: Login Fails

Check:

* MS_EMAIL
* MS_PASSWORD
* Environment URL
* Account access

Try:

```bash
npm install
```

and rerun the workflow.

---

## Problem: Environment Variables Not Found

Check:

```text
.env
```

exists in the repository root.

Verify required values are populated.

Compare against:

```text
.env.example
```

---

## Problem: No Health Workflows Found

Run:

```bash
npx playwright test --project=health --list
```

If no suites appear:

* Pull latest code
* Verify dependencies installed
* Verify repository setup completed successfully

---

## Problem: Browser Does Not Launch

Reinstall Playwright browsers:

```bash
npx playwright install
```

---

## Problem: Tests Stop Unexpectedly

Collect:

* Error message
* Screenshot
* HTML report
* Trace file

Review the report before retrying.

---

## Problem: Report Is Empty

Verify:

* Workflow completed
* Test execution finished successfully
* Output artifacts were generated

Run the workflow again and review logs.

---

# Useful Commands

Install dependencies:

```bash
npm install
```

Install browsers:

```bash
npx playwright install
```

List health suites:

```bash
npx playwright test --project=health --list
```

Run health workflows:

```bash
npx playwright test --project=health
```

Run all tests:

```bash
npx playwright test
```

Open UI Mode:

```bash
npx playwright test --ui
```

Open report:

```bash
npx playwright show-report
```

---

# Need Help?

When reporting an issue, include:

* Workflow name
* Environment used
* Error message
* Screenshot (if available)
* HTML report
* Trace information

This helps investigation and recovery.
