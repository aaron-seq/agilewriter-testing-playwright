# 00. Engineer Quick Start

The absolute fastest way to get running.

### New Engineer First Day Guide
If you joined today, follow this exact sequence:
1. Read this **Quick Start**.
2. Read **01. How Agile Writer Testing Works**.
3. Run `./develop.sh up`.
4. Run one health script (e.g., `npx playwright test tests/health_CSR.spec.ts --headed`).
5. Open the HTML report (`npx playwright show-report`).
6. Read **03. Which Test Should I Write?**.

### Setup Instructions
1. **Clone and Install**
   ```bash
   git clone <repo>
   npm install
   ```
2. **Setup Credentials**
   Copy `.env.example` to `.env` and fill in `MS_EMAIL` and `MS_PASSWORD`.
   > [!WARNING]
   > Never commit `.env`! Your Microsoft credentials are in there.
3. **Install Browsers**
   ```bash
   npx playwright install --with-deps
   ```
4. **Start the Local Server** (If you aren't testing against QA/Staging)
   ```bash
   ./develop.sh up
   ```
5. **Run Your First Test (Headed Mode)**
   Watch the browser do the work:
   ```bash
   npx playwright test tests/AW_00_10_consolidated_flow.spec.ts --headed
   ```
