# 01. How Agile Writer Testing Works

Before you write a test, you need to understand how the system fits together.

### Repository Mental Model

A new engineer should understand this in 2 minutes:

```text
  Application (Agile Writer)
            |
            v
  Playwright Tests (Simulates the user)
            |
            v
  Step Tracker (Captures evidence)
            |
            v
  Result Files (Raw JSON telemetry)
            |
            v
  DOCX Report (Final stakeholder evidence)
```

1. **Playwright Specs**: The code you write. It pretends to be a human user.
2. **Agile Writer Application**: The actual UI and backend being tested.
3. **Step Tracker**: A utility we wrote (`tests/helpers/step-tracker.ts`) that listens to what Playwright does. It records:
   - screenshots
   - step names
   - execution timing
   - pass/fail evidence
   This data becomes `step-results.json`. The report generator later converts this into the final DOCX report.
4. **Result Files**: Raw JSON data saved to the `sessions/` folder.
5. **DOCX Report**: The final, human-readable Word document required for regulatory compliance.

### Architecture Boundaries

Do not confuse deployment strategies. Know these boundaries:

* **SCC-460:** Defines the Docker-based local deployment architecture.
* **SCC-461:** Adds `develop.sh` automation that consumes the SCC-460 architecture.
* **SCC-464:** Defines production deployment architecture.

### Understanding Test Output

After a test run finishes, what actually gets generated?

* **`sessions/step-results.json`**
  * **What it is:** A raw data dump of every click and assertion Playwright made.
  * **Who reads it:** `generate-word-report.js` and the Accuracy Scorer. You rarely read this manually.
* **`reports/report.docx`**
  * **What it is:** The final compliance artifact showing screenshots and Pass/Fail badges.
  * **Who reads it:** QA, Stakeholders, and Auditors. Inspect this if a test "passes" but the screenshots look wrong.
* **`report_manifest.json`**
  * **What it is:** A summary of which reports were generated successfully.
  * **Who reads it:** CI/CD pipelines to know which files to upload.

### Example Output Pipeline

If you are working with the Accuracy Scorer (e.g. for CSR validations), the pipeline extends further:

```text
health_CSR.spec.ts
        |
        v
step-results.json
        |
        v
generate-word-report.js
        |
        v
report.docx
        |
        v
accuracy-scorer
        |
        v
accuracy report
```
