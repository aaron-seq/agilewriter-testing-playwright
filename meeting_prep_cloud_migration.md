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
