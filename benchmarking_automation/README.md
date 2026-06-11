# Benchmarking Automation

Automated pipeline for analyzing DOCX documents — extracting placeholders, classifying them, matching against generated output, and producing detailed replacement reports.

---

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the Pipeline](#running-the-pipeline)
  - [Option 1: Full Document Replacement Pipeline](#option-1-full-document-replacement-pipeline)
  - [Option 2: Individual Pipelines](#option-2-individual-pipelines)
- [Running Tests](#running-tests)
- [Output Files](#output-files)
- [Sample Test Documents](#sample-test-documents)

---

## Overview

This project processes DOCX templates and generated DOCX documents through a multi-stage pipeline:

1. **Placeholder Extraction** — Parses a DOCX template and builds a canonical document tree, identifies placeholder fields.
2. **Classification** — Classifies each placeholder by type (structural, syntax-based rules, etc.).
3. **Resolution** — Matches template placeholders against a generated DOCX and resolves their locations.
4. **Replacement Extraction** — Extracts replaced text fragments and builds an inventory.
5. **Reporting** — Exports results as JSON and Excel reports.

---

## Project Structure

```
benchmarking_automation/
├── app/                          # Pipeline orchestration
│   ├── pipeline.py               # Placeholder detection pipeline
│   ├── classification_pipeline.py
│   ├── document_replacement_pipeline.py
│   └── placeholder_resolution_pipeline.py
├── classification/               # Placeholder classification logic
├── doc_parser/                   # DOCX parsing & canonical tree builder
├── models/                       # Data models / node types
├── parser/                       # Additional parsing utilities
├── placeholders/                 # Placeholder extractor & context
├── replacement_extraction/       # Extracts replacements from resolved matches
├── replacement_reporting/        # JSON + Excel report generation
├── replacement_resolution/       # Matching engine & scoring
├── reporting/                    # Reporting utilities & exporters
├── tests/                        # Test scripts & sample documents
├── output/                       # Pipeline output (JSON, Excel)
├── final_outputs/                # Final replacement reports
├── _docs/                        # Internal documentation
├── main.py                       # Entry point (classification pipeline)
└── requirements.txt              # Python dependencies
```

---

## Prerequisites

- **Python 3.10+**
- **pip** (Python package installer)
- **Git** (for cloning)

---

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd automation-validation-tests/benchmarking_automation
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
```

### 3. Activate the virtual environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
.\venv\Scripts\activate.bat
```

**Linux / macOS:**
```bash
source venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

---

## Running the Pipeline

### Option 1: Full Document Replacement Pipeline

This runs all stages end-to-end — placeholder extraction, classification, resolution, replacement extraction, and reporting.

```bash
python tests/run_document_replacement_pipeline.py
```

By default it uses:
- **Template:** `tests/CSR_Template_20FEB2026.docx`
- **Generated doc:** `tests/CSR_1133_19_SB_raw.docx`
- **Output directory:** `final_outputs/`

### Option 2: Individual Pipelines

#### a) Placeholder Extraction Pipeline

Extracts placeholders from a DOCX template and exports a JSON inventory.

```bash
python tests/us01_s4_run_pipeline.py
```

**Input:** `tests/CSR_Template_20FEB2026.docx`  
**Output:** `tests/output/inventory.json`

#### b) Classification Pipeline

Classifies the placeholder inventory (from `main.py` or via `us01_s4_run_pipeline.py`).

```bash
python main.py
```

**Input:** `tests/output/inventory.json`  
**Outputs:**
- `output/classified_inventory.json`
- `output/classified_inventory.xlsx`

#### c) Placeholder Resolution Pipeline

Resolves placeholders against a generated document tree.

```bash
python tests/replacement_resolution/scc_243_run_resolution_pipeline.py
```

---

## Running Tests

Run individual test suites with **pytest**:

```bash
# Placeholder extraction tests
pytest tests/test_parser.py -v
pytest tests/test_canonical_document_builder.py -v
pytest tests/test_ph_detect_ctx_ext.py -v
pytest tests/test_us01_subtask4.py -v

# Classification tests
pytest tests/classification/test_determinism.py -v
pytest tests/classification/test_syntax_rules.py -v
pytest tests/classification/test_structural_classifier.py -v

# Document parser tests
pytest tests/doc_parser/test_rich_run_extraction.py -v
pytest tests/doc_parser/test_canonical_document_builder.py -v

# Resolution tests
pytest tests/replacement_resolution/test_placeholder_resolver.py -v
pytest tests/replacement_resolution/test_resolution_pipeline.py -v

# Replacement extraction tests
pytest tests/replacement_extraction/test_replacement_extractor.py -v

# Reporting tests
pytest tests/replacement_reporting/test_replacement_reporting.py -v
```

Run all tests at once:

```bash
pytest tests/ -v
```

---

## Output Files

### After running `main.py` (Classification Pipeline)

| File | Description |
|------|-------------|
| `output/classified_inventory.json` | Classified placeholder inventory (JSON) |
| `output/classified_inventory.xlsx` | Classified placeholder inventory (Excel) |

### After running the full document replacement pipeline

| File | Description |
|------|-------------|
| `final_outputs/replacement_inventory.json` | Complete replacement inventory (JSON) |
| `final_outputs/replacement_inventory.xlsx` | Complete replacement inventory (Excel) |
| `final_outputs/replacement_fragment_store.json` | Extracted text fragments |

### Intermediate pipeline outputs

| File | Description |
|------|-------------|
| `tests/output/inventory.json` | Raw placeholder inventory (before classification) |
| `output/placeholders.json` | Detected placeholders |
| `output/placeholders_arch_a.json` | Placeholders (architecture A) |
| `output/placeholders_arch_b.json` | Placeholders (architecture B) |
| `output/canonical_tree.json` | Canonical document tree |
| `output/parsed_summary.json` | Parsed document summary |
| `output/placeholder_resolution.json` | Resolution results |

---

## Sample Test Documents

The `tests/` directory includes several DOCX files for testing:

| File | Purpose |
|------|---------|
| `basic_sample_template.docx` | Simple template for basic placeholder detection |
| `Adv_Sample_Template.docx` | Advanced template with complex structure |
| `CSR_Template_20FEB2026.docx` | CSR template (used by default in the pipeline) |
| `CSR_1133_19_SB_raw.docx` | Generated CSR document (used by default for comparison) |
| `empty_template.docx` | Edge case — empty document |
| `invalid.docx` | Edge case — invalid/corrupt file |
| `unsupported_content.docx` | Edge case — unsupported content types |