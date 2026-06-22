# Quick Start

## 1. Why This Exists

If you are a new engineer or QA tester joining the AgileWriter Automation team, you need to prove your local environment actually works before you start writing code or running daily checks.

This document gets you from "I just cloned the repo" to "I successfully ran a test" in under 5 minutes.

## 2. Mental Model

You have two choices for running this project:
1. **The Hard Way (Local Node)**: Install Node.js, install Playwright, download Chromium binaries, deal with local OS path issues, and start the server.
2. **The Easy Way (Docker)**: Run one command, and let Docker build a completely isolated, pre-configured box that has everything installed.

We strongly recommend Docker.

## 3. Step-by-Step Workflow

Follow these steps exactly to run your first Health Check.

### Step 1: Start the Validation Environment

Ensure you are in the root directory of the repository (`Agile-Writer-Playwright-testing`). You must already have your `.env` file configured (see [Setup.md](Setup.md)).

Run the following command:
```bash
docker-compose up --build
```

**What is happening?**
Docker is pulling the official Microsoft Playwright image, installing Node.js dependencies, and starting the Express web server on port 3000. 

### Step 2: Access the Execution Dashboard

Once the terminal settles down, open your web browser and go to:
```text
http://localhost:3000/ui
```

**What is happening?**
You should see the AgileWriter Test Runner dashboard. If the site cannot be reached, Docker failed to start or port 3000 is blocked.

### Step 3: Run the Preflight Check

We are going to run the `health_Ideaya_preflight.spec.ts` script. We choose this one for your first run because it takes 2 minutes (instead of the 30 minutes a full document takes). It stops right before AI training starts, which is perfect for validating your setup without burning expensive AI credits.

1. Type your name in the Tester Name box.
2. Select an environment (e.g., QA).
3. Select `health_Ideaya_preflight.spec.ts` from the test dropdown.
4. Click **Run Test**.

### Step 4: Watch the Execution

A black terminal window will appear in the browser. You should see:
```text
Running test: health_Ideaya_preflight.spec.ts
[validateHealthEnv] Checks passed.
Logging into AgileWriter via Microsoft SSO...
Navigating to SharePoint folder...
Preflight complete. Exiting before training.
```

If the terminal turns green and says "Test execution completed successfully", your local environment is perfect.

### Step 5: Download the Report

Click the blue **Download Report** button. A Word document (`_Report.docx`) will download. Open it to verify that your name and the test steps were recorded correctly.

## 4. Common Mistakes

* **Running a 30-minute test first**: Don't run `health_Ideaya.spec.ts` as your first test. If your `.env` is misconfigured, you might not find out until 29 minutes into the run. Always use a preflight or a trimmed test first to prove mechanical connectivity.
* **Forgetting the `.env` file**: The server will start even without a `.env` file, but the moment you click "Run", the `validateHealthEnv` guard will instantly crash the test.

## 5. Troubleshooting

**Symptom**: `docker-compose up` fails with "port is already allocated".
* **Diagnosis**: You have another service (like a local React app or a rogue Node process) running on port 3000.
* **Fix**: Find the process and kill it, or change the port mapping in `docker-compose.yml`.

**Symptom**: The test fails immediately with `Missing required env vars`.
* **Diagnosis**: You skipped the [Setup.md](Setup.md) step and didn't copy `.env.example` to `.env`.
* **Fix**: Create your `.env` file and populate the `HEALTH_*_IDEAYA_PREFLIGHT` variables.

## 6. Key Takeaways

* Docker is the recommended way to run this repository.
* Always use `localhost:3000/ui` to run tests.
* Run the preflight test first to validate your setup quickly.

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
