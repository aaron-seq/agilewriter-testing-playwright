# Benchmarking Automation

Automated pipeline for analyzing DOCX templates against AI-generated DOCX documents — extracting placeholders, classifying them, matching template placeholders to generated content, and producing detailed replacement and accuracy reports.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the Pipeline](#running-the-pipeline)
  - [Option 1: Full Document Replacement Pipeline (End-to-End)](#option-1-full-document-replacement-pipeline-end-to-end)
  - [Option 2: Accuracy Comparison (Pipeline vs QA)](#option-2-accuracy-comparison-pipeline-vs-qa)
  - [Option 3: Individual Pipelines](#option-3-individual-pipelines)
- [Resolution & Matching Strategy](#resolution--matching-strategy)
- [Running Tests](#running-tests)
- [Output Files](#output-files)
- [Accuracy Report](#accuracy-report)
- [Sample Test Documents](#sample-test-documents)

---

## Overview

This project processes a **DOCX template** (containing `<Placeholder>` tags) and a **generated DOCX** (where the AI has replaced those placeholders with actual content) through a multi-stage pipeline:

1. **Placeholder Extraction** — Parses the template DOCX, builds a canonical document tree, and identifies all placeholder fields.
2. **Classification** — Classifies each placeholder by type (KeyValue, Paragraph, Table, List, etc.) using syntax rules and structural analysis.
3. **Resolution** — Matches template placeholders against the generated document to find where each placeholder's content was placed.
4. **Replacement Extraction** — Extracts the AI-replaced text content from the generated document.
5. **Export** — Produces JSON and Excel reports mapping template placeholders to their replacement content.

An **accuracy comparison** script can also compare pipeline results against a manually-prepared QA report to measure coverage, type accuracy, and content match rates.

---

## Architecture

### Pipeline Data Flow

```
Template DOCX                              Generated DOCX
    |                                            |
    v                                            v
+----------------------+              +----------------------+
|  doc_parser/         |              |  doc_parser/         |
|  (DOCX > Canonical   |              |  (DOCX > Canonical   |
|   Tree)              |              |   Tree)              |
+----------------------+              +----------------------+
         |                                       |
         v                                       |
+----------------------+                         |
|  placeholders/       |                         |
|  (Tree > Inventory)  |                         |
|  [Extracts all       |                         |
|   <placeholder>      |                         |
|   tags from para,    |                         |
|   list_item, cell]   |                         |
+----------------------+                         |
         |                                       |
         v                                       |
+----------------------+                         |
|  classification/     |                         |
|  (Syntax + Structural)|                        |
|  [Assigns type to    |                         |
|   each placeholder]  |                         |
+----------------------+                         |
         |                                       |
         v                                       v
+-------------------------------------------------------+
|  replacement_resolution/                               |
|  [Matches template placeholders to                     |
|   generated document nodes]                            |
|                                                        |
|  Strategy:                                              |
|  1. LABEL MATCH: Scan generated doc for                |
|     "Label: Value" patterns; match placeholder         |
|     name to label text                                 |
|  2. CONTENT SEARCH: Search all nodes for               |
|     placeholder name words                              |
|  3. STRUCTURAL: Section/table_path/context             |
|     based matching as fallback                         |
+-------------------------------------------------------+
         |
         v
+-------------------------------------------------------+
|  replacement_extraction/                               |
|  [Type-specific extractors extract replaced content]    |
|  - KEYVALUE: Extract precise value after colon         |
|  - PARAGRAPH: Full paragraph text                      |
|  - LIST: List items                                    |
|  - TABLE/TABLE_CELL: Table content                     |
|  - FIGURE: Caption/image ref                           |
+-------------------------------------------------------+
         |
         v
+-------------------------------------------------------+
|  replacement_reporting/                                |
|  [JSON + Excel export with schema validation]          |
+-------------------------------------------------------+
         |
         v
+-------------------------------------------------------+
|  compare_accuracy.py                                   |
|  [Compare pipeline output vs QA report]                |
|  Output: accuracy_report.xlsx                          |
+-------------------------------------------------------+
```

---

## Project Structure

```
benchmarking_automation/
├── app/                              # Pipeline orchestration
│   ├── pipeline.py                   # Placeholder detection pipeline
│   ├── classification_pipeline.py    # Classification pipeline
│   ├── document_replacement_pipeline.py  # Full end-to-end pipeline
│   └── placeholder_resolution_pipeline.py  # Resolution pipeline
├── classification/                   # Placeholder classification logic
│   ├── classifier.py                 # Main classifier orchestrator
│   ├── registry.py                   # Rule registry
│   ├── precedence.py                 # Rule precedence definitions
│   ├── base_rule.py                  # Abstract base rule
│   ├── result_builder.py             # Output enrichment
│   ├── syntax/                       # Syntax-based rules (high priority)
│   │   ├── table_rules.py
│   │   ├── tables_rules.py
│   │   ├── figure_rules.py
│   │   └── list_rules.py
│   ├── structural/                   # Structural rules (fallback)
│   │   ├── structural_classifier.py
│   │   ├── table_cell_rules.py
│   │   ├── paragraph_rules.py
│   │   ├── keyvalue_rules.py
│   │   └── list_rules.py
│   └── models/                       # Classification data models
├── doc_parser/                       # DOCX parsing & canonical tree
│   ├── xml_parser.py                 # XML extraction + helper functions
│   ├── node_builder.py               # Canonical tree builder
│   ├── hierarchy_builder.py          # Node construction + context
│   ├── run_normalizer.py             # Rich run extraction + merging
│   ├── docx_extractor.py             # .docx ZIP extraction
│   └── xml_models.py                 # Parsed document models
├── models/                           # Core data models
│   └── nodes.py                      # DocumentNode, Location, ContextWindow, RichTextRun
├── placeholders/                     # Placeholder extraction
│   ├── extractor.py                  # Main extractor (traverses tree, finds placeholders)
│   ├── validator.py                  # Regex pattern for <placeholder> detection
│   ├── occurrence_generator.py       # Unique ID generation
│   └── context_extractor.py          # Inline context extraction
├── replacement_extraction/           # Content extraction from generated doc
│   ├── extractor.py                  # Main extraction engine
│   ├── resolved_node_extractor.py    # O(1) node lookup
│   ├── fragment_builder.py           # Fragment record builder
│   ├── formatting_serializer.py      # Run formatting serializer
│   └── extractors/                   # Type-specific extractors
│       ├── keyvalue.py               # KEYVALUE: extracts value after label pattern
│       ├── paragraph.py              # PARAGRAPH: full paragraph text + formatting
│       ├── table_cell.py             # TABLE_CELL: cell content
│       ├── list.py                   # LIST: list items + content
│       ├── table.py                  # TABLE: rows + style
│       └── figure.py                 # FIGURE: caption + image ref
├── replacement_resolution/           # Placeholder-to-generated-doc matching
│   ├── resolver.py                   # **Main resolver: label + content + structural**
│   ├── matching_engine.py            # Content-first scoring + structural scoring
│   ├── scoring.py                    # Weighted scoring model (threshold: 0.30)
│   └── models.py                     # ResolutionResult + CandidateMatch
├── replacement_reporting/            # Final export
│   ├── export_service.py             # Orchestrates JSON + Excel export
│   ├── json_reporter.py              # JSON export
│   ├── excel_reporter.py             # Excel export
│   ├── query_service.py              # Query support
│   └── schema_validator.py           # Schema validation
├── reporting/                        # Intermediate reporting
│   ├── inventory_builder.py          # Inventory orchestration
│   ├── json_reporter.py              # JSON generation
│   ├── export_service.py             # File export
│   ├── excel_reporter.py             # Excel export
│   ├── classified_inventory_reporter.py
│   ├── schema_validator.py           # Schema validation
│   └── placeholder_resolution_reporter.py
├── tests/                            # Test suite & sample documents
│   ├── ICF_docx/                     # ICF template + QA report
│   ├── output/                       # Intermediate test outputs
│   ├── classification/               # Classification tests
│   ├── doc_parser/                   # DOCX parser tests
│   ├── replacement_extraction/       # Extraction tests
│   ├── replacement_reporting/        # Reporting tests
│   ├── replacement_resolution/       # Resolution tests
│   ├── run_document_replacement_pipeline.py  # Pipeline entry point
│   └── us01_s4_run_pipeline.py       # Extraction-only entry point
├── final_outputs/                    # Pipeline output directory
│   ├── replacement_inventory.json    # Complete replacement mapping
│   ├── replacement_inventory.xlsx    # Excel version
│   ├── replacement_fragment_store.json  # Text fragments
│   └── accuracy_report.xlsx          # Comparison with QA (when run)
├── output/                           # Intermediate outputs
├── _docs/                            # Internal documentation
├── compare_accuracy.py               # Pipeline-vs-QA comparison script
├── main.py                           # Classification pipeline entry point
└── requirements.txt                  # Python dependencies
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

### Option 1: Full Document Replacement Pipeline (End-to-End)

This runs all stages — placeholder extraction, classification, resolution, replacement extraction, and export.

```bash
python tests/run_document_replacement_pipeline.py
```

By default it uses:
- **Template:** `tests/ICF_docx/ICF_SET0 (1).docx`
- **Generated doc:** `tests/ICF_docx/ICF_Full_output_01.docx`
- **Output directory:** `final_outputs/`

### Option 2: Accuracy Comparison (Pipeline vs QA)

After running the pipeline, compare results against a manually-prepared QA report:

```bash
.\venv\Scripts\python.exe compare_accuracy.py
```

The script reads:
- **Pipeline output:** `final_outputs/replacement_inventory.xlsx`
- **QA report:** `tests/ICF_docx/QA report_ICF_FULL_0804 - Copy - Copy (2).xlsx`

Output: `final_outputs/accuracy_report.xlsx` with sheets for:
- **QA vs Pipeline Comparison** — Full comparison with similarity scores
- **Missing in Pipeline Output** — QA entries not found in pipeline
- **Extra in Pipeline (not in QA)** — Pipeline entries not in QA
- **Summary** — Coverage rate, Type accuracy, Content match rate

### Option 3: Individual Pipelines

#### a) Placeholder Extraction Only

```bash
python tests/us01_s4_run_pipeline.py
```

**Input:** `tests/CSR_Template_20FEB2026.docx`
**Output:** `tests/output/inventory.json`

#### b) Classification Only

```bash
python main.py
```

**Input:** `tests/output/inventory.json`
**Outputs:** `output/classified_inventory.json`, `output/classified_inventory.xlsx`

#### c) Resolution Only

```bash
python tests/replacement_resolution/scc_243_run_resolution_pipeline.py
```

---

## Resolution & Matching Strategy

The resolver (`replacement_resolution/resolver.py`) uses a **three-phase matching strategy**:

### Phase 1: Label-Based Resolution (for KEYVALUE types)
Scans the generated document for `Label: Value` patterns (e.g., "Sponsor / Study Title: Stendarr, Inc."). When a placeholder's name (stripped of `< >`) matches a label in the generated document, the value after the colon is extracted directly. Handles compound labels like "Sponsor / Study Title".

### Phase 2: Content Search (for all types)
Searches all generated document nodes for words that appear in the placeholder name. The best-matching node (highest word overlap ratio) is selected, and the value after the corresponding label is extracted.

### Phase 3: Structural Matching (fallback)
For placeholders that can't be resolved by label/content matching, the structural matching engine is used:
- Compares section, table_path, neighbor context, type, node distance
- Content score (0-0.7 range) dominates, structural scores (0-0.6 range) are modifiers
- Threshold: **0.30** (lowered from 0.60 to accept partial matches)
- Table placeholders without context are no longer excluded

### Key Improvements Made

| Change | File | Impact |
|--------|------|--------|
| Added cell extraction | `placeholders/extractor.py` | Placeholders in table cells now detected |
| Lowered threshold 0.60→0.30 | `replacement_resolution/scoring.py` | More partial matches accepted |
| Removed table-without-context exclusion | `replacement_resolution/matching_engine.py` | Table placeholders can be resolved |
| Content-first matching | `replacement_resolution/matching_engine.py` | Text content dominates over structure |
| Label-based resolution | `replacement_resolution/resolver.py` | KEYVALUE types resolved by scanning generated doc for labels |
| Improved KEYVALUE extraction | `replacement_extraction/extractors/keyvalue.py` | Precise value extraction after colon |
| Fixed list extraction | `replacement_extraction/extractors/list.py` | Lists now return actual content |

---

## Running Tests

Run all tests at once:

```bash
pytest tests/ -v
```

Run individual test suites:

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

---

## Output Files

### After running the full document replacement pipeline

| File | Description |
|------|-------------|
| `final_outputs/replacement_inventory.json` | Complete replacement inventory (JSON) |
| `final_outputs/replacement_inventory.xlsx` | Complete replacement inventory (Excel) |
| `final_outputs/replacement_fragment_store.json` | Extracted text fragments with formatting |

### After running accuracy comparison

| File | Description |
|------|-------------|
| `final_outputs/accuracy_report.xlsx` | Pipeline vs QA comparison (4 sheets) |

### Intermediate pipeline outputs

| File | Description |
|------|-------------|
| `tests/output/inventory.json` | Raw placeholder inventory (before classification) |
| `output/classified_inventory.json` | Classified placeholder inventory |
| `output/classified_inventory.xlsx` | Classified placeholder inventory (Excel) |
| `output/placeholder_resolution.json` | Resolution results |

---

## Accuracy Report

The accuracy comparison (`compare_accuracy.py`) measures:

| Metric | Description |
|--------|-------------|
| **Coverage** | % of QA entries found in pipeline output |
| **Type Accuracy** | % of matched entries with correct placeholder type |
| **Content Match Rate** | % with exact replacement content match |
| **Content Partial** | % with >=80% similarity |
| **Content Mismatch** | % with content in both but different |

---

## Sample Test Documents

The `tests/` directory includes several DOCX files for testing:

| File | Purpose |
|------|---------|
| `ICF_docx/ICF_SET0 (1).docx` | ICF template with placeholders (default) |
| `ICF_docx/ICF_Full_output_01.docx` | Generated ICF document (AI-replaced content) |
| `basic_sample_template.docx` | Simple template for basic placeholder detection |
| `Adv_Sample_Template.docx` | Advanced template with complex structure |
| `CSR_Template_20FEB2026.docx` | CSR template |
| `CSR_1133_19_SB_raw.docx` | Generated CSR document |
| `empty_template.docx` | Edge case — empty document |
| `invalid.docx` | Edge case — invalid/corrupt file |
| `unsupported_content.docx` | Edge case — unsupported content types |