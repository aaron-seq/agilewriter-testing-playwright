# Setup

## 1. Why This Exists

This repository does not contain AgileWriter itself. It contains the testing automation that acts like a robot user.

Because it acts like a real user, it needs a real environment: it needs a browser, a server to organize the runs, and credentials to log in. This document explains how to set up your local machine so you can run the robot.

## 2. Mental Model

You have two paths to get running:

1. **The Docker Path (Recommended)**: You install Docker. You run `docker-compose up`. Docker downloads an isolated Linux container, installs Node.js, installs Playwright, downloads Chromium, maps your `.env` file, and starts the server. It is completely clean and reproducible.
2. **The Local Path**: You install Node.js manually. You run `npm install`. You run `npx playwright install` to download Chromium. You start the server manually.

Choose Docker unless you have a specific reason to run locally (e.g., you are developing new Playwright test logic and want to use the VS Code debugger).

## 3. Real Example: The Docker Setup (Recommended)

### Step 1: Clone the Repository

```bash
git clone https://aarons8@bitbucket.org/smartercodes-repo/automation-validation-tests.git
cd Agile-Writer-Playwright-testing
```

### Step 2: Install Docker

Ensure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running on your machine.

### Step 3: Configure the Environment

The system needs to know where AgileWriter lives and how to log in. We keep this out of Git using a `.env` file.

```bash
# Copy the template to create your local copy
cp .env.example .env
```

Open `.env` and fill in your Microsoft credentials and the target `BASE_URL`. (See [Environment_Configuration.md](../01_Developer_Handbook/Environment_Configuration.md) for details).

### Step 4: Build and Run

```bash
docker-compose up --build
```

This will take a few minutes the first time. Once it finishes, the server will be running on port 3000.

## 4. Alternative: The Local Setup

If you prefer not to use Docker, follow these steps:

### Step 1: Clone and Configure

```bash
git clone https://github.com/aaron-seq/Agile-Writer-Playwright-testing.git
cd Agile-Writer-Playwright-testing
cp .env.example .env
```

*(Remember to fill in your `.env` file)*

### Step 2: Install Dependencies

```bash
# 1. Install Node.js libraries (Express, TypeScript, etc.)
npm install

# 2. Install the Playwright browser binaries
npx playwright install --with-deps
```

### Step 3: Start the Server

```bash
npm run server
```

## 5. Optional: Python Setup

> [!NOTE]
> You only need to do this if you are working on the Accuracy Scoring pipeline in `benchmarking_automation/`. You do not need Python to run Health Tests.

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

## 6. Common Mistakes

* **Skipping `npx playwright install`**: If you use the Local Setup and skip this step, Playwright will crash immediately because it has no browser to drive. Playwright does not use your normal Google Chrome installation.
* **Forgetting to update `.env`**: Copying the example file isn't enough; you must put real credentials inside it.
* **Installing Python unnecessarily**: Do not install Python if you are just a QA engineer running daily health checks.

## 7. Troubleshooting

**Symptom**: You ran `npm run server` or `docker-compose up`, but you get a `port already in use` error.

* **Diagnosis**: Another process is already using port 3000 (usually a rogue Node.js process or another React app).
* **Fix**: Find and kill the process.
  * Windows: `netstat -ano | findstr :3000`
  * Mac/Linux: `lsof -i :3000`

**Symptom**: Docker builds successfully, but tests immediately fail saying "Microsoft SSO blocked".

* **Diagnosis**: Your company firewall or conditional access policies might be blocking headless logins from Docker IP ranges.
* **Fix**: Use the Local Setup instead, and change `headless: false` in `playwright.config.js` so you can manually approve the Microsoft 2FA prompt once.

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
