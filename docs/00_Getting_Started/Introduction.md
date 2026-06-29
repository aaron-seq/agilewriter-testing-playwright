# AgileWriter Automation Suite

## 1. Why This Exists

If you work on AgileWriter, you know that generating a Clinical Study Report (CSR) or an Informed Consent Form (ICF) takes time. It involves uploading complex source documents, waiting for the AI to train, and downloading a massive Word document.

If a developer accidentally breaks the upload button, or a prompt engineer degrades the AI's intelligence, how do we find out before our customers do?

**This repository is the answer.** 

It is an automated "robot user" that logs into AgileWriter every day, uploads real clinical documents, clicks "Generate", waits for the AI, and then mathematically scores the output to prove that the system is healthy and the AI is smart.

## 2. Mental Model

Think of this repository as two separate robots working side-by-side:

1. **The Driver (Node.js & Playwright)**
   This robot knows how to use a web browser. It logs in via Microsoft SSO, clicks buttons in the AgileWriter UI, and downloads the final `.docx` files. It is responsible for **Health Tests** (proving the website isn't broken).
   
2. **The Grader (Python)**
   This robot doesn't know what a browser is. It takes the `.docx` files downloaded by the Driver, reads every paragraph, and compares them against a perfect "answer key" provided by our data scientists. It is responsible for **Accuracy Scoring** (proving the AI isn't hallucinating).

## 3. Real Example: What Does This Actually Look Like?

If you run this suite, you aren't just running unit tests. You will literally watch a Chromium browser open on your screen:
1. It navigates to `https://qa.agilewriter.com`
2. It types in an `@company.com` email address.
3. It selects the "CSR_Template_v2.docx" from SharePoint.
4. It clicks "Generate" and waits 20 minutes for the progress bar to finish.

When it finishes, it generates a stakeholder-friendly report like this:
```text
TEST: CSR Generation Health
ENVIRONMENT: QA
TESTER: Jenkins Automation
STATUS: PASS (18/18 steps successful)
```

## 4. Step-by-Step Workflow: How to Learn This Repository

If you are new here, do not try to read everything at once. Read the documentation in this exact order:

### Step 1: Getting Started (You are here)
* [Architecture.md](Architecture.md) - Learn how the Node server, Playwright, and Python scripts talk to each other.
* [Setup.md](Setup.md) - Install Docker and get your `.env` credentials ready.
* [Quick_Start.md](Quick_Start.md) - Run your very first 2-minute test to prove your laptop is configured correctly.

### Step 2: The Developer Handbook
* [Codebase_Map.md](../01_Developer_Handbook/Codebase_Map.md) - A guided tour of the folders in this repository so you don't get lost.
* [Testing_Strategy.md](../01_Developer_Handbook/Testing_Strategy.md) - Learn the difference between Health Tests and Accuracy Validations.
* [Execution_Flows.md](../01_Developer_Handbook/Execution_Flows.md) - Learn how to use the UI Dashboard vs the CLI.

### Step 3: Deep Dives (When you need them)
* [Troubleshooting_Guide.md](../04_Operations/Troubleshooting_Guide.md) - Read this immediately if a test fails.
* [Health_Pipeline_Deep_Dive.md](../03_System_Deep_Dives/Health_Pipeline_Deep_Dive.md) - Read this if you want to understand why tests take 30 minutes to run.

## 5. Common Mistakes

* **Assuming this is a typical unit testing repo:** It is not. Tests here take 10 to 30 minutes because they wait for real AI models to train. Patience is a requirement.
* **Skipping `.env` configuration:** You cannot run a single test without a valid Microsoft account and SharePoint paths defined in your `.env` file.

## 6. Troubleshooting

If you are feeling overwhelmed:
* **Stop.** Do not try to read the Python accuracy code if you are just a QA engineer trying to run a health check.
* **Go to Quick Start.** Just get the UI Dashboard running on `localhost:3000`. The UI is designed to hide the complexity from you until you are ready for it.

## 7. Key Takeaways

* This repository proves AgileWriter works by acting like a real human user.
* It uses Playwright (Node.js) to drive the browser and Python to grade the AI.
* Start with `Setup.md` and `Quick_Start.md`.

---

Document Status: Canonical
Owner: Documentation Team
Last Reviewed: 2026-06-17
