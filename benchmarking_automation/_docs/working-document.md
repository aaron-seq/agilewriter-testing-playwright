# Benchmarking Automation — Project Reference

**Location:** `benchmarking_automation/`
**Purpose:** Automated DOCX placeholder extraction, classification, AI-replaced value extraction, and accuracy benchmarking against QA reports.

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [How the Pipeline Works (End-to-End)](#2-how-the-pipeline-works-end-to-end)
3. [Module Deep Dive](#3-module-deep-dive)
   - [3.1 doc_parser/ — DOCX Parsing & Canonical Tree](#31-doc_parser--docx-parsing--canonical-tree)
   - [3.2 placeholders/ — Placeholder Extraction](#32-placeholders--placeholder-extraction)
   - [3.3 classification/ — Type Assignment](#33-classification--type-assignment)
   - [3.4 replacement_resolution/ — Matching Engine](#34-replacement_resolution--matching-engine)
   - [3.5 replacement_extraction/ — Content Extraction](#35-replacement_extraction--content-extraction)
   - [3.6 replacement_reporting/ — Export](#36-replacement_reporting--export)
   - [3.7 app/ — Pipeline Orchestration](#37-app--pipeline-orchestration)
   - [3.8 models/ — Data Models](#38-models--data-models)
   - [3.9 compare_accuracy.py — QA Comparison](#39-compare_accuracypy--qa-comparison)
4. [How Components Link Together](#4-how-components-link-together)
5. [The Four-Level Resolution Strategy](#5-the-four-level-resolution-strategy)
6. [Classification Precedence Rules](#6-classification-precedence-rules)
7. [Pipeline Entry Points](#7-pipeline-entry-points)
8. [Key Improvements & Changes Log](#8-key-improvements--changes-log)
9. [Running Tests](#9-running-tests)
10. [Output Files Explained](#10-output-files-explained)
11. [Data Flow Diagrams](#11-data-flow-diagrams)

---

## 1. What This Project Does

This project solves a common problem in clinical trial document automation:

> **Given a DOCX template** (with placeholders like `<Sponsor>`, `<Protocol Number>`, `<disease>`) and **an AI-generated DOCX** (where the AI replaced those placeholders with real content like "Stendarr, Inc.", "SKY-2000-101", "boneitis"), **find what text replaced each placeholder**.

The pipeline:

1. Reads the **template** and finds all `<placeholder>` tags — including those inside Word Track Changes (w:del / w:ins)
2. Classifies each placeholder by **type** (KeyValue, Paragraph, Table, List, etc.)
3. Scans the **generated document** to find where each placeholder's content ended up — using tracked change pairs, inline context, and label matching
4. **Extracts** the replacement text with formatting
5. **Exports** the mapping as JSON and Excel

A separate **accuracy comparison** script can compare pipeline results against a manually-prepared QA report to measure how well the pipeline performs.

---

## 2. How the Pipeline Works (End-to-End)

The pipeline is invoked by `tests/run_document_replacement_pipeline.py` which triggers `DocumentReplacementPipeline` in `app/document_replacement_pipeline.py`. It runs 6 phases:

### Phase 1 — Template Inventory

```
Template DOCX (ICF_SET0 (1).docx)
    |
    v
doc_parser/load_docx()
    - Opens .docx as ZIP
    - Extracts document.xml, headers, footers, styles
    |
    v
doc_parser/CanonicalDocumentBuilder.build()
    - Creates a tree of DocumentNode objects
    - Each node has: text (visible only), combined_text (in metadata, includes deleted revisions),
      rich_runs, revision_fragments, tracked_replacement_pairs
    |
    v
placeholders/PlaceholderExtractor.extract()
    - Traverses the tree
    - Looks for <placeholder> in combined_text (includes text inside w:del elements)
    - Also checks revision_fragments directly for edge cases
    - For each match, builds an "occurrence record" with:
      - occurrence_id, placeholder text, node_type
      - structural location (section, paragraph_index, table_path)
      - inline_context (text before/after the placeholder)
      - neighbor_context (text from preceding/following paragraphs)
      - revision_source ("normal" or "deleted")
    |
    v
Output: inventory[] — list of all placeholders found in template
```

### Phase 2 — Classification

```
inventory[]
    |
    v
classification/PlaceholderClassifier.classify_inventory()
    - For each occurrence:
      1. Try syntax rules first
      2. If no syntax match, try structural rules:
         a. Has table_path? → TABLE_CELL
         b. Node type is list_item? → LIST
         c. Standalone paragraph? → PARAGRAPH
         d. Has inline context? → KEYVALUE (enhanced: also checks neighbor context)
         e. None of above? → UNKNOWN
    |
    v
Output: classified_inventory[]
```

### Phase 3 — Generated Document Tree

Same as template parsing but for the generated document:
- `load_docx(generated_doc)` — includes revision parsing
- `CanonicalDocumentBuilder.build()` — builds tree with revision_fragments and tracked_replacement_pairs
- Output: `generated_tree` with 128+ tracked deletion↔insertion pairs detected

### Phase 4 — Resolution (The Core Matching)

```
classified_inventory[] + generated_tree
    |
    v
replacement_resolution/PlaceholderResolver.resolve()
    |
    Uses FOUR strategies in order:
    |
    Level 1 — TRACKED CHANGE PAIR (highest confidence, 0.95):
      - For each tracked pair (w:del ↔ w:ins) found in generated doc XML
      - If placeholder text matches deleted text → use inserted text as answer
      - No re-processing needed: answer is already correct
      - Covers 130+ of 151 items in typical ICF document
    |
    Level 2 — INLINE CONTEXT SEARCH (0.85-0.90):
      - Find "before" text in generated doc, extract what follows
      - e.g., "Sponsor: <Sponsor>" → find "Sponsor:" → extract "Stendarr, Inc."
    |
    Level 3 — LABEL SEARCH (0.85):
      - Build label:value map from generated doc
      - Match placeholder name to label
      - Handle compound labels: "Sponsor / Study Title: Value"
    |
    Level 4 — WORD SEARCH (0.65-0.75):
      - Extract significant words from placeholder name
      - Find node with highest word overlap
    |
    v
Output: ResolutionResult[]
```

### Phase 5 — Replacement Extraction

```
ResolutionResult[] + classified_inventory[] + generated_tree
    |
    v
replacement_extraction/ReplacementExtractionEngine.run()
    - For each RESOLVED occurrence:
      - If method is tracked_pair/inline_xxx → use matched_text directly (NO re-extraction)
      - Otherwise → use type-specific extractor
    |
    v
Output: replacement_inventory[] + fragment_store[]
```

### Phase 6 — Export

```
replacement_inventory[] + fragment_store[]
    |
    v
replacement_reporting/ExportService.export()
    1. Validate schema
    2. Export replacement_inventory.json
    3. Export replacement_fragment_store.json
    4. Export replacement_inventory.xlsx
    |
    v
final_outputs/
    +-- replacement_inventory.json
    +-- replacement_fragment_store.json
    +-- replacement_inventory.xlsx
```

---

## 3. Module Deep Dive

### 3.1 doc_parser/ — DOCX Parsing & Canonical Tree

This module converts a .docx file into a hierarchical tree of `DocumentNode` objects.

**Key Files:**

| File | Responsibility |
|------|---------------|
| `docx_extractor.py` | Opens .docx as ZIP, extracts internal XML parts: `word/document.xml`, `word/header*.xml`, `word/footer*.xml`, `word/styles.xml`, `word/numbering.xml`. Validates the file is a valid .docx. |
| `xml_parser.py` | Parses raw XML bytes into lxml ElementTree. Key functions: `load_docx()` (main entry point returning `ParsedDocument`), `get_paragraphs()`, `get_tables()`, `get_rows()`, `get_cells()`, `get_runs()`, `get_texts()`, `is_list_paragraph()`. |
| `xml_models.py` | Data classes: `XmlPart` (path + bytes), `ParsedXmlPart` (name + lxml tree), `ParsedDocument` (document_xml, headers, footers, styles, numbering). |
| `run_normalizer.py` | **`normalize_runs()`** is the core text extraction function. Handles field codes (`w:instrText`), deleted text (`w:delText`), and fragmented runs. Returns `{text (visible only), combined_text (includes deleted), rich_runs[], revision_fragments[], tracked_replacement_pairs[]}`. The new design separates visible text (what the user sees) from combined text (what's used for placeholder detection). |
| `revision_parser.py` | **NEW —** Parses Word revision elements: `w:del`, `w:ins`, `w:moveFrom`, `w:moveTo`. Extracts text fragments tagged as "normal", "deleted", or "inserted". Detects deletion↔insertion pairs. Key function: `parse_paragraph_revisions(paragraph)` returns `{fragments[], combined_text, visible_text, deleted_text, inserted_text, paired_replacements[]}`. |
| `debug_metrics.py` | **NEW —** Analyzes a document to determine which mechanism it uses: Track Changes (w:del/w:ins), strikethrough (w:strike), or plain text replacement. Produces diagnostic JSON like `{"strike_runs": 0, "deleted_revisions": 156, "inserted_revisions": 264}`. |
| `hierarchy_builder.py` | `HierarchyBuilder` constructs `DocumentNode` objects. Now passes `revision_fragments` and `tracked_replacement_pairs` to each node. Stores `combined_text` in node metadata. |
| `node_builder.py` | `CanonicalDocumentBuilder` orchestrates the full tree build. No changes needed — builds from parsed document, which now includes revision data. |

**The Canonical Tree Structure:**

```
DocumentNode (ROOT)
├── DocumentNode (paragraph, "KEY INFORMATION")
├── DocumentNode (paragraph, "This is a research study...")
├── DocumentNode (table, Table 1)
│   ├── DocumentNode (row, Row 0)
│   │   ├── DocumentNode (cell, Cell 0)
│   │   │   ├── DocumentNode (paragraph, "Sponsor / Study Title:")
│   │   │   └── DocumentNode (paragraph, "<Sponsor> / <Full protocol title>")
│   │   │       revision_fragments: [...]
│   │   │       tracked_replacement_pairs: [{deleted: "<Sponsor>", inserted: "Stendarr, Inc."}]
│   │   └── DocumentNode (cell, Cell 1)
│   │       └── DocumentNode (paragraph, "Stendarr, Inc.")
│   └── DocumentNode (row, Row 1)
│       ...
├── DocumentNode (list_item, "Be able to follow...")
└── DocumentNode (list_item, "Tell the study staff...")
```

**Track Changes Handling:**

When a DOCX has tracked changes (Word's "Track Changes" feature), placeholders and replacements are stored as:

```xml
<w:del>                                      <!-- The original placeholder -->
    <w:r><w:t><Sponsor></w:t></w:r>
</w:del>
<w:ins>                                      <!-- The replacement text -->
    <w:r><w:t>Stendarr, Inc.</w:t></w:r>
</w:ins>
```

The revision parser extracts these as paired `RevisionFragment` objects:
- `{text: "<Sponsor>", source: "deleted", revision_type: "del"}`
- `{text: "Stendarr, Inc.", source: "inserted", revision_type: "ins"}`

These are detected as a `TrackedReplacementPair`: `{deleted_text: "<Sponsor>", inserted_text: "Stendarr, Inc.", confidence: 0.95}`

### 3.2 placeholders/ — Placeholder Extraction

This module finds all `<placeholder>` tags in the template's canonical tree.

**Key Files:**

| File | Responsibility |
|------|---------------|
| `validator.py` | Regex pattern: `r"<\s*([^<>]+?)\s*>"` — matches `<Sponsor>`, `<Protocol Number>`, etc. |
| `extractor.py` | `PlaceholderExtractor` traverses the tree. Uses `combined_text` (from node metadata) for placeholder detection — this ensures placeholders inside `w:del` elements are found. Also checks `revision_fragments` for edge cases. Tags each occurrence with `revision_source` ("normal" or "deleted"). |
| `occurrence_generator.py` | Counter-based ID generator: `PH_0001`, `PH_0002`, ... |
| `context_extractor.py` | Extracts text immediately before/after the placeholder within the same paragraph. |

**How Extraction Works:**

```python
_get_search_text(node):
    # Use combined_text from metadata if available (includes deleted revisions)
    combined = node.metadata.get("combined_text", "")
    if combined:
        return combined  # Includes placeholders inside w:del
    return node.text     # Regular text for documents without tracked changes
```

### 3.3 classification/ — Type Assignment

Classifies each placeholder into a type. Two-stage approach: syntax rules first, structural rules as fallback.

**Syntax Rules (high priority):**

| Rule | Pattern Matches | Type Assigned |
|------|----------------|---------------|
| `TablesSyntaxRule` | `<Tables: ...>`, `<Extract Tables>` | TABLES |
| `TableSyntaxRule` | `<Table: ...>`, `<Insert Table: ...>`, `<Table X>` | TABLE |
| `FigureSyntaxRule` | `<Figure ...>`, `<Insert Figure>`, `<Figure_...>` | FIGURE |
| `ListSyntaxRule` | `<number list: ...>`, `<bullet list: ...>`, `<Insert Reference List>` | LIST |

**Structural Rules (fallback, tried in order):**

| Rule | Condition | Type | Confidence |
|------|-----------|------|------------|
| `classify_table_cell` | Has `table_path` | TABLE_CELL | 0.98 |
| `classify_structural_list` | Node type is `list_item` | LIST | 0.88 |
| `classify_paragraph` | Standalone paragraph, no inline context, no table_path | PARAGRAPH | 0.90 |
| `classify_keyvalue` (enhanced) | Has inline context OR neighbor context with colon pattern | KEYVALUE | 0.60-0.95 |
| Default fallback | No rule matched | UNKNOWN | 0.0 |

### 3.4 replacement_resolution/ — Matching Engine

The most complex module. Matches template placeholders to generated document nodes.

**Files:**

| File | Responsibility |
|------|---------------|
| `models.py` | `ResolutionResult` (maps occurrence_id → generated_node_id with score/status) and `CandidateMatch` (stores individual scores) |
| `scoring.py` | `ResolutionScorer` — defines weights and similarity functions |
| `matching_engine.py` | Individual scoring functions + `find_best_match()` + `find_revision_pair_match()` |
| `resolver.py` | `PlaceholderResolver` — **the main orchestrator** with 4-level matching |

**The Four-Level Resolution Strategy:**

**Level 1: Tracked Change Pair Match (highest, 0.95)**
- Collects all `w:del` ↔ `w:ins` pairs from the generated doc's XML
- For each template placeholder, checks if its text appears in any pair's deleted text
- Returns the inserted text directly — guaranteed correct
- Covers ~130/151 items in typical ICF document

**Level 2: Inline Context Search (0.85-0.90)**
- For placeholders with text before ("Sponsor:") or after (" / details")
- Searches all generated doc nodes for this context text
- Extracts the text that replaces the placeholder

**Level 3: Label Search (0.85)**
- Builds a label:value map from all generated doc nodes
- Checks if placeholder name matches a label
- Handles compound labels and sub-labels

**Level 4: Word Search (0.65-0.75)**
- Extracts significant words from placeholder name
- Finds best-matching node by word overlap
- Extracts value after nearest colon, or full text

### 3.5 replacement_extraction/ — Content Extraction

After resolution finds which generated node matches each placeholder, this module extracts the actual text.

**Key Design Change:** For tracked pair matches (Level 1), the resolver's `matched_text` is used directly — no re-extraction through type-specific extractors. This prevents corruption of correct answers.

**Files:**

| File | Responsibility |
|------|---------------|
| `extractor.py` | `ReplacementExtractionEngine` — checks resolution method. If tracked_pair/inline_context: uses matched_text directly. Otherwise: uses type-specific extractor. |
| `extractors/keyvalue.py` | **Strategy 0 (NEW):** If matched_text contains no placeholder tag and no colon, return it directly as a replacement value. |
| `extractors/paragraph.py` | Uses visible text (normal + inserted fragments, excluding deleted). |
| Other extractors | Unchanged. |

### 3.6 replacement_reporting/ — Export

Exports the replacement inventory and fragment store as JSON and Excel. Unchanged from previous version.

### 3.7 app/ — Pipeline Orchestration

Unchanged. The pipeline entry points:

| File | Entry Point | What It Runs |
|------|-------------|--------------|
| `pipeline.py` | `PlaceholderPipeline.run(template_docx)` | Phase 1 only (inventory) |
| `classification_pipeline.py` | `ClassificationPipeline.classify_inventory(inventory)` | Phase 2 only |
| `placeholder_resolution_pipeline.py` | `PlaceholderResolutionPipeline.run(...)` | Phase 4 only |
| `document_replacement_pipeline.py` | `DocumentReplacementPipeline.run(template, generated, output_dir)` | **All phases 1-6** |

### 3.8 models/ — Data Models

**`nodes.py`** contains the core data structures:

| Class | Fields | Description |
|-------|--------|-------------|
| `Location` | section, paragraph_index, table_index, row_index, cell_index, table_path, header_index, footer_index | Structural position in the document |
| `ContextWindow` | before_text, after_text | Surrounding paragraph text |
| `RichTextRun` | text, bold, italic, underline, strike, font_name, font_size, color, highlight | Formatted text run |
| `RevisionFragment` | **NEW** text, source ("normal"/"deleted"/"inserted"), revision_type ("del"/"ins"/"moveFrom"/"moveTo") | Text from a Word revision element |
| `TrackedReplacementPair` | **NEW** deleted_text, inserted_text, placeholder, confidence | A matched deletion↔insertion pair |
| `DocumentNode` | id, type, text, children[], rich_runs[], **revision_fragments[]**, **tracked_replacement_pairs[]**, location, context, metadata{}, node_order, parent_id | A node in the canonical document tree |

### 3.9 compare_accuracy.py — QA Comparison

A standalone script that compares pipeline output against a manually-prepared QA report.

**How it works:**

1. Reads QA report Excel file
2. Extracts all QA entries with placeholders
3. Reads pipeline output from `final_outputs/replacement_inventory.xlsx`
4. For each QA entry, finds matching pipeline entry (by normalized placeholder text)
5. Compares: type match, content match (with SequenceMatcher similarity)
6. Strips HTML tags from both sides before comparison
7. Generates `final_outputs/accuracy_report.xlsx` with 4 sheets

**Metrics produced:**
- **Coverage:** % of QA entries found in pipeline output
- **Type accuracy:** Of matched entries, correct type %
- **Content match rate:** Exact matches / Total compared
- **Content match tiers:** Exact (≥95%), High Partial (≥70%), Low Similarity (≥50%), MISMATCH
- **Acceptable rate:** (Exact + High Partial) / Compared

---

## 4. How Components Link Together

### File Dependencies (Top-Down)

```
DocumentReplacementPipeline
    ├── PlaceholderPipeline (for template inventory)
    │   ├── InventoryBuilder
    │   │   ├── load_docx() → doc_parser/
    │   │   ├── CanonicalDocumentBuilder → doc_parser/
    │   │   └── PlaceholderExtractor → placeholders/
    │   └── JsonReporter → reporting/
    ├── ClassificationPipeline
    │   └── PlaceholderClassifier → classification/
    ├── load_docx() + CanonicalDocumentBuilder (for generated tree) → doc_parser/
    │   ├── revision_parser.py (parses w:del/w:ins pairs)
    │   └── debug_metrics.py (optional analysis)
    ├── PlaceholderResolutionPipeline
    │   └── PlaceholderResolver → replacement_resolution/
    │       ├── 4-level matching: tracked pairs → inline context → label → word search
    │       └── matching_engine.py + scoring.py
    ├── ReplacementExtractionEngine → replacement_extraction/
    │   ├── Direct passthrough for tracked pair matches
    │   ├── Type-specific extractors for others
    │   └── FragmentBuilder
    └── ExportService → replacement_reporting/
```

---

## 5. The Four-Level Resolution Strategy

The resolver (`replacement_resolution/resolver.py`) is the most important component. Here's exactly how it works:

### Level 1: Tracked Change Pair Match

```
Input: Placeholder "<Sponsor>"

Step 1: Check if "<Sponsor>" appears in any tracked pair's deleted_text
Step 2: Found in pair: {deleted: "<Sponsor>", inserted: "Stendarr, Inc."}
Step 3: Return "Stendarr, Inc." with confidence 0.95
Step 4: Extraction layer uses this directly, no re-processing
```

### Level 2: Inline Context Search

```
Input: Placeholder "<Sponsor>" with inline_before="Sponsor:"

Step 1: Search ALL generated doc nodes for "Sponsor:"
Step 2: Found in node: "Sponsor / Study Title: Stendarr, Inc."
Step 3: Extract text after "Sponsor:" → first segment → "Stendarr, Inc."
Step 4: Return with confidence 0.85-0.90
```

### Level 3: Label Search

```
Input: Placeholder "<Sponsor>" (type: KEYVALUE, no inline context match)

Step 1: Look up "sponsor" in label_value_map
Step 2: Found: "sponsor" → {value: "Stendarr, Inc.", node: P_0002}
Step 3: Extract value after colon → "Stendarr, Inc."
Step 4: Return with confidence 0.85
```

### Level 4: Word Search

```
Input: Placeholder "<investigational drug name>"

Step 1: Extract significant words: ["investigational", "drug", "name"]
Step 2: Search all nodes for these words
Step 3: Best node has 2/3 words → score 0.65
Step 4: Extract value or full text → return
```

---

## 6. Classification Precedence Rules

### Syntax Rules (checked in order):

```
1. TablesSyntaxRule    → "Tables" in placeholder name → TABLES
2. TableSyntaxRule     → "Table" in placeholder name → TABLE  
3. FigureSyntaxRule    → "Figure" in placeholder name → FIGURE
4. ListSyntaxRule      → "list" in placeholder name → LIST
```

### Structural Rules (checked after syntax, in order):

```
1. has table_path?                    → TABLE_CELL (confidence: 0.98)
2. node_type == "list_item"?          → LIST (confidence: 0.88)
3. no inline context, no table_path?  → PARAGRAPH (confidence: 0.90)
4. has inline context? / neighbor context with colon? → KEYVALUE (confidence: 0.60-0.95)
5. nothing matched?                   → UNKNOWN (confidence: 0.0)
```

---

## 7. Pipeline Entry Points

| Command | What It Does | Output |
|---------|-------------|--------|
| `python tests/run_document_replacement_pipeline.py` | **Full pipeline** | `final_outputs/replacement_inventory.json/.xlsx` + fragment store |
| `python tests/us01_s4_run_pipeline.py` | **Extraction only** | `tests/output/inventory.json` |
| `python main.py` | **Classification only** | `output/classified_inventory.json/.xlsx` |
| `python tests/replacement_resolution/scc_243_run_resolution_pipeline.py` | **Resolution only** | `output/placeholder_resolution.json` |
| `python compare_accuracy.py` | **QA comparison** | `final_outputs/accuracy_report.xlsx` |
| `pytest tests/ -v` | **Run all tests** | Test results |

### Customizing the Pipeline:

Edit `tests/run_document_replacement_pipeline.py` to change input files.

---

## 8. Key Improvements & Changes Log

### Recent Changes (June 2026) — DOCX Track Changes Support

| # | Change | File(s) | Why |
|---|--------|---------|-----|
| 1 | **Added revision_parser.py** | `doc_parser/revision_parser.py` (NEW) | Word Track Changes uses w:del/w:ins instead of w:strike formatting. The parser extracts text from revision elements and detects deletion↔insertion pairs. |
| 2 | **Added debug_metrics.py** | `doc_parser/debug_metrics.py` (NEW) | Reveals which mechanism a document uses (tracked changes vs. strikethrough vs. plain text) with diagnostic JSON output. |
| 3 | **Added RevisionFragment model** | `models/nodes.py` | Text fragments tagged as "normal", "deleted", or "inserted" with revision_type. |
| 4 | **Added TrackedReplacementPair model** | `models/nodes.py` | A matched `w:del` ↔ `w:ins` pair representing a placeholder replacement. |
| 5 | **Rewrote run_normalizer.py** | `doc_parser/run_normalizer.py` | Now returns TWO text fields: `text` (visible only) for matching, `combined_text` (includes deleted) for placeholder detection. Previously used only visible text. |
| 6 | **Revised placeholder extractor** | `placeholders/extractor.py` | Searches `combined_text` (from metadata) for placeholders. Also checks `revision_fragments` for edge cases. Tags occurrences with `revision_source`. |
| 7 | **Rewrote resolver** | `replacement_resolution/resolver.py` | New 4-level strategy: (1) Tracked pair match, (2) Inline context search, (3) Label search, (4) Word search. Tracked pairs give 0.95 confidence. |
| 8 | **Fixed extraction layer** | `replacement_extraction/extractor.py` | For tracked pair matches and inline context matches, uses the resolver's `matched_text` directly instead of re-extracting through type-specific extractors. |
| 9 | **Enhanced KEYVALUE extractor** | `replacement_extraction/extractors/keyvalue.py` | Strategy 0: if matched_text has no placeholder tag and no colon, return it directly as the replacement value. |
| 10 | **Enhanced KEYVALUE classifier** | `classification/structural/keyvalue_rules.py` | Also checks neighbor context for colon patterns, not just inline context. Raises confidence with more evidence. |
| 11 | **Fixed compare_accuracy.py** | `compare_accuracy.py` | Strips HTML tags before similarity comparison. Properly handles "QA EMPTY" entries. Granular similarity tiers (≥95%, ≥70%, ≥50%). |

---

## 9. Running Tests

Run all tests:
```bash
pytest tests/ -v
```

Run specific test groups:
```bash
# Extraction tests
pytest tests/test_ph_detect_ctx_ext.py -v

# Classification tests
pytest tests/classification/ -v

# Resolution tests
pytest tests/replacement_resolution/ -v

# Extraction + Export tests
pytest tests/replacement_extraction/ -v
pytest tests/replacement_reporting/ -v

# DOCX parser tests
pytest tests/doc_parser/ -v
pytest tests/test_canonical_document_builder.py -v
```

**Current test count:** 100 tests, 99 passing (1 pre-existing missing `python-docx` dependency).

---

## 10. Output Files Explained

### `final_outputs/replacement_inventory.xlsx`

| Column | Description |
|--------|-------------|
| Occurrence ID | Links back to the template placeholder |
| Placeholder | The original `<placeholder>` tag |
| Type | KEYVALUE, PARAGRAPH, LIST, TABLE_CELL, etc. |
| Status | RESOLVED or UNRESOLVED |
| Replacement Content | The extracted text from the generated document |
| Confidence | Match score (0.0 - 1.0) |
| Generated Node ID | Which node in the generated tree matched |

### `final_outputs/accuracy_report.xlsx`

| Sheet | Content |
|-------|---------|
| QA vs Pipeline Comparison | Every QA entry vs pipeline: placeholder, type, AI text, pipeline text, similarity, color-coded |
| Missing in Pipeline Output | QA entries the pipeline didn't capture |
| Extra in Pipeline (not in QA) | Pipeline entries not in QA report |
| Summary | Overall metrics: coverage, type accuracy, content match |

---

## 11. Data Flow Diagrams

### Simplified End-to-End Flow

```
Template DOCX        Generated DOCX (with Track Changes)
    |                      |
    v                      v
[Parse DOCX]          [Parse DOCX + Revisions]
    |                      |
    v                      |
[Find Placeholders]        |
(incl. in w:del)           |
    |                      |
    v                      |
[Classify Types]           |
    |                      |
    |------+--------------+
           |
           v
    [Match Placeholders to Generated Nodes]
    Level 1: Tracked Pair Match (130/151)
    Level 2: Inline Context Search
    Level 3: Label Search  
    Level 4: Word Search
           |
           v
    [Extract Replacement Content]
    (Use matched_text directly for L1/L2)
           |
           v
    [Export JSON + Excel]
           |
           v
    [Compare vs QA Report (optional)]
```

### Revision Parsing Detail

```
DOCX XML (word/document.xml)
    |
    v
revision_parser.parse_paragraph_revisions()
    |
    For each <w:p> in the XML:
    |
    +-- <w:r><w:t>Normal text</w:t></w:r>   → source: "normal"
    |
    +-- <w:del>                                → source: "deleted"
    |       <w:r><w:t><Sponsor></w:t></w:r>
    |   </w:del>
    |
    +-- <w:ins>                                → source: "inserted"
    |       <w:r><w:t>Stendarr, Inc.</w:t></w:r>
    |   </w:ins>
    |
    = Detect pairs: adjacent del→ins → TrackedReplacementPair
    = Build combined_text: "Normal text<Sponsor>Stendarr, Inc."
    = Build visible_text: "Normal textStendarr, Inc."