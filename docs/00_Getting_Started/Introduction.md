Document Status: Canonical
Related Legacy Docs: TBD

# AgileWriter Automation Suite

## What Is This Repository

The AgileWriter Automation Suite is a validation layer designed to provide end-to-end regression, health, and accuracy validation for AgileWriter. It contains two distinct ecosystems operating in parallel: a Node.js and Playwright automation suite for driving frontend validation workflows, and a Python benchmarking suite for evaluating backend outputs. This repository executes automated test paths against the AgileWriter application, mimicking human interaction to verify that document templates, data sources, and system pipelines process clinical inputs correctly. 

## Why It Exists

AgileWriter is an AI-assisted document generation platform utilized in pharmaceutical and clinical research workflows by Medical Writers and Clinical Operations teams. When generating clinical and regulatory documents, such as Clinical Study Reports (CSR), Informed Consent Forms (ICF), and M264 templates, output reliability is a strict requirement. This repository exists to give engineering and QA teams measurable confidence that the AgileWriter application behaves correctly, the training pipelines remain operational, and the generated outputs meet expected quality thresholds before business users rely on the generated documents.

## Who This Documentation Is For

This documentation is prioritized for the following audiences, in order:

1. **New Developers:** To understand the repository architecture and successfully execute an initial health script.
2. **QA Engineers:** To run existing validation workflows and accurately interpret the generated outputs.
3. **Automation Engineers:** To safely maintain and extend the testing suite with new document models or pipeline checks.

## How This Suite Is Organized

```text
AgileWriter Automation Suite
├── 00_Getting_Started/         - Core onboarding, repository architecture, and initial execution instructions
├── 01_Developer_Handbook/      - Codebase map, environment variables, and execution context
├── 02_User_Guides/             - Instructions for running the UI, health checks, and accuracy scoring
├── 03_System_Deep_Dives/       - Technical details on health, accuracy, training, and reporting pipelines
├── 04_Operations/              - Troubleshooting guides, known issues, and recovery procedures
├── 05_Development/             - Guides for extending the suite with new tests and health scripts
├── 06_Change_Log/              - Architecture decision records, migration logs, and release notes
└── appendix/                   - Glossary, file index, and frequently asked questions
```

Start at [Quick_Start.md](../00_Getting_Started/Quick_Start.md)
