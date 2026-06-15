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
- [Resolution & Matching Strategy](#resolution--matching-strategy)
- [Debug Metrics](#debug-metrics)
- [Running Tests](#running-tests)
- [Output Files](#output-files)
- [Accuracy Report](#accuracy-report)
- [Sample Test Documents](#sample-test-documents)

---

## Overview

This project processes a **DOCX template** (containing `<Placeholder>` tags) and a **generated DOCX** (where the AI has replaced those placeholders with actual content) through a multi-stage pipeline:

1. **DOCX Parsing** — Extracts XML parts, handles Word Track Changes (w:del, w:ins) and field codes
2. **Placeholder Extraction** — Detects `<Placeholder>` tags in normal text AND inside revision elements
3. **Classification** — Classifies each placeholder by type (KeyValue, Paragraph, Table, List, etc.)
4. **Resolution** — Matches template placeholders to generated document content
5. **Replacement Extraction** — Extracts the AI-replaced text from the generated document
6. **Export** — Produces JSON and Excel reports

An **accuracy comparison** script can also compare pipeline results against a QA report.

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
|  Handles:            |              |  Handles:            |
|  - w:del, w:ins      |              |  - w:del, w:ins      |
|  - w:moveFrom,       |              |  - w:moveFrom,       |
|    w:moveTo          |              |    w:moveTo          |
|  - Field codes       |              |  - Field codes       |
|  - Track Changes     |              |  - Track Changes     |
+----------------------+              +----------------------+
          |                                       |
          v                                       |
+----------------------+                         |
|  placeholders/       |                         |
|  (Tree > Inventory)  |                         |
|  Searches:           |                         |
|  - node.text         |                         |
|  - combined_text     |                         |
|   (includes deleted  |                         |
|    revisions)        |                         |
+----------------------+                         |
          |                                       |
          v                                       |
+----------------------+                         |
|  classification/     |                         |
|  (Syntax +           |                         |
|   Structural)        |                         |
+----------------------+                         |
          |                                       |
          v                                       v
+-------------------------------------------------------+
|  replacement_resolution/                               |
|  [Matches template placeholders to                     |
|   generated document nodes]                            |
|                                                        |
|  Strategy (4 levels):                                  |
|  1. TRACKED PAIRS: w:del ↔ w:ins (highest)            |
|  2. INLINE CONTEXT: Find text before/after             |
|     placeholder in generated doc                       |
|  3. LABEL SEARCH: Match placeholder name               |
|     to "Label: Value" patterns                         |
|  4. WORD SEARCH: Match significant words               |
|     in placeholder name                                |
+-------------------------------------------------------+
          |
          v
+-------------------------------------------------------+
|  replacement_extraction/                               |
|  [Extract replacement content]                         |
|  - For tracked pair matches: use matched_text         |
|    directly (no re-extraction)                         |
|  - For others: type-specific extractors                |
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
├── classification/                   # Placeholder classification
│   ├── classifier.py                 # Main classifier orchestrator
│   ├── registry.py                   # Rule registry
│   ├── precedence.py                 # Rule precedence
│   ├── base_rule.py                  # Abstract base rule
│   ├── result_builder.py             # Output enrichment
│   ├── syntax/                       # Syntax-based rules
│   │   ├── table_rules.py
│   │   ├── tables_rules.py
│   │   ├── figure_rules.py
│   │   └── list_rules.py
│   ├── structural/                   # Structural rules (fallback)
│   │   ├── structural_classifier.py
│   │   ├── table_cell_rules.py
│   │   ├── paragraph_rules.py
│   │   ├── keyvalue_rules.py         # Enhanced: neighbor context support
│   │   └── list_rules.py
│   └── models/                       # Classification data models
├── doc_parser/                       # DOCX parsing & canonical tree
│   ├── xml_parser.py                 # XML extraction + helper functions
│   ├── node_builder.py               # Canonical tree builder
│   ├── hierarchy_builder.py          # Node construction + context
│   ├── run_normalizer.py             # Rich run extraction + merging
│   ├── docx_extractor.py             # .docx ZIP extraction
│   ├── xml_models.py                 # Parsed document models
│   ├── revision_parser.py            # **NEW** w:del/w:ins/w:moveFrom/w:moveTo parser
│   └── debug_metrics.py              # **NEW** Document mechanism detection
├── models/                           # Core data models
│   └── nodes.py                      # DocumentNode, Location, ContextWindow,
│                                     # RichTextRun, RevisionFragment (NEW),
│                                     # TrackedReplacementPair (NEW)
├── placeholders/                     # Placeholder extraction
│   ├── extractor.py                  # Searches combined_text + revision fragments
│   ├── validator.py                  # Regex pattern for <placeholder> detection
│   ├── occurrence_generator.py       # Unique ID generation
│   └── context_extractor.py          # Inline context extraction
├── replacement_extraction/           # Content extraction from generated doc
│   ├── extractor.py                  # Direct matched_text passthrough for tracked pairs
│   ├── resolved_node_extractor.py    # O(1) node lookup
│   ├── fragment_builder.py           # Fragment record builder
│   ├── formatting_serializer.py      # Run formatting serializer
│   └── extractors/
│       ├── keyvalue.py               # Strategy 0: direct replacement value
│       ├── paragraph.py              # Uses visible text (excludes deleted)
│       ├── table_cell.py
│       ├── list.py
│       ├── table.py
│       └── figure.py
├── replacement_resolution/           # Placeholder-to-generated-doc matching
│   ├── resolver.py                   # 4-level text-search matching
│   ├── matching_engine.py            # Content-first scoring + revision matching
│   ├── scoring.py                    # Weighted scoring model
│   └── models.py                     # ResolutionResult + CandidateMatch
├── replacement_reporting/            # Final export
│   ├── export_service.py
│   ├── json_reporter.py
│   ├── excel_reporter.py
│   ├── query_service.py
│   └── schema_validator.py
├── reporting/                        # Intermediate reporting
│   ├── inventory_builder.py
│   ├── json_reporter.py
│   ├── export_service.py
│   ├── excel_reporter.py
│   ├── classified_inventory_reporter.py
│   ├── schema_validator.py
│   └── placeholder_resolution_reporter.py
├── tests/                            # Test suite & sample documents
│   ├── ICF_docx/                     # ICF template + QA report
│   ├── output/                       # Intermediate test outputs
│   ├── classification/               # Classification tests
│   ├── doc_parser/                   # DOCX parser tests
│   ├── replacement_extraction/       # Extraction tests
│   ├── replacement_reporting/        # Reporting tests
│   ├── replacement_resolution/       # Resolution tests
│   ├── run_document_replacement_pipeline.py
│   └── us01_s4_run_pipeline.py
├── final_outputs/                    # Pipeline output directory
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
- **Git**

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

### Full Document Replacement Pipeline (End-to-End)

Runs all stages — placeholder extraction, classification, resolution, extraction, and export:

```bash
python tests/run_document_replacement_pipeline.py
```

**Default inputs:**
- **Template:** `tests/ICF_docx/ICF_SET0 (1).docx`
- **Generated doc:** `tests/ICF_docx/ICF_Full_output_01.docx`
- **Output directory:** `final_outputs/`

### Accuracy Comparison (Pipeline vs QA)

After running the pipeline, compare results against a QA report:

```bash
python compare_accuracy.py
```

**Inputs:**
- **Pipeline output:** `final_outputs/replacement_inventory.xlsx`
- **QA report:** `tests/ICF_docx/QA report_ICF_FULL_0804 - Copy - Copy (2).xlsx`

**Output:** `final_outputs/accuracy_report.xlsx` with sheets for:
- QA vs Pipeline Comparison — Full comparison with similarity scores
- Missing in Pipeline Output — QA entries not found in pipeline
- Extra in Pipeline (not in QA) — Pipeline entries not in QA
- Summary — Coverage rate, Type accuracy, Content match rate

### Debug Metrics

Analyze which mechanism a DOCX uses (Track Changes vs. Strikethrough vs. Plain Text):

```python
python -c "
from doc_parser.xml_parser import load_docx
from doc_parser.debug_metrics import analyze_document_metrics, format_metrics_report

doc = load_docx('path/to/your.docx')
metrics = analyze_document_metrics(doc)
print(format_metrics_report(metrics))
"
```

### Individual Pipelines

```bash
# Placeholder extraction only
python tests/us01_s4_run_pipeline.py

# Classification only
python main.py

# Resolution only
python tests/replacement_resolution/scc_243_run_resolution_pipeline.py
```

---

## Resolution & Matching Strategy

The resolver (`replacement_resolution/resolver.py`) uses a **4-level text-search matching strategy**:

### Level 1: Tracked Change Pair Match (Highest Confidence)
- Detects `w:del` (deleted) ↔ `w:ins` (inserted) pairs in the DOCX XML
- If a template placeholder matches the deleted text, the inserted text is the answer
- **No re-extraction**: the resolver's `matched_text` is used directly
- **Confidence:** 0.95

### Level 2: Inline Context Search
- For placeholders with inline text before/after (e.g., "Sponsor: \<Sponsor\>")
- Searches ALL generated document text for the "before" or "after" context string
- Extracts the text that replaces the placeholder between context markers
- **Confidence:** 0.85-0.90

### Level 3: Label Search (KEYVALUE types)
- Builds a map of all "Label: Value" patterns in the generated document
- If the placeholder name appears in a label, extracts the value
- Handles compound labels like "Sponsor / Study Title: Stendarr, Inc."
- **Confidence:** 0.85

### Level 4: Word Search (Fallback)
- Extracts significant words from the placeholder name (e.g., "investigational", "drug", "name")
- Finds the generated node with the highest significant-word overlap
- Extracts value after the nearest colon, or uses the full node text
- **Confidence:** 0.65-0.75

### Key Design Principle
For tracked pair matches (Level 1), the **extraction layer preserves the resolver's text** instead of re-processing it through type-specific extractors. This prevents the corruption of correct answers.

---

## Debug Metrics

The debug metrics module (`doc_parser/debug_metrics.py`) reveals which mechanism a document uses:

```json
{
  "strike_runs": 0,
  "deleted_revisions": 156,
  "inserted_revisions": 264,
  "placeholders_found": 143,
  "tracked_replacement_pairs": 116,
  "primary_mechanism": "tracked_changes"
}
```

This immediately shows whether the document uses strike-through formatting or Word Track Changes.

---

## Running Tests

Run all tests at once:

```bash
pytest tests/ -v
```

Run individual test suites:

```bash
# Placeholder extraction tests
pytest tests/test_ph_detect_ctx_ext.py -v
pytest tests/test_canonical_document_builder.py -v

# Classification tests
pytest tests/classification/ -v

# Resolution tests
pytest tests/replacement_resolution/ -v

# Replacement extraction tests
pytest tests/replacement_extraction/ -v

# Reporting tests
pytest tests/replacement_reporting/ -v

# DOCX parser tests
pytest tests/doc_parser/ -v
```

---

## Output Files

### After running the full pipeline

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

The `tests/` directory includes DOCX files for testing:

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