# AgileWriter Health Report Walkthrough

## 1. Purpose
The health report automation system exists to ensure that the core AgileWriter document generation engine is working correctly, accurately, and consistently. Every week, this automated suite acts like a virtual user, logging into the system, processing standard document formats, and verifying that the AI is successfully finding and matching the required content. This saves hours of manual quality assurance work and catches backend performance issues or AI mapping failures before they impact actual end users.

## 2. What Gets Tested
The automated health check runs through 4 major document formats. For each format, the system verifies that the correct template is applied, the right sources are parsed, and the placeholders are successfully populated.

| Document Format | What the Test Verifies |
|-----------------|------------------------|
| **ICF Trimmed** | Verifies a shortened Informed Consent Form maps correctly against a standard clinical protocol. |
| **ICF Full** | Verifies a full-length Informed Consent Form maps correctly against a standard clinical protocol. |
| **CSR** | Verifies a Clinical Study Report structure can correctly parse multiple complex source documents (tables, protocol, and key messages). |
| **M264** | Verifies a Module 2.6.4 non-clinical summary document correctly maps against 7 different non-clinical source files. |

## 3. How to Read the Report
After a health check completes, the system automatically generates a Word document report. This report is your simple, visual receipt of the test's success.

When reviewing the report:
- **Green Placeholders:** The AI successfully found the right content in the source documents and matched it to the template. This is what we want to see.
- **Red Placeholders:** The content was not matched. This means the AI couldn't find the necessary information, and a human will need to review it.
- **Timestamps and Steps:** Every single action the virtual user took (from clicking "Start Training" to downloading the final document) is listed with an exact timestamp and a pass/fail status.
- **Summary Score:** At the top of the report, you will see a clear summary indicating the overall health and color distribution of the placeholders.

## 4. Current Test Results (as of April 22, 2026)

| Script | Status | Notes |
|--------|--------|-------|
| **ICF Trimmed** | ✅ Passing | Report generated successfully. The end-to-end flow is completely healthy. |
| **ICF Full** | 🔴 Backend issue | The backend hung during the "Populating Placeholders" stage. The automation correctly caught this 30+ minute infinite load. This has been reported to the dev team. |
| **CSR** | 🔴 Pending | The exact name of the source folder in SharePoint needs confirmation before the test can reliably find the source files. |
| **M264** | 🟡 Fix applied | A folder naming mismatch was discovered and fixed by the automation team. A re-run is scheduled to verify the fix. |

## 5. How Often to Run
We highly recommend running these 4 health checks **weekly**. Consistent weekly checks will ensure we maintain a reliable historical baseline of AgileWriter's performance.

If your team introduces a brand new document format, you do not need to write new code. You simply run our special "manual input" tool once, provide the new file names, and the system will automatically generate a permanent, reusable health script for that new format. You can then include it in the weekly health checks going forward.

## 6. Who to Contact
If you have questions about the health reports or notice any issues, please reach out to the relevant team member:

- **Test Automation & Scripting:** Aaron Sequeira
- **SharePoint & Document Setup:** Inayathulla Shaik Karaballa
- **System Escalation & Infrastructure Issues:** Shri Vignesh / Samyank
