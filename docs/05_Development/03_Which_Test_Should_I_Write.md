# 03. Which Test Should I Write?

Don't guess where your test goes. Ask yourself what you are trying to prove:

* **Need to test a helper function?** (e.g., date formatting, math, env validation)
  → **Component Test**. Extremely fast. No browser needed.
* **Need to test an Express endpoint?** (e.g., testing that `/api/users` returns JSON)
  → **API Test**. Very fast. Uses HTTP requests, no UI.
* **Need to test Docker + Server?** (e.g., making sure `develop.sh up` actually starts the database)
  → **Integration Test**. Proves the moving parts talk to each other.
* **Need to test a full user workflow?** (e.g., Login -> Click button -> Download file)
  → **E2E Test**. Slow but thorough. Emulates a real human.
* **Need to validate a customer environment?** (e.g., making sure the 'IDEAYA' folder exists in SharePoint)
  → **Health Test**. Runs against live environments to catch configuration drift.
* **Need to verify local setup?** (e.g., is Node installed?)
  → **Diagnostic Test**.Where Should New Tests Go?
* **New helper function?**
  → `tests/helpers/__tests__/`
* **New API endpoint?**
  → `tests/api/`
* **New customer validation?**
  → `tests/health/`
* **New Docker workflow?**
  → `tests/integration/`
* **New user workflow?**
  → `tests/e2e/`
