Document Status: Canonical
Canonical Scope: Execute first health script successfully
Owner: Documentation Team
Related Legacy Docs:
- benchmarking_automation/_docs/cmds.md

Last Reviewed: 2026-05-22

Source Documents:
- README.md
- cmds.md
- onboarding review sessions

# Quick Start

## First Mental Model

If you are new, understand this path first:

`Execute via Docker → OR → Start Local Server → Discover Suites → Execute → Success Signal`

Then come back and read details.

## What This Component Does NOT Do
* **Does NOT explain accuracy scoring:** This guide focuses solely on executing a basic health script to prove immediate functionality.
* **Does NOT explain environment setup:** It assumes you have already completed the prerequisites in [Setup.md](Setup.md).
* **Does NOT provide test execution debugging:** See [Troubleshooting.md](../04_Operations/Troubleshooting.md) for validation run failures.

## What You Are NOT Learning Yet
* accuracy scoring
* report internals
* adding tests

> Decision: Dashboard-First Onboarding
> 
> Why this exists:
> The local execution dashboard reduces onboarding friction and encapsulates orchestration concerns.
> 
> Consequence:
> New contributors should start with execution dashboard validation runs before moving to direct Playwright execution.

### 1. Start the Validation Environment

Ensure you are in the root directory of the repository (`Agile-Writer-Playwright-testing`).

You can choose either the **Containerized** (Recommended) or **Local Node.js** execution path.

#### Path A: Containerized Execution (Recommended)

WHY:
Docker isolates all dependencies, provides a pre-configured Playwright environment, and ensures consistent volume mounts for reports.

HOW:

```bash
docker-compose up --build
```

#### Path B: Local Orchestration Server

WHY:
For local development or environments without Docker, the Node.js server acts as an execution broker.

WHEN:
Every time you want to execute health scripts against AgileWriter via the execution dashboard.

HOW:

```bash
npm run server
```

Expected Startup Output:

- server process starts
- execution dashboard endpoint becomes reachable
- no immediate exit

Expected Result:

- orchestration server process remains active
- no startup exceptions
- localhost reachable

If this step fails:
→ Stop
→ Fix the issue
→ Retry

See:

[Troubleshooting.md](../04_Operations/Troubleshooting.md)

CONSEQUENCE:
If the orchestration server is not running, the execution dashboard is inaccessible and health scripts cannot be dispatched.

### 2. Access the Execution Dashboard

WHY:
Provides a visual interface to select and trigger automated workflows without needing to memorize Playwright CLI arguments.

WHEN:
After confirming the orchestration server started successfully without port-binding errors.

HOW:

1. Open a web browser.
2. Navigate to:

```text
http://localhost:3000/ui
```

Expected Result:

- execution dashboard visible
- health scripts available

If this step fails:
→ Stop
→ Fix the issue
→ Retry

See:

[Troubleshooting.md](../04_Operations/Troubleshooting.md)

CONSEQUENCE:
You are presented with the primary QA automation control panel.

### 3. Execute Your First Health Script

WHY:
Validates that AgileWriter can successfully generate a specific document type end-to-end, proving both the application and the testing pipeline are functional.

WHEN:
Immediately after setup to prove your environment configuration is correct.

HOW:

1. Scroll to the **Run Health Scripts** section in the execution dashboard.
2. Select a target document from the dynamically populated dropdown. To see the full list of available suites from the CLI, run: `npx playwright test --project=health --list`
3. Click **Run Selected Script**.

Observable Signals:

- browser launches
- login completes
- progress updates appear
- generation completes

Expected Duration:

Health scripts may take several minutes depending on:

- document type
- training duration
- SharePoint responsiveness

Expected Result:

- validation run starts
- progress visible
- terminal updates

If this step fails:
→ Stop
→ Fix the issue
→ Retry

See:

[Troubleshooting.md](../04_Operations/Troubleshooting.md)

CONSEQUENCE:
Playwright will spawn in the background, log into AgileWriter, navigate SharePoint, and wait for the AI generation to complete. 

### 4. Confirm Execution Success

WHY:
Confirms the local environment, test script, and the AgileWriter application successfully completed a full end-to-end cycle.

WHEN:
After the terminal indicates the Playwright execution has concluded.

HOW:

1. Observe the terminal output.
2. Observe the execution dashboard completion status.

Expected Result:

- orchestration server remains alive
- automation process reaches terminal completion state
- terminal shows completed validation run
- execution dashboard reports successful completion
- no immediate failures

If this step fails:
→ Stop
→ Fix the issue
→ Retry

See:

[Troubleshooting.md](../04_Operations/Troubleshooting.md)

CONSEQUENCE:
You have reached the onboarding success milestone and confirmed your local execution environment is operational.

## Onboarding Complete

You can now:

- run existing health scripts
- explore repository structure
- continue to developer onboarding

Continue:

[User_Execution_Guide.md](../02_User_Guides/User_Execution_Guide.md)
