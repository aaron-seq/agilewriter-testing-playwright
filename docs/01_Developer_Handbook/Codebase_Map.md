> [!WARNING]
> **DEPRECATED DOCUMENT**
> This document is deprecated. Please refer to the new Testing and Developer Handbook located in `docs/05_Development/`.
> 
> * For codebase map/navigation, see `docs/05_Development/01_Navigation_Guide.md` and `02_Test_Folder_Guide.md`
> * For environment configuration, see `docs/05_Development/03_Local_Development.md`
> * For testing strategy, see `docs/05_Development/05_TDD_Guide.md` and `06_Creating_Tests.md`
> * For execution flows, see `docs/05_Development/07_Health_Scripts.md` and `09_Examples_and_Gotchas.md`

# Codebase Map

## 1. Why This Exists

If you are asked to "fix the timeout issue on the health check" or "add a new UI button," where do you even start looking?

This document provides a guided tour of the folders and files in this repository so you don't get lost. It also explicitly tells you which files are highly dangerous to touch, and which are safe to modify.

## 2. Mental Model

Think of this repository as a restaurant:

* **The Dining Room (`ui/`)**: Where the customer sits. It just shows the menu (the tests) and takes orders.
* **The Waiter (`server/`)**: Takes the order from the UI and hands it to the kitchen.
* **The Kitchen (`tests/`)**: The actual cooks (Playwright scripts) that do the work of driving the browser.
* **The Back Office (`benchmarking_automation/`)**: Completely separate from the restaurant. Analysts (Python scripts) reviewing the receipts (generated documents) to score accuracy.

## 3. The Folder Structure

Here is the 10,000-foot view of the repository:

| Folder                       | What it does                                                          | Who usually touches it? | Danger Level |
| :--------------------------- | :-------------------------------------------------------------------- | :---------------------- | :----------- |
| `tests/`                   | The actual Playwright automation scripts (`health_*.spec.ts`).      | Automation Engineers    | Medium       |
| `server/`                  | The Express backend (`test-runner-server.js`) that runs Playwright. | Core Maintainers        | High         |
| `ui/`                      | The HTML/JS for the `localhost:3000` dashboard.                     | Anyone                  | Low          |
| `benchmarking_automation/` | The Python Accuracy pipeline. Completely isolated from Playwright.    | Data Scientists         | Low          |
| `reports/`                 | Where generated `.docx` files are saved locally. (Git-ignored).     | Nobody (Auto-generated) | None         |
| `sessions/`                | Where Playwright writes raw telemetry JSON. (Git-ignored).            | Nobody (Auto-generated) | None         |

## 4. The Global "Danger" Files

If you touch these files, you can easily break the entire automation suite.

* **`.env.example`**
  * **What it is**: The template for local configuration.
  * **Why it's dangerous**: If you add a variable here but forget to add it to `validateHealthEnv.ts`, you create silent failures.
* **`playwright.config.js`**
  * **What it is**: The core engine configuration.
  * **Why it's dangerous**: It sets `workers: 1`. If you change this to run tests in parallel, session folders will collide and the server will crash.
* **`global-setup.js`**
  * **What it is**: Runs before any test starts. Handles Microsoft SSO login.
  * **Why it's dangerous**: If you break this, absolutely zero tests will be able to start.
* **`utils/validateHealthEnv.ts`**
  * **What it is**: The strict configuration gatekeeper.
  * **Why it's dangerous**: If you map the wrong required variables for a test, the test will abort immediately.

## 5. If You Need To Change X, Go To Y

Use this matrix to know exactly where to make your changes:

| If you want to...                                      | You need to edit...                                                                          |
| :----------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Change how long a test waits for AgileWriter** | `playwright.config.js` (Global) or `tests/health_*.spec.ts` (Local override)             |
| **Change the style of the Word report**          | `utils/generate-word-report.js`                                                            |
| **Add a new test to the dropdown**               | You don't! Just add a `health_*.spec.ts` file in `tests/`. The server auto-discovers it. |
| **Fix a Python parsing error**                   | `benchmarking_automation/doc_parser/`                                                      |
| **Change the UI colors**                         | `ui/styles.css`                                                                            |

## 6. Common Mistakes

* **Editing historical documentation**: If you find a document in `docs/legacy/`, do not edit it. Legacy docs are preserved as read-only historical context. Always edit the Canonical documents in `00` through `05`.
* **Hardcoding credentials in code**: Never put an email or password in `global-setup.js`. Always use `process.env`.
* **Committing the `reports/` folder**: Generated output should never be committed to Git. `reports/` and `sessions/` are explicitly added to `.gitignore`.

## 7. Key Takeaways

* Playwright logic lives in `tests/`.
* Python logic lives in `benchmarking_automation/`.
* The server acts as the glue.
* Respect the `.env` template rules.

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
