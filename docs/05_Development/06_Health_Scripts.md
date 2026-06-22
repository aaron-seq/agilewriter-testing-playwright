# 06. Health Scripts

Health scripts are the heart of our QA validation. They verify that the folders and files a client expects actually exist in SharePoint.

### Health Script Architecture Flow

```text
health_CSR.spec.ts
        |
        v
validateHealthEnv()
        |
        v
Browser Opens
        |
        v
Training Runs
        |
        v
step-tracker
        |
        v
step-results.json
        |
        v
generate-word-report.js
        |
        v
DOCX Report
```

### Example: Adding `health_Acme.spec.ts`

**Step 1: Add Variables**
Add `HEALTH_TEMPLATE_ACME` and `HEALTH_SOURCE_ACME` to `.env.example` and your `.env`.

**Step 2: Update the Gate**
Open `utils/validateHealthEnv.ts` and add 'acme' to the `REQUIRED_VARS` mapping.

**Step 3: Copy an Existing Script**
Copy `tests/health_Ideaya.spec.ts` and rename it to `tests/health_Acme.spec.ts`.

**Step 4: Replace Values**
Inside `health_Acme.spec.ts`, change the variables to use your new Acme environment variables.

**Step 5: Run the Script**
`npx playwright test tests/health_Acme.spec.ts`

**Expected Result:**
The test runs, verifies the Acme files exist, and a DOCX report appears in the `reports/` folder.
