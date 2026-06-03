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
