# Cloud Migration Meeting Prep: AgileWriter Automation

Moving a heavy Playwright E2E suite (with 20-45 minute test durations) to the cloud requires careful planning. This guide breaks down exactly what you need to ask and present during your meeting to ensure a smooth transition to GCP or Azure.

---

## 1. Technical Requirements (What the suite needs to run)

### Compute (Where the tests actually run)
- **Requirement:** A containerized environment capable of running Playwright browsers.
- **Challenge:** AgileWriter health scripts take a long time (e.g., M264 takes ~55 mins). Some serverless platforms (like GCP Cloud Run) have strict execution timeout limits (max 60 mins).
- **GCP Options:** Google Kubernetes Engine (GKE) or Compute Engine (VMs).
- **Azure Options:** Azure Container Instances (ACI), Azure Kubernetes Service (AKS), or Azure VMs. Azure DevOps self-hosted agents are also a strong option.

### Authentication & Secrets
- **Requirement:** Secure storage for `MS_EMAIL`, `MS_PASSWORD`, and API keys.
- **Challenge:** The suite currently uses a saved authentication state (`playwright/.auth/user.json`). You need a strategy for headless authentication. Microsoft 365 MFA (Multi-Factor Authentication) blocks automated logins.
- **Solution needed:** Service Accounts, App Passwords, or Conditional Access Policies in Azure AD to allow the automation account to log in without MFA.
- **Cloud Tools:** Azure Key Vault or GCP Secret Manager.

### Storage & Artifacts
- **Requirement:** A place to store test outputs.
- **Artifacts generated:** Playwright HTML reports, downloaded Word documents, Raw QA Excel files, and Accuracy Scorer JSON/Excel reports.
- **Cloud Tools:** Azure Blob Storage or Google Cloud Storage (GCS). You will need to configure the test runner to upload the `reports/` folder to the bucket after execution.

### CI/CD Pipeline & Triggers
- **Requirement:** How are the tests kicked off?
- **Options:** 
  1. **Scheduled:** Run nightly via cron job.
  2. **Event-driven:** Triggered automatically when developers deploy a new version of AgileWriter.
  3. **On-Demand:** Hosting Inayathulla ji's UI on an App Service / Cloud Run so QA can click a button to start a run.

---

## 2. How to Direct the Meeting (Agenda)

Use this agenda to control the conversation and ensure you get the answers you need from DevOps/Stakeholders.

### Item 1: Infrastructure & Compute Limits
> **Ask the team:** *"Our M264 and CSR health scripts can take up to 55 minutes to complete due to SharePoint/AI training times. Are we leaning towards Azure or GCP? We need a compute service that won't timeout after 15-30 minutes."*
*   **Goal:** Steer them away from short-lived serverless functions toward persistent containers (ACI/GKE) or dedicated VMs.

### Item 2: Microsoft 365 Authentication (Crucial!)
> **Ask the team:** *"Currently, the automation logs into SharePoint using a Microsoft account. How will we handle MFA (Multi-Factor Authentication) in the cloud?"*
*   **Goal:** Get a commitment from IT/Security to provide a dedicated "Service Account" with MFA disabled or IP-whitelisted, otherwise the headless browsers will get stuck at the 2FA prompt.

### Item 3: Exposing the Test Runner UI
> **Ask the team:** *"Inayathulla ji built a great Web UI to trigger tests and view logs. Do we want to host this UI internally so QA can trigger tests on-demand?"*
*   **Goal:** Decide if the automation will be hidden inside a CI/CD pipeline (like Azure DevOps / GitHub Actions) or if it will be a deployed internal web app.

### Item 4: Reference Data & Artifact Storage
> **Ask the team:** *"The Accuracy Scorer uses Reference Excel files, and generates QA Excel reports and Word documents. Should we store the Reference files in the Git repo, and where should we upload the final generated reports for Anil ji to view?"*
*   **Goal:** Establish a blob storage bucket (Azure Blob / GCS) and get the connection strings so you can update `accuracy.spec.ts` to push reports to the cloud.

---

## 3. What You Need to Change in the Code (Next Steps)

Once they choose the cloud provider, you will likely need to:
1. **Create a `Dockerfile`**: Based on `mcr.microsoft.com/playwright:v1.58.2-focal`.
2. **Update `playwright.config.js`**: Ensure `headless: true` is forced in CI environments.
3. **Add Cloud Storage Uploads**: Add a script that runs after the tests finish to zip the `reports/` folder and upload it to Azure Blob or GCS so stakeholders can download the Accuracy Excel files.
