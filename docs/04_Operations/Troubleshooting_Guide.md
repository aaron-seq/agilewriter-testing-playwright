# Troubleshooting Guide

## 1. Why This Exists

When the automation suite breaks, you need to know whether the problem is your local environment, the test script itself, or the AgileWriter application being down. 

This guide provides concrete, copy-pasteable commands and diagnostic steps to identify and fix the most common errors.

> [!WARNING]
> **Never blindly retry a failing test.**
> If a test fails, you must collect the error message first. Blindly retrying often masks the root cause and clutters the session logs.

## 2. Mental Model

When troubleshooting, isolate the failure by walking down the stack:

1. **The Container**: Is Docker actually running the Node server?
2. **The Environment**: Did `validateHealthEnv` reject your `.env` configuration?
3. **The Browser**: Did Playwright crash while trying to log in?
4. **The Application**: Did AgileWriter hang during AI training?
5. **The Reporting**: Did the Word document fail to compile?

Find the layer where the error occurred and apply the fixes below.

## 3. Real Example: Troubleshooting a Missing Environment Variable

Here is the most common error you will see:

```text
Error: [validateHealthEnv] Missing required env vars for 'csr': HEALTH_TEMPLATE_CSR
    at validateHealthEnv (/app/utils/validateHealthEnv.ts:70:11)
```

**How to read this:**
The test never even launched a browser. The environment guard (`validateHealthEnv.ts`) checked your `.env` file for `HEALTH_TEMPLATE_CSR` and found it empty or missing. 
**The fix:** Open `.env`, populate the variable, and rerun.

## 4. Troubleshooting by Symptom

### Symptom: Docker Container Fails to Start or Exits Immediately
* **Error**: `docker-compose up` fails, or `localhost:3000` is unreachable.
* **Diagnosis**: Usually a port conflict (port 3000 is in use) or a stale container volume.
* **Fix**: 
  1. Check logs: `docker-compose logs`
  2. If the port is in use, kill the process using it.
  3. Hard restart Docker: 
     ```bash
     docker-compose down -v
     docker-compose up --build
     ```

### Symptom: Playwright Fails to Launch ("browserType.launch: Executable doesn't exist")
* **Error**: The system complains it cannot find Chromium.
* **Diagnosis**: The Playwright browsers were not installed in the container or on your local machine.
* **Fix**: Run `npx playwright install --with-deps` inside the container (or locally if not using Docker).

### Symptom: The Test Hangs Forever on "Waiting for training completion"
* **Diagnosis**: Either AgileWriter is under heavy load, or the UI changed (e.g., the spinner element was renamed) and Playwright doesn't know the training finished.
* **Fix**: 
  1. If running locally, change `headless: true` to `headless: false` in `playwright.config.js` to watch the browser.
  2. Look at the AgileWriter UI. Is it still training? If yes, wait. If it's done but Playwright is still waiting, the DOM selector in `helpers/training-setup.ts` needs to be updated.

### Symptom: The Generated Report is Missing or Empty
* **Error**: You clicked "Download Report" but nothing happens, or the report says "0 Steps".
* **Diagnosis**: The Playwright process crashed so violently that the `step-results.json` file was never saved to the `sessions/` folder.
* **Fix**: Check the `sessions/` folder on your host machine. If it is empty, you must check the terminal where the Node server is running for the raw crash stack trace.

### Symptom: Playwright Fails Because of "No display server"
* **Error**: `browserType.launch: undefined missing X server or $DISPLAY`
* **Diagnosis**: You tried to run Playwright in `headed` mode inside a Docker container. Docker containers do not have screens.
* **Fix**: Set `PLAYWRIGHT_HEADLESS=true` in your `.env` file when running in Docker.

## 5. Escalation Guidance

If you cannot resolve the issue using this guide:

1. **Save the Session Logs**: Zip the entire `sessions/<SESSION_ID>` folder.
2. **Screenshot the Terminal**: Capture the raw error output.
3. **Escalate**: Provide the logs, the environment you targeted (`BASE_URL`), and the exact test name to the Automation Engineering team.

## 6. Key Takeaways

* Start debugging by checking `docker-compose logs`.
* The `validateHealthEnv` error is your friend—it saves you from 20-minute silent failures.
* If you are in Docker, you cannot watch the browser natively (use `headless: true`).

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
