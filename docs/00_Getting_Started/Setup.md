Document Status: Canonical
Related Legacy Docs: TBD

# Setup

## First Mental Model

If you are new, understand this path first:

`Clone Repository → Install Node.js Ecosystem → Configure .env → Verify UI Loads → Ready to Execute`

Then come back and read details.

## What This Component Does NOT Do
* **Does NOT install AgileWriter:** This repository only contains the validation suite; it tests an externally hosted AgileWriter application.
* **Does NOT provision credentials:** You must manually obtain valid SharePoint and Microsoft login credentials.
* **Does NOT configure CI/CD:** Setup is optimized purely for local execution.

> Decision: Local-Only Execution
> Why this exists: AgileWriter validation currently requires complex manual Microsoft authentication and SharePoint interaction that is not yet fully headless or service-account ready.
> Consequence: Developers must set up their local environment to execute tests.

## Prerequisites

Ensure you have the following installed on your local workstation:

1. **Node.js** (v18 or higher)
2. **Git**

## Required Installation Paths

You must choose ONE execution path:
* **Path A: Containerized (Recommended)**: Uses Docker to isolate dependencies and guarantee environment consistency.
* **Path B: Local Node.js**: Uses your local machine's Node.js and browser binaries.

### Path A: Containerized Setup (Recommended)

#### 1. Clone Repository

```bash
git clone https://github.com/aaron-seq/Agile-Writer-Playwright-testing.git
cd "Agile-Writer-Playwright-testing"
```

#### 2. Install Docker

Ensure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

#### 3. Configure Environment

Copy the example environment file:

```bash
# Mac/Linux
cp .env.example .env

# Windows
copy .env.example .env
```

Ensure you configure the `.env` file according to [Environment_Configuration.md](../01_Developer_Handbook/Environment_Configuration.md).

#### 4. First Run

Build and start the container:

```bash
docker-compose up --build
```

If successful, the validation UI will be available at `http://localhost:3000/ui` and Playwright will be ready to execute headless tests.

---

### Path B: Local Node.js Setup

This prepares the frontend UI and Playwright automation suite locally.

### 1. Clone Repository

WHY:
Creates a local working copy of the repository.

WHEN:
Only once for a new workstation.

HOW:

```bash
git clone https://github.com/aaron-seq/Agile-Writer-Playwright-testing.git
cd "Agile-Writer-Playwright-testing"
```

CONSEQUENCE:
Without a local repository checkout, no setup step can proceed.

### 2. Install Node Dependencies

#### `npm install`

WHY:
Installs repository dependencies declared in `package.json`, including Playwright, Express, TypeScript packages, reporting utilities, and supporting libraries.

WHEN:
Run once immediately after cloning. Re-run only after dependency changes (`package.json` or lockfile updates).

HOW:

```bash
npm install
```

CONSEQUENCE:
If skipped, the local server cannot start and imports will fail with module resolution errors.

#### Install Playwright Browser Runtime

WHY:
Downloads browser binaries required for automation execution. Playwright does not use your locally installed browser.

WHEN:
Run once after `npm install`. Re-run after Playwright upgrades.

HOW:

```bash
npx playwright install --with-deps
```

CONSEQUENCE:
Health scripts and browser-driven validation fail immediately with executable-not-found errors.

### 3. Configure Environment

#### Create Local Environment File

WHY:
Creates your personal local configuration file. `.env` remains untracked so credentials are never committed.

WHEN:
Run once after cloning. Do NOT overwrite an already-configured `.env`.

HOW:

Mac/Linux:

```bash
cp .env.example .env
```

Windows:

```bash
copy .env.example .env
```

CONSEQUENCE:
If skipped, tests fail at startup due to missing runtime configuration.

Environment variable definitions belong ONLY here:
[Environment_Configuration.md](../01_Developer_Handbook/Environment_Configuration.md)

Do not duplicate variables in Setup.md.

### 4. Setup Gate

Do not continue until ALL are true:

✅ Repository cloned  
✅ `node_modules/` directory exists  
✅ Playwright completed successfully with no install errors  
✅ `.env` created

If any check fails:

Stop.

Resolve the missing prerequisite before continuing.

> Warning:
> Do not install Python unless you specifically intend to work on `benchmarking_automation/`.
> 
> Python is not required to run health checks or accuracy scoring.

### 5. Optional: Python Benchmarking

For benchmarking architecture:

See:
[Repository_Overview.md](Repository_Overview.md)

Requires: **Python 3.9+**

WHY:
Sets up a dedicated virtual environment for Automap validation and XML extraction tools.

WHEN:
Only if you are maintaining or executing Python benchmarking tests.

HOW:

```bash
cd benchmarking_automation
python -m venv venv

# On Windows:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cd ..
```

CONSEQUENCE:
If skipped, Python benchmarking scripts cannot be executed, but the primary Node.js frontend automation remains entirely unaffected.

### 6. Verify Your Setup

WHY:
Validates that the Node server can start, bind to a port, and serve the UI dashboard without crashing.

WHEN:
Run once to verify successful installation, and every time you want to execute health scripts via the UI.

HOW:

```bash
npm run server
```

Open your browser to:
`http://localhost:3000/ui`

Success means:

- server process remains alive
- UI opens
- script selector visible
- no startup exceptions

Failure means:

- server exits immediately
- blank page
- missing scripts
- authentication/config errors

If the UI does not load:

Mac/Linux:

```bash
lsof -i :3000
```

Windows:

```bash
netstat -ano | findstr :3000
```

Then:

* confirm another process is not using port 3000
* inspect terminal startup output
* review:
[Troubleshooting.md](../04_Operations/Troubleshooting.md)

### 7. Setup Complete

If verification succeeded:

You are ready to run your first health script.

Continue:

[Quick_Start.md](Quick_Start.md)
