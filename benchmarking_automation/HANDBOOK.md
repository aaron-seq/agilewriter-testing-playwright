# AgileWriter Benchmarking Automation - Developer Handbook

## 1. System Overview

AgileWriter Benchmarking Automation validates AgileWriter-generated documents before human review begins. The system reads DOCX files at the XML level, reconstructs human-visible text that Microsoft Word may split across many runs, builds a canonical document tree, and feeds placeholder detection and later replacement validation.

It was built because generated clinical and regulatory documents need repeatable evidence for placeholder replacement accuracy, structural integrity, and formatting readiness. Manual review alone is slow, inconsistent, and difficult to audit.

This system does not decide clinical correctness, approve final documents, or replace human quality review. It provides a deterministic pre-review signal and structured evidence for reviewers.

## 2. Architecture

### 2.1 Layer Architecture

```text
+-----------------------------+
| DOCX template / output file |
+-------------+---------------+
              |
              v
+-----------------------------+
| ST1 parser/                 |
| ZIP extraction + XML parse  |
+-------------+---------------+
              |
              v
+-----------------------------+
| ST2 normalizer/             |
| Run reconstruction + tree   |
+-------------+---------------+
              |
              v
+-----------------------------+
| ST3 placeholders/           |
| Placeholder inventory       |
+-------------+---------------+
              |
              v
+-----------------------------+
| ST4 replacement detector    |
| Alignment + scoring         |
+-----------------------------+
```

### 2.2 Data Flow: DOCX To Canonical Tree To Placeholder Inventory

1. `parser.docx_extractor.DocxExtractor` opens the DOCX as a ZIP archive.
2. `parser.xml_parser.load_docx()` parses `word/document.xml`, headers, footers, styles, and numbering into `ParsedDocument`.
3. `normalizer.run_reconstructor.reconstruct_paragraph_text()` merges fragmented `w:r/w:t` text inside each paragraph.
4. `normalizer.canonical_tree_builder.build_canonical_tree()` emits ordered `DocumentNode` records for body, table cells, headers, and footers.
5. The placeholder layer applies the placeholder regex to each reconstructed node and attaches inline and neighbor context.

### 2.3 Module Dependency Map

```text
parser/docx_extractor.py -> parser/xml_models.py
parser/xml_parser.py     -> parser/docx_extractor.py, parser/xml_models.py
normalizer/run_reconstructor.py
normalizer/node_models.py
normalizer/canonical_tree_builder.py -> parser/xml_models.py, normalizer/*
placeholders/*           -> normalizer.node_models
```

## 3. Why This Approach Is Correct

### 3.1 The Word Run Fragmentation Problem

Microsoft Word stores a single visible paragraph as many run elements. Formatting, spell-check, edits, and cursor history can split one placeholder into pieces.

```xml
<w:p>
  <w:r><w:t>&lt;Pat</w:t></w:r>
  <w:r><w:t>ient</w:t></w:r>
  <w:r><w:t>_Name&gt;</w:t></w:r>
</w:p>
```

The visible text is:

```text
<Patient_Name>
```

Without run reconstruction, a placeholder regex sees only fragments and silently misses the placeholder.

### 3.2 Why python-docx Was Rejected

`python-docx` is useful for high-level document editing, but it abstracts away internal OOXML details that matter for validation. It can hide headers, footers, numbering details, field instructions, deleted text, and exact run boundaries. This project needs audit-grade extraction, so it reads OOXML directly.

### 3.3 Why lxml Direct Parsing Was Chosen

`lxml` gives precise namespace-aware XPath traversal over WordprocessingML. That lets the parser distinguish visible `w:t` text from field instructions such as `w:instrText`, deleted text such as `w:delText`, and structural nodes such as tables, rows, and cells.

### 3.4 Why the Canonical Tree Pattern Was Chosen

The canonical tree is an intermediate representation that downstream code can trust. It converts Word XML complexity into a flat ordered list of paragraph nodes with stable IDs, text, and location metadata. Placeholder detection should not need to know about ZIP files, XML namespaces, run fragmentation, or table traversal.

### 3.5 Why TDD Is Mandatory For This System

One missing space, one skipped run, or one wrong table coordinate can cause false placeholder misses. Tests define the extraction contract before implementation so downstream placeholder classification and replacement detection do not inherit silent extraction errors.

## 4. Module Reference

### 4.1 `parser/` - DOCX Extraction Layer (ST1)

`parser/` opens DOCX files as ZIP archives and parses internal XML into lxml trees.

Important files:

- `docx_extractor.py`: reads `word/document.xml`, headers, footers, styles, and numbering.
- `xml_parser.py`: converts XML bytes to lxml elements and exposes `load_docx()`.
- `xml_models.py`: defines `XmlPart`, `ParsedXmlPart`, and `ParsedDocument`.

Example:

```python
from parser.xml_parser import load_docx

parsed = load_docx("benchmarking_automation/tests/basic_sample_template.docx")
print(parsed.document_xml.name)
print(len(parsed.headers))
```

### 4.2 `normalizer/` - Run Reconstruction And Canonical Tree (ST2)

`normalizer/` converts parsed XML into canonical nodes.

Important files:

- `run_reconstructor.py`: `reconstruct_paragraph_text(paragraph_element)`.
- `canonical_tree_builder.py`: `build_canonical_tree(parsed_document)`.
- `node_models.py`: `Location`, `DocumentNode`, `CanonicalDocumentTree`.

Example:

```python
from parser.xml_parser import load_docx
from normalizer.canonical_tree_builder import build_canonical_tree

parsed = load_docx("benchmarking_automation/tests/basic_sample_template.docx")
tree = build_canonical_tree(parsed)

for node in tree.nodes:
    print(node.node_id, node.location.section, node.text)
```

### 4.3 `placeholders/` - Detection And Context Extraction (ST3)

The placeholder layer consumes `CanonicalDocumentTree.nodes`. For each node, it applies the placeholder pattern, records occurrence IDs, and captures both inline and neighbor context.

Expected output shape:

```python
{
    "occurrence_id": "PH_0001",
    "placeholder": "<Patient_Name>",
    "node_id": "P_0002",
    "node_type": "paragraph",
    "section": "document",
    "paragraph_index": 1,
    "table_index": None,
    "matched_text_span": {"start": 14, "end": 28},
    "inline_context": {"before": "Patient Name:", "after": ""},
    "neighbor_context": {
        "before": "Patient Medical Summary",
        "after": "Date of Birth: <DOB>"
    }
}
```

## 5. How To Run

### 5.1 Setup

```bash
cd benchmarking_automation
python -m pip install -r requirements.txt
```

If running tests from the repository root, use:

```bash
pytest benchmarking_automation/
```

### 5.2 Running Tests

Run ST2 only:

```bash
pytest benchmarking_automation/normalizer/tests/
```

Run ST1 parser regression:

```bash
pytest benchmarking_automation/tests/test_parser.py
```

Run all available tests:

```bash
pytest benchmarking_automation/
```

### 5.3 Running Against A Real DOCX

```python
from parser.xml_parser import load_docx
from normalizer.canonical_tree_builder import build_canonical_tree

parsed = load_docx("benchmarking_automation/tests/basic_sample_template.docx")
canonical_tree = build_canonical_tree(parsed)

print(f"Nodes: {len(canonical_tree.nodes)}")
print(canonical_tree.nodes[0])
```

### 5.4 Adding A New Template

1. Add the DOCX fixture under `benchmarking_automation/tests/`.
2. Add a focused integration test that calls `load_docx()` and `build_canonical_tree()`.
3. Assert node count, key placeholder text, and any expected table/header/footer locations.
4. Avoid hardcoded absolute paths; derive fixture paths from `Path(__file__).parent`.

## 6. Output Format Reference

### 6.1 `ParsedDocument` Schema

```python
@dataclass
class ParsedDocument:
    document_xml: ParsedXmlPart
    headers: list[ParsedXmlPart]
    footers: list[ParsedXmlPart]
    styles: ParsedXmlPart | None
    numbering: ParsedXmlPart | None
```

### 6.2 `CanonicalDocumentTree` And `DocumentNode` Schema

```python
@dataclass
class Location:
    section: str
    paragraph_index: int
    table_index: int | None = None
    row_index: int | None = None
    cell_index: int | None = None
    table_path: str | None = None
    is_list_item: bool = False

@dataclass
class DocumentNode:
    node_id: str
    node_type: str
    text: str
    location: Location

@dataclass
class CanonicalDocumentTree:
    nodes: list[DocumentNode]
```

ST2 intentionally keeps `CanonicalDocumentTree` as a flat ordered list. ST4 may add lookup indexes such as `nodes_by_section` or `nodes_by_table_path` after real alignment access patterns are known; those should be sidecar indexes, not a replacement for the canonical ordered node list.

Example table-cell node:

```python
DocumentNode(
    node_id="P_0007",
    node_type="paragraph",
    text="<Patient_Name>",
    location=Location(
        section="document",
        paragraph_index=0,
        table_index=0,
        row_index=1,
        cell_index=1,
        table_path="T1/R2/C2",
        is_list_item=False,
    ),
)
```

### 6.3 Placeholder Inventory JSON Schema

```json
{
  "occurrence_id": "PH_0001",
  "placeholder": "<Patient_Name>",
  "node_id": "P_0002",
  "node_type": "paragraph",
  "section": "document",
  "paragraph_index": 1,
  "table_index": null,
  "matched_text_span": {"start": 14, "end": 28},
  "row_index": null,
  "cell_index": null,
  "table_path": null,
  "inline_context": {"before": "Patient Name:", "after": ""},
  "neighbor_context": {
    "before": "Patient Medical Summary",
    "after": "Date of Birth: <DOB>"
  }
}
```

## 7. Placeholder Extraction: Why It Is 100% Correct

### 7.1 The Regex Pattern Explained

The placeholder detector uses:

```python
r"<\s*([^<>]+?)\s*>"
```

It matches text between angle brackets, allows whitespace near the name, and avoids crossing nested bracket boundaries.

### 7.2 Why Reconstruction Guarantees Full Coverage

Run reconstruction concatenates every visible `w:t` descendant in document order before regex matching. That means placeholders split across any number of runs become one searchable string.

### 7.3 The Two-Context Model

`inline_context` captures text before and after the placeholder inside the same paragraph. `neighbor_context` captures nearby paragraph text before and after the node. Replacement detection needs both because some placeholders are self-describing inline, while others rely on headings or neighboring labels.

### 7.4 Occurrence ID Uniqueness Guarantee

Occurrence IDs should be assigned after canonical tree ordering is fixed. A monotonic counter such as `PH_0001`, `PH_0002`, and `PH_0003` is stable because the canonical tree traversal order is deterministic.

### 7.5 Known Limitations

- Nested tables are not fully modeled in ST2; they are guarded to avoid crashes, but nested table paragraph extraction is deferred.
- Images, charts, shapes, text boxes, comments, and footnotes are out of scope.
- Field result text is only included when represented as visible `w:t`.
- Formatting comparison is deferred to later validation layers.

## 8. Test Strategy

### 8.1 Test Pyramid

```text
Many unit tests        - XML snippets for run and structure rules
Some integration tests - Real DOCX parser + canonical tree
Few end-to-end tests   - Full validation workflow with generated output
```

### 8.2 ST1 Test Cases

ST1 verifies DOCX opening, document XML extraction, header parsing, footer parsing, table detection, and invalid DOCX handling.

### 8.3 ST2 Test Cases

ST2 verifies:

- ST2-TC01 single-run reconstruction.
- ST2-TC02 multi-run concatenation.
- ST2-TC03 fragmented placeholder reconstruction.
- ST2-TC04 preserved mid-string spaces.
- ST2-TC05 field instruction exclusion.
- ST2-TC06 empty paragraph safety.
- ST2-TC07 table path metadata.
- ST2-TC08 header sections.
- ST2-TC09 footer sections.
- ST2-TC10 global node ID sequencing.
- ST2-TC11 document, header, footer ordering.
- ST2-TC12 list item flagging.
- ST2-TC13 real DOCX integration.
- ST2-TC14 non-table metadata defaults.
- ST2-TC15 tracked-deletion `w:delText` exclusion.
- ST2-TC16 nested table no-crash guard.

### 8.4 ST3 Test Cases

ST3 should verify placeholder regex matches, occurrence IDs, duplicate placeholder handling, inline context, neighbor context, table metadata propagation, and no false positives for normal angle-bracket-free text.

### 8.5 Writing New Tests

Prefer minimal XML fixtures with `lxml.etree.fromstring()` for unit tests. Use real DOCX fixtures only when verifying parser-to-normalizer integration. Each test should have a docstring with the ticket/test-case intent.

## 9. Extending The System

### 9.1 Adding A New Document Section Type

Add the XML part to ST1 extraction, parse it into `ParsedDocument`, then add a section traversal in ST2 with a stable section name such as `footnote_0`.

### 9.2 Supporting Nested Tables

Extend table traversal to detect `w:tbl` inside cells and represent nested paths such as `T1/R2/C2/T1/R1/C1`. Add tests before implementation because nested table indexing is easy to get wrong.

### 9.3 Adding A New Output Format

Keep the canonical tree unchanged and add a serializer layer. Good candidates are JSON, CSV, and XLSX. Do not add presentation-specific fields to `DocumentNode`.

### 9.4 Plugging In The Replacement Detector (ST4 Preview)

ST4 should consume placeholder inventory and a generated-document canonical tree. It can align by placeholder name, section, table path, inline context, and neighbor context, then emit replacement status and comparison evidence.

## 10. Architecture Decision Records

### ADR-001: Direct lxml Over python-docx

Decision: Use `lxml` over `python-docx` for extraction and traversal.

Rationale: Validation depends on exact OOXML structure, including runs, headers, footers, tables, field instructions, and deleted text. High-level document APIs hide too much detail.

### ADR-002: Canonical Tree As Intermediate Representation

Decision: Convert parsed OOXML into a canonical tree before placeholder detection.

Rationale: Downstream modules should operate on stable text and metadata, not raw XML implementation details.

### ADR-003: Two-Context Model

Decision: Store both inline and neighbor context for each placeholder occurrence.

Rationale: Inline context identifies local labels, while neighbor context preserves heading and surrounding paragraph meaning for alignment.

### ADR-004: TDD-First Development Mandate

Decision: Write extraction tests before implementation.

Rationale: Placeholder detection fails silently when reconstruction is wrong. TDD makes character-level and structural contracts explicit before downstream work depends on them.
