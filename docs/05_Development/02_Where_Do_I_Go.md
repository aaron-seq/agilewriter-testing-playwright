# 02. Navigation and Troubleshooting

### "I want to..." Instant Navigation

* **I want to add a new health client**
  → Read: 06. Health Scripts, 05. TDD Guide
* **I want to debug authentication failures**
  → Read: 08. Local Debugging, 09. Playwright Features (Storage State)
* **I want to create an API test**
  → Read: 07. API Testing Guide
* **I want to run a test locally and watch it**
  → Read: 08. Local Debugging Guide
* **I want to know where to put my new test file**
  → Read: 03. Which Test Should I Write?, 04. Test Folder Guide

### Troubleshooting Matrix

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| `Missing HEALTH_TEMPLATE_IDEAYA` | You tried to run a health script, but your `.env` is missing variables. | Open `.env.example`, copy the missing IDEAYA variables to your `.env`, and fill them in. |
| Test fails after 10 seconds on login screen | Microsoft password expired or is wrong. | Update `MS_PASSWORD` in `.env`. Delete `playwright/.auth/user.json` to force a fresh login. |
| Button clicks but nothing happens | React hasn't updated its internal state yet. | Add a tiny wait or a `expect(button).toBeEnabled()` before clicking. |
| Playwright report shows empty blank page | The app crashed before rendering anything. | Check the server terminal logs or use API testing to check `/api/health`. |
