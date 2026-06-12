# Working Document — Benchmarking Automation

**Project:** Benchmarking Automation
**Location:** `benchmarking_automation/`
**Purpose:** Automated DOCX placeholder extraction, classification, AI-replaced value extraction, and benchmarking.

---

## Sections

- [1. How Things Are Structured](#1-how-things-are-structured)
- [2. Modules &amp; Packages](#2-modules--packages)
- [3. How Components Link Together](#3-how-components-link-together)
- [4. User Stories Check — What&#39;s Done and What&#39;s Not](#4-user-stories-check--whats-done-and-whats-not)
  - [4.1 SCC-36: Extract Placeholders from Destination Template](#41-scc-36-extract-placeholders-from-destination-template)
  - [4.2 SCC-39: Placeholder Classification](#42-scc-39-placeholder-classification)
  - [4.3 SCC-40: Extraction of AI Replaced Value from Generated Document](#43-scc-40-extraction-of-ai-replaced-value-from-generated-document)
- [5. ADR Check — SCC40-ADR1-Ver1](#5-adr-check--scc40-adr1-ver1)
- [6. How the Pipeline Runs](#6-how-the-pipeline-runs)
- [7. What&#39;s Still Missing](#7-whats-still-missing)

---

## 1. How Things Are Structured

```
+----------------------------------------------------------------+
|                      PIPELINE LAYER                             |
|  app/pipeline.py                                                |
|  app/classification_pipeline.py                                 |
|  app/document_replacement_pipeline.py                           |
|  app/placeholder_resolution_pipeline.py                         |
+----------------------------------------------------------------+
|                      CORE MODULES                               |
|  +-------------+  +--------------+  +----------------------+    |
|  | doc_parser  |  | placeholders |  | classification       |   |
|  | (DOCX>Tree) |  | (Tree>Inv)   |  | (Inv>Classified Inv) |   |
|  +-------------+  +--------------+  +----------------------+    |
|                                          |                      |
|  +----------------------+  +----------------------+             |
|  | replacement_reporting|  | replacement_extraction|            |
|  | (JSON/Excel Export)  |  | (Value Extraction)   |            |
|  +----------------------+  +----------------------+             |
|                                          |                      |
|  +----------------------+               |                      |
|  | replacement_resolution|---------------+                     |
|  | (Matching+Scoring)   |                                      |
|  +----------------------+                                      |
+----------------------------------------------------------------+
|                      DATA MODELS                               |
|  models/nodes.py                                                |
|  classification/models/                                        |
|  replacement_extraction/models/                                |
|  replacement_resolution/models.py                              |
+----------------------------------------------------------------+
|                      REPORTING                                  |
|  reporting/   replacement_reporting/                            |
|  (JSON, Excel, Schema validation)                               |
+----------------------------------------------------------------+
```

---

## 2. Modules & Packages

### 2.1 `doc_parser/` — DOCX Parsing & Canonical Tree Building

| File                              | What It Does                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docx_extractor.py`                            | Opens .docx as ZIP, extracts internal XML parts:`word/document.xml`, `word/header*.xml`, `word/footer*.xml`, `word/styles.xml`, `word/numbering.xml`. Validates the file is a valid .docx.                                                                                                                          |
| `xml_parser.py`                                | Parses raw XML bytes into lxml ElementTree. Provides helper functions `get_paragraphs()`, `get_tables()`, `get_rows()`, `get_cells()`, `get_runs()`, `get_texts()`, `is_list_paragraph()`. The `load_docx()` function is the main entry point returning a `ParsedDocument` containing all parsed XML parts. |
| `xml_models.py`                                | Data classes:`XmlPart` (path + bytes), `ParsedXmlPart` (name + lxml tree), `ParsedDocument` (document_xml, headers, footers, styles, numbering).                                                                                                                                                                        |
| `run_normalizer.py`                            | Extracts rich text run properties from a paragraph: bold, italic, underline, strike, font_name, font_size, color, highlight. The `normalize_runs()` function merges fragmented Word runs into logical text while preserving formatting.                                                                                     |
| `node_builder.py`                              | `CanonicalDocumentBuilder` traverses the DOCX body, headers, and footers, building a hierarchical `DocumentNode` tree. Uses `HierarchyBuilder` for individual paragraph/table nodes.                                                                                                                                    |
| `hierarchy_builder.py`                         | `HierarchyBuilder` constructs `DocumentNode` objects for paragraphs, list items, tables, rows, and cells. Captures structural location (section, paragraph_index, table_index, row_index, cell_index, table_path) and context (before/after text).                                                                        |

### 2.2 `placeholders/` — Placeholder Extraction

| File                                  | What It Does                                                                                                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validator.py`                                       | Regex pattern `<\s*([^<>]+?)\s*>` for detecting placeholders. `find_placeholder_matches()` returns match objects; `find_placeholders()` returns text strings.                          |
| `extractor.py`                                       | `PlaceholderExtractor` traverses the canonical document tree, detects placeholders in paragraph/list_item nodes, and builds occurrence records with IDs, context, and structural location. |
| `occurrence_generator.py`                            | Generates unique occurrence IDs (`PH_0001`, `PH_0002`, ...).                                                                                                                             |
| `context_extractor.py`                               | Extracts surrounding static text before and after a placeholder within the same paragraph.                                                                                                   |

A note on design: Only paragraph and list_item nodes are scanned for placeholders. Table/row/cell nodes serve as structural containers and are NOT scanned directly — this prevents duplicate detection.

### 2.3 `classification/` — Placeholder Classification

| File                          | What It Does                                                                                                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base_rule.py`                           | Abstract base class `BaseClassificationRule` with a `match()` method returning `ClassificationResult` or None.                                                                                                                                            |
| `registry.py`                            | `RuleRegistry` stores and retrieves classification rules.                                                                                                                                                                                                     |
| `precedence.py`                          | Defines classification precedence:`tables -> table -> figure -> list -> table_cell -> paragraph -> keyvalue -> unknown`. Lower numeric value equals higher priority.                                                                                          |
| `result_builder.py`                      | `build_output()` enriches an occurrence dict with type, classification_reason, classification_confidence, and matched_rule_ids.                                                                                                                               |
| `classifier.py`                          | `PlaceholderClassifier` orchestrates classification: runs syntax rules first, applies precedence if multiple matches, fails back to structural classification, and finally unknown. `classify_inventory()` sorts by occurrence_id for deterministic output. |
| **`models/`**                      |                                                                                                                                                                                                                                                                 |
| `placeholder_type.py`                    | Enum: TABLES, TABLE, FIGURE, LIST, TABLE_CELL, PARAGRAPH, KEYVALUE, UNKNOWN.                                                                                                                                                                                    |
| `classification_result.py`               | Data class: placeholder, type, classification_reason, classification_confidence, matched_rule_ids.                                                                                                                                                              |
| **`syntax/`**                      | Syntax-based rules (take precedence over structural)                                                                                                                                                                                                            |
| `table_rules.py`                         | Patterns:`<Table: ...>`, `<Insert Table: ...>`, `<Insert Table Table Name>`, `<Table X>`.                                                                                                                                                               |
| `tables_rules.py`                        | Patterns:`<Tables: ...>`, `<Extract Tables>`.                                                                                                                                                                                                               |
| `figure_rules.py`                        | Patterns:`<Figure ...>`, `<Insert Figure>`, `<Figure_...>`.                                                                                                                                                                                               |
| `list_rules.py`                          | Patterns:`<number list: ...>`, `<bullet list: ...>`, `<Number list ...>`, `<Bullet list ...>`, `<Insert Reference List>`.                                                                                                                             |
| **`structural/`**                  | Structural/context-based rules (fallback when syntax does not match)                                                                                                                                                                                            |
| `structural_classifier.py`               | Chains structural rules in order: list -> table_cell -> paragraph -> keyvalue -> unknown.                                                                                                                                                                       |
| `table_cell_rules.py`                    | Detects table_path presence ->`table_cell` (0.98 confidence).                                                                                                                                                                                                 |
| `list_rules.py`                          | Detects node_type == "list_item" or list_info.is_list ->`list` (0.88 confidence).                                                                                                                                                                             |
| `paragraph_rules.py`                     | Detects standalone paragraph with no inline context and no table_path ->`paragraph` (0.90 confidence).                                                                                                                                                        |
| `keyvalue_rules.py`                      | Detects inline context (before/after text) ->`keyvalue`. If label pattern (`: $`) found -> 0.95 confidence, else 0.75.                                                                                                                                      |

### 2.4 `replacement_resolution/` — Placeholder-to-Generated-Doc Matching

| File             | What It Does                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models.py`          | `ResolutionResult` (occurrence_id, placeholder, generated_node_id, match_confidence, resolution_status, matched_text, score_breakdown) and `CandidateMatch` (node_id, score, sub-scores).                                                                                                                                       |
| `scoring.py`         | `ResolutionScorer` defines a weighted scoring model: section (0.25), context (0.25), table_path (0.15), type (0.15), formatting (0.05), node_distance (0.05). Threshold: 0.60. Uses `SequenceMatcher` for similarity.                                                                                                           |
| `matching_engine.py` | Core matching logic:`find_best_match()` filters candidates by section/table_path, scores each match, returns best candidate. `is_candidate()` filters by type and location. Sub-scorers: `score_section()`, `score_table_path()`, `score_context()`, `score_type()`, `score_formatting()`, `score_node_distance()`. |
| `resolver.py`        | `PlaceholderResolver` flattens generated tree, iterates classified inventory, finds best match via `find_best_match()`, applies threshold, filters out nodes still containing placeholders (unresolved). Returns list of `ResolutionResult`.                                                                                  |

### 2.5 `replacement_extraction/` — Value Extraction from Generated Document

| File                                       | What It Does                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractor.py`                                               | `ReplacementExtractionEngine` is the main orchestrator. Takes classified inventory + resolution results + generated tree. Maps occurrence_id to classification, dispatches to type-specific extractors, builds fragments, and outputs replacement inventory + fragment store. |
| `resolved_node_extractor.py`                                 | `ResolvedNodeExtractor` indexes generated tree nodes by node ID for O(1) lookup. Supports both dict-based and DocumentNode formats.                                                                                                                                           |
| `fragment_builder.py`                                        | `FragmentBuilder` creates fragment records with UUID-based fragment_id, node_type, content, and formatting.                                                                                                                                                                   |
| `formatting_serializer.py`                                   | `FormattingSerializer` serializes RichTextRun objects into dict format (text, bold, italic, underline, strike, font_name, font_size, color, highlight).                                                                                                                       |
| **`extractors/`**                                      |                                                                                                                                                                                                                                                                                 |
| `keyvalue.py`                                                | `KeyValueExtractor` extracts matched_text from resolution (inline key-value replacements).                                                                                                                                                                                    |
| `table_cell.py`                                              | `TableCellExtractor` extracts cell content and rows.                                                                                                                                                                                                                          |
| `paragraph.py`                                               | `ParagraphExtractor` extracts paragraph text with rich formatting via FormattingSerializer.                                                                                                                                                                                   |
| `list.py`                                                    | `ListExtractor` extracts list items and list_type.                                                                                                                                                                                                                            |
| `table.py`                                                   | `TableExtractor` extracts table rows and style.                                                                                                                                                                                                                               |
| `figure.py`                                                  | `FigureExtractor` extracts caption, image_ref, width, height.                                                                                                                                                                                                                 |
| **`models/`**                                          | (Empty files; models defined inline in code)                                                                                                                                                                                                                                    |

### 2.6 `reporting/` — Intermediate Reporting

| File                                   | What It Does                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `inventory_builder.py`               | `InventoryBuilder` orchestrates DOCX parse -> canonical tree -> placeholder extraction -> inventory (used by PlaceholderPipeline). |
| `inventory_validator.py`             | Validates inventory structure.                                                                                                       |
| `json_reporter.py`                   | Generates JSON string from inventory.                                                                                                |
| `export_service.py`                  | Writes JSON output to file, creating directories as needed.                                                                          |
| `classified_inventory_reporter.py`   | Exports classified inventory as JSON.                                                                                                |
| `excel_reporter.py`                  | Exports classified inventory as Excel (.xlsx).                                                                                       |
| `document_tree_loader.py`            | Loads a generated document tree from JSON file into DocumentNode hierarchy.                                                          |
| `document_tree_reporter.py`          | Reports document tree structure.                                                                                                     |
| `placeholder_resolution_reporter.py` | Saves resolution results to JSON.                                                                                                    |
| `schema_validator.py`                | Validates classified inventory schema.                                                                                               |

### 2.7 `replacement_reporting/` — Final Export & Reporting

| File                    | What It Does                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export_service.py`   | Orchestrates final export: validates inventory schema, exports JSON replacement inventory + fragment store, and generates Excel report.             |
| `json_reporter.py`    | Exports replacement inventory and fragment store as JSON files.                                                                                     |
| `excel_reporter.py`   | Exports replacement inventory as Excel (.xlsx).                                                                                                     |
| `query_service.py`    | Query support for replacement data.                                                                                                                 |
| `schema_validator.py` | Validates required fields: occurrence_id, placeholder, type, status. Checks replacement_content or fragment_id present when replacement_found=True. |

### 2.8 `app/` — Pipeline Orchestration

| File                                                     | What It Does                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipeline.py`                                                                     | `PlaceholderPipeline` — Step 1: Build inventory via InventoryBuilder. Step 1.5: Validate. Step 2: Generate JSON. Step 3: Export. Entry for SCC-36 placeholder extraction.                              |
| `classification_pipeline.py`                                                      | `ClassificationPipeline` — Step 1: Load inventory JSON. Step 2: Classify via PlaceholderClassifier. Step 3: Validate schema. Step 4: Export JSON + optionally Excel. Entry for SCC-39 classification.  |
| `placeholder_resolution_pipeline.py`                                              | `PlaceholderResolutionPipeline` — Step 1: Load classified inventory. Step 2: Load generated document tree. Step 3: Resolve via PlaceholderResolver. Step 4: Save results. Entry for resolution.        |
| `document_replacement_pipeline.py`                                                | `DocumentReplacementPipeline` — Full end-to-end pipeline combining all phases: (1) Template inventory, (2) Classification, (3) Generated tree, (4) Resolution, (5) Replacement Extraction, (6) Export. |

### 2.9 `models/` — Core Data Models

- **`nodes.py`**: `Location` (section, paragraph_index, table_index, row_index, cell_index, table_path, header_index, footer_index), `ContextWindow` (before_text, after_text), `RichTextRun` (text + formatting props), `DocumentNode` (id, type, text, children, rich_runs, location, context, metadata, node_order, parent_id).

---

## 3. How Components Link Together

### 3.1 Full Pipeline Data Flow

```
Template DOCX                              Generated DOCX
    |                                            |
    v                                            v
+----------------------+              +----------------------+
|  doc_parser/         |              |  doc_parser/         |
|  load_docx()         |              |  load_docx()         |
|  CanonicalDocBuilder |              |  CanonicalDocBuilder |
|       |              |              |       |              |
|       v              |              |       v              |
|  DocumentNode Tree   |              |  DocumentNode Tree   |
+----------------------+              +----------------------+
         |                                       |
         v                                       |
+----------------------+                         |
|  placeholders/       |                         |
|  PlaceholderExtractor|                         |
|       |              |                         |
|       v              |                         |
|  Placeholder         |                         |
|  Inventory (JSON)    |                         |
+----------------------+                         |
         |                                       |
         v                                       |
+----------------------+                         |
|  classification/     |                         |
|  PlaceholderClassifier|                        |
|  (Syntax + Structural)|                        |
|       |              |                         |
|       v              |                         |
|  Classified          |                         |
|  Inventory (JSON/XLSX)|                        |
+----------------------+                         |
         |                                       |
         v                                       v
+-------------------------------------------------------+
|  replacement_resolution/                               |
|  PlaceholderResolver -> find_best_match() -> scoring   |
|                       |                                |
|                       v                                |
|  ResolutionResults (occurrence -> generated_node)      |
+-------------------------------------------------------+
         |
         v
+-------------------------------------------------------+
|  replacement_extraction/                               |
|  ReplacementExtractionEngine                           |
|  -> type-specific extractors                           |
|  -> FragmentBuilder                                    |
|  -> Replacement Inventory + Fragment Store             |
+-------------------------------------------------------+
         |
         v
+-------------------------------------------------------+
|  replacement_reporting/                                |
|  ExportService -> JSON (inventory + fragments)         |
|                -> Excel (inventory)                    |
+-------------------------------------------------------+
```

### 3.2 Pipeline Entry Points

| Script                                                              | What It Runs                                           | Output                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `tests/us01_s4_run_pipeline.py`                                   | `PlaceholderPipeline` — placeholder extraction only | `tests/output/inventory.json`                                                    |
| `main.py`                                                         | `ClassificationPipeline` — classification           | `output/classified_inventory.json` + `.xlsx`                                   |
| `tests/replacement_resolution/scc_243_run_resolution_pipeline.py` | `PlaceholderResolutionPipeline` — resolution        | `output/placeholder_resolution.json`                                             |
| `tests/run_document_replacement_pipeline.py`                      | `DocumentReplacementPipeline` — full end-to-end     | `final_outputs/replacement_inventory.json` + `.xlsx` + `fragment_store.json` |

---

## 4. User Stories Check — What's Done and What's Not

### 4.1 SCC-36: Extract Placeholders from Destination Template

**Overall: Mostly done**

| AC  | Description                                                   | Status   | Code Reference                                                                                                                                                |
| --- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Upload and read template DOCX — extract XML parts            | Done     | `docx_extractor.py`: Extracts `word/document.xml`, `word/header*.xml`, `word/footer*.xml`. Validates .docx extension.                                 |
| AC2 | Reconstruct logical text from fragmented runs                 | Done     | `run_normalizer.py`: `normalize_runs()` merges fragmented Word runs into logical text.                                                                    |
| AC3 | Detect placeholders using regex pattern `<\s*([^<>]+?)\s*>` | Done     | `validator.py`: `PLACEHOLDER_PATTERN`. Detection works in paragraphs, tables, lists, headers, footers via `node_builder.py` + `hierarchy_builder.py`. |
| AC4 | Generate unique occurrence IDs                                | Done     | `occurrence_generator.py`: Counter-based IDs (`PH_0001`, `PH_0002`, ...).                                                                               |
| AC5 | Capture structural context                                    | Done     | `extractor.py`: Captures placeholder text, occurrence_id, section, paragraph_index, table/row/cell location, inline context, neighbor context, table_path.  |
| AC6 | Generate placeholder inventory JSON                           | Done     | `pipeline.py` -> `inventory_builder.py` -> `export_service.py`. Output: `tests/output/inventory.json`.                                                |
| —  | Shapes/text boxes extraction                                  | Not done | Not implemented.                                                                                                                                              |
| —  | Repeating regions                                             | Not done | Deferred to "future extensibility".                                                                                                                           |

**Tests covering this:** `test_parser.py`, `test_canonical_document_builder.py`, `test_ph_detect_ctx_ext.py`, `test_us01_subtask4.py` cover placeholder detection, canonical tree building, run extraction.

---

### 4.2 SCC-39: Placeholder Classification

**Overall: Mostly done**

| AC  | Description                          | Status | Code Reference                                                                                                                                                                                             |
| --- | ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Type assignment from supported set   | Done   | `PlaceholderType` enum: `tables`, `table`, `figure`, `list`, `table_cell`, `paragraph`, `keyvalue`, `unknown`. Per-occurrence classification in `classifier.py:classify_occurrence()`. |
| AC2 | Structural signals                   | Done   | Structural classifier uses:`table_path` -> `table_cell`; `node_type == list_item` or `is_list` -> `list`; standalone paragraph -> `paragraph`; inline context -> `keyvalue`.                 |
| AC3 | Syntax-based signals take precedence | Done   | `classifier.py`: Syntax rules run first; if match found, return immediately. Only falls back to structural if syntax does not match.                                                                     |
| AC4 | Unknown type fallback                | Done   | `structural_classifier.py`: Final fallback returns `UNKNOWN` with confidence 0.0.                                                                                                                      |
| AC5 | Deterministic classification         | Done   | No randomness or LLM calls.`classify_inventory()` sorts by occurrence_id before processing.                                                                                                              |
| AC6 | Output contract preserved            | Done   | `build_output()` copies all original fields from occurrence and adds type/classification fields (superset).                                                                                              |
| AC7 | Classification precedence            | Done   | `precedence.py`: `tables(1) -> table(2) -> figure(3) -> list(4) -> table_cell(5) -> paragraph(6) -> keyvalue(7) -> unknown(8)`.                                                                        |

**Tests covering this:** `test_determinism.py`, `test_syntax_rules.py`, `test_structural_classifier.py`, integration tests + regression tests.

---

### 4.3 SCC-40: Extraction of AI Replaced Value from Generated Document

**Overall: Partially done**

| AC | Description                                           | Status   | Code Reference                                                                                                                                                                                            |
| -- | ----------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| — | Generated document upload (via internal pipeline)     | Done     | `DocumentReplacementPipeline` accepts generated doc as input parameter.                                                                                                                                 |
| — | Query placeholders and extract replaced values        | Done     | `ReplacementExtractionEngine` iterates resolution results, maps to classified inventory, extracts values.                                                                                               |
| — | Preserve formatting structure                         | Partial  | `FormattingSerializer` preserves bold/italic/underline/strike/font/color/highlight. Rich text runs preserved in fragments. Full formatting relationships and complex layouts may not be fully captured. |
| — | Tables support                                        | Done     | `TableExtractor` + `TableCellExtractor` handle table content extraction.                                                                                                                              |
| — | Lists support                                         | Done     | `ListExtractor` handles list items.                                                                                                                                                                     |
| — | Export JSON                                           | Done     | `JsonReporter` exports `replacement_inventory.json` + `replacement_fragment_store.json`.                                                                                                            |
| — | Export Excel                                          | Done     | `ExcelReporter` exports `replacement_inventory.xlsx`.                                                                                                                                                 |
| — | Track-change handling                                 | Not done | No revision-aware parsing implemented. The extraction engine does not detect or handle strikethrough changes, track changes, or inserted/deleted content.                                                 |
| — | CSV export                                            | Not done | Only JSON and Excel are supported.                                                                                                                                                                        |
| — | Page number tracking                                  | Not done | No page/source_location tracking in extraction output.                                                                                                                                                    |
| — | Strikethrough detection and handling                  | Not done | While `run_normalizer.py` reads the `strike` property from runs, the extraction layer (`KeyValueExtractor`, etc.) does not use or report it.                                                        |
| — | Rich text preservation varying by document complexity | Partial  | Basic run formatting preserved, but complex nested formatting and cross-references not fully handled.                                                                                                     |

**Tests covering this:** `test_replacement_extractor.py`, `test_placeholder_resolver.py`, `test_resolution_pipeline.py`, `test_replacement_reporting.py`.

---

## 5. ADR Check — SCC40-ADR1-Ver1

**Overall: Partially done**

| ADR Decision                                             | Status   | Notes                                                                                                                                                                                                                   |
| -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical Document Model reused                          | Done     | `DocumentNode` used across parsing, extraction, and resolution.                                                                                                                                                       |
| Placeholder Inventory architecture reused                | Done     | Inventory from SCC-36/SCC-37 flows through all pipeline stages.                                                                                                                                                         |
| `Placeholder Replacement Extraction Engine` introduced | Done     | `ReplacementExtractionEngine` implemented.                                                                                                                                                                            |
| `Structural Alignment Engine`                          | Partial  | `find_best_match()` in `matching_engine.py` provides basic structural alignment (section match, table_path match, context scoring). Heuristics for dynamic table growth and paragraph movement are not implemented. |
| `Replacement Detection Engine`                         | Done     | Type-specific extractors (KeyValueExtractor, TableCellExtractor, etc.) detect replacement content.                                                                                                                      |
| Track changes support                                    | Not done | No revision-aware parsing.                                                                                                                                                                                              |
| Strikethrough content                                    | Not done | Not handled in extraction layer.                                                                                                                                                                                        |
| Inserted/deleted revisions                               | Not done | Not handled.                                                                                                                                                                                                            |
| AI-generated content                                     | N/A      | Treated as regular text — no special AI-content markers.                                                                                                                                                               |
| Tables, lists, headers, footers, rich text               | Done     | Supported via type-specific extractors.                                                                                                                                                                                 |
| `Revision-aware parsing`                               | Not done | Not implemented.                                                                                                                                                                                                        |
| JSON output                                              | Done     | `replacement_inventory.json`, `replacement_fragment_store.json`.                                                                                                                                                    |
| CSV/Excel output                                         | Partial  | Excel is supported. CSV is not.                                                                                                                                                                                         |
| Structured intermediate representation                   | Done     | Fragment store with fragment_id, node_type, content, formatting.                                                                                                                                                        |

---

## 6. How the Pipeline Runs

### 6.1 End-to-End Flow (DocumentReplacementPipeline)

```
Input: Template DOCX + Generated DOCX

Phase 1 — Template Inventory
  load_docx(template) -> canonical tree -> placeholder extractor -> inventory[]

Phase 2 — Classification
  PlaceholderClassifier.classify_inventory(inventory) -> classified_inventory[]
  Each occurrence gets: type, classification_reason, confidence, matched_rule_ids

Phase 3 — Generated Document Tree
  load_docx(generated) -> canonical tree -> DocumentNode hierarchy

Phase 4 — Resolution
  PlaceholderResolver.resolve(classified_inventory, generated_tree)
    -> flatten generated tree -> for each occurrence:
      -> find_best_match() -> scoring (section, table, context, type, formatting, distance)
      -> threshold check (>=0.60) -> RESOLVED or UNRESOLVED

Phase 5 — Replacement Extraction
  ReplacementExtractionEngine.run()
    -> for each resolved occurrence:
      -> get type-specific extractor
      -> extract replacement content
      -> build fragment
      -> build inventory record

Phase 6 — Export
  ExportService.export()
    -> validate schema
    -> export replacement_inventory.json
    -> export replacement_fragment_store.json
    -> export replacement_inventory.xlsx

Output: final_outputs/
  +-- replacement_inventory.json
  +-- replacement_fragment_store.json
  +-- replacement_inventory.xlsx
```

### 6.2 Classification Flow (Step by Step)

```
classify_occurrence(occurrence):
    1. RUN SYNTAX RULES (registered in order):
       - TablesSyntaxRule.match()  -> checks <Tables:...>, <Extract Tables> patterns
       - TableSyntaxRule.match()   -> checks <Table:...>, <Insert Table:...> patterns
       - FigureSyntaxRule.match()  -> checks <Figure...>, <Insert Figure> patterns
       - ListSyntaxRule.match()    -> checks <number list:...>, <bullet list:...> patterns

    2. RESOLVE PRECEDENCE (if multiple syntax rules match):
       -> pick highest priority: tables > table > figure > list

    3. IF SYNTAX MATCHED -> return immediately
       (with confidence 1.0)

    4. RUN STRUCTURAL CLASSIFIER (fallback):
       a. classify_structural_list()  -> node_type == "list_item" -> list (0.88)
       b. classify_table_cell()       -> table_path present -> table_cell (0.98)
       c. classify_paragraph()        -> standalone paragraph -> paragraph (0.90)
       d. classify_keyvalue()         -> inline context -> keyvalue (0.75-0.95)
       e. UNKNOWN                     -> no match -> unknown (0.0)
```

---

## 7. What's Still Missing

### 7.1 High Priority

| Gap                                                  | Related US  | Why It Matters                                                                                                                  |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Track changes / revision-aware parsing               | SCC-40, ADR | Generated documents with tracked changes are not handled. Strikethrough, inserted/deleted content are not detected or reported. |
| Dynamic table growth & paragraph movement heuristics | SCC-40, ADR | Matching may fail when generated documents restructure content significantly compared to template.                              |
| Shapes / text boxes extraction                       | SCC-36      | Placeholders inside shapes or text boxes are not detected.                                                                      |
| CSV export format                                    | SCC-40      | Only JSON and Excel are supported. CSV/Sheets-compatible format not implemented.                                                |
| Page number / source_location tracking               | SCC-40      | Output lacks page/position metadata for traceability.                                                                           |

### 7.2 Medium Priority

| Gap                                                         | Related US | Notes                                                                                                                                  |
| ----------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Repeating regions (`<Repeat>...</Repeat>`)                | SCC-36     | Noted as future extensibility — not implemented.                                                                                      |
| Formatting preservation validation                          | SCC-40     | Rich text handling exists but validation against complex documents is not demonstrated.                                                |
| Edge case documentation                                     | SCC-36     | `empty_template.docx`, `invalid.docx`, `unsupported_content.docx` exist as test files but edge case handling in code is minimal. |
| `__init__.py` files in `replacement_extraction/models/` | —         | Empty files — actual models not defined in them.                                                                                      |

### 7.3 Test Coverage Gaps

| Area                                                                 | Status      |
| -------------------------------------------------------------------- | ----------- |
| Placeholder extraction (paragraphs, tables, lists, headers, footers) | Covered     |
| Classification (syntax rules, structural rules, determinism)         | Covered     |
| Resolution (matching, scoring, pipeline)                             | Covered     |
| Replacement extraction (type-specific extractors)                    | Covered     |
| Reporting (JSON, Excel, schema validation)                           | Covered     |
| Track changes / revision handling                                    | Not covered |
| Shapes / text boxes                                                  | Not covered |
| Repeating regions                                                    | Not covered |
| Dynamic document restructuring                                       | Not covered |
| Cross-reference / field code handling                                | Not covered |

### 7.4 Things to Fix Next

1. **Revision-aware parsing** — Add a module that detects track changes (insertions, deletions, formatting modifications) in the generated DOCX and reports them in the extraction output.
2. **Structural alignment heuristics** — Enhance the matching engine to handle dynamic table growth (inserted/removed rows) and paragraph reordering.
3. **Shapes/text box traversal** — Extend `CanonicalDocumentBuilder` to detect and parse `<w:txbxContent>` elements within shapes.
4. **CSV export** — Add a CSV reporter in `replacement_reporting/` or extend `ExcelReporter` to also export CSV.
5. **Page number tracking** — Parse page break elements or use pagination references in the DOCX XML.
6. **Strikethrough detection in extraction** — The `KeyValueExtractor` should report whether the replacement text contains strikethrough formatting as a quality indicator.
7. **Edge case documentation** — Formalize handling for empty documents, malformed XML, unsupported content types, and missing optional XML parts.
