# Automation Validation Tests

This repository contains Playwright end-to-end automation tests for the Agile Writer application.

## Prerequisites

Before getting started, make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/en/download/) (v18 or higher recommended)
- [Git](https://git-scm.com/downloads)

## Setup Instructions

1. **Clone the repository:**
   Open your terminal or command prompt and run the following command to clone the project:
   ```bash
   git clone https://bitbucket.org/smartercodes-repo/automation-validation-tests.git
   ```

2. **Navigate into the project directory:**
   ```bash
   cd automation-validation-tests
   ```

3. **Install dependencies:**
   Install required internal NPM packages (including Playwright core packages):
   ```bash
   npm install
   ```

4. **Install Playwright Browsers:**
   Playwright requires specific browser binaries (Chromium, Firefox, WebKit) to run the tests. Install them using:
   ```bash
   npx playwright install
   ```

5. **Set up Environment Variables:**
   You will need to set up the environment variables to run the tests locally. 
   Create a new file named `.env` in the root directory (at the same level as `package.json`).
   Copy the following contents into the `.env` file and update the credentials as needed:
   ```env
   MS_EMAIL=your-microsoft-email
   MS_PASSWORD=your-microsoft-password
   BASE_URL=https://app-v2-rc1-aw.smarter.codes

   # Matches a placeholder like <some_TEXT>
   PLACEHOLDER_REGEX=<\s*([^<>]+?)\s*>
   ```

## Running Tests

Once the setup is complete, you can run the tests using Playwright. 
Tests are configured to run in **headed** mode (you will see the browser interacting with the UI). 

- **Run all tests:**
  ```bash
  npx playwright test
  ```

- **Run a specific test file:**
  ```bash
  npx playwright test tests/AW_06_destination_template.spec.ts
  ```

- **Run tests in Playwright UI Mode (Interactive & Recommended):**
  This opens an interactive graphical UI where you can explore, click to run, and visually debug tests step-by-step.
  ```bash
  npx playwright test --ui
  ```

## Viewing HTML Reports and Traces

Playwright is configured to automatically generate an **HTML Report** and capture **Traces** (which include logs, DOM snapshots, screenshots, and network requests) for analysis.

1. **View the HTML Report:**
   After tests finish running, view the fully detailed HTML report using:
   ```bash
   npx playwright show-report
   ```
   *The report will automatically start a local server and open in your default browser.*

2. **View test Traces:**
   Traces are embedded directly inside the HTML report. 
   - Open the HTML Report using the command above.
   - Click on any specific test case (passed or failed).
   - Scroll down to the **Traces** section at the bottom.
   - Click the trace image link to open the full **Playwright Trace Viewer**. This allows you to visually step back and forth in time through the exact test execution timeline.
