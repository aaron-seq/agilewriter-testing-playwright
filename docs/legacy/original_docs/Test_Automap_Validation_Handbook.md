Document Status: Historical
Superseded By: TBD
Reason Preserved: Original implementation retained

# Test Automap Validation Handbook

## What this repo does

This repository is a Python document validation pipeline for comparing a template-driven reference document against a test document after placeholder extraction and alignment. It reads DOCX files, produces intermediate text dumps and JSON placeholder maps, reconstructs aligned "final" JSONs for reference and test, then validates each placeholder with exact/normalized comparison for short values and OpenAI-backed semantic comparison for longer text. It also supports a pytest HTML report where each placeholder is treated as its own test case.

## Main entry points

- `main.py`

  - Primary pipeline entry point.
  - Runs extraction, JSON generation, alignment, missing-placeholder recovery, final JSON generation, and TXT validation reporting.
- `tests/test_placeholder.py`

  - Secondary validation entry point after `main.py` has already produced final JSON files.
  - Uses `pytest` plus `pytest-html` to generate a browsable HTML validation report.

## Algorithms implemented

### 1. DOCX structural text extraction

Implemented in:

- `parser/text_extractor.py`

What it does:

- Walks DOCX headers, footers, body, and tables with `python-docx`
- Detects placeholders using angle brackets like `<Placeholder>`
- Writes line-oriented text dumps
- Preserves structural markers:

  - `__TABLE_START__` / `__TABLE_END__`
  - `__BULLET_START__` / `__BULLET_END__`
  - `__STRIKE__` prefix for deleted text
- Skips color-coded text in templates for selected colors

When to use:

- When you need a deterministic, parser-first representation of a DOCX before any comparison happens

Strengths:

- Understands headers, footers, tables, bullets, and deleted text
- Produces intermediate text dumps that are easy to inspect
- Useful for placeholder alignment, not just raw text extraction

Weaknesses:

- DOCX-only in the current implementation
- Relies on placeholder tokens and Word XML patterns already being consistent
- Color-based skip logic is document-style dependent

### 2. Placeholder normalization and JSON skeleton generation

Implemented in:

- `mapper/placeholder_mapper.py`
- `mapper/template_engine.py`

What it does:

- Repairs broken placeholders split across lines
- Extracts placeholders into JSON keys
- Builds aligned reference/test JSON skeletons from the template JSON
- Fills present values directly
- Detects placeholders already replaced or extra in the reference/test documents

When to use:

- When a template is the source of truth and you need both documents normalized onto the same placeholder set

Strengths:

- Good for template-governed document families like CSR, ICF, CEPI
- Makes missing and extra placeholder diagnostics explicit
- Keeps alignment deterministic and inspectable

Weaknesses:

- Assumes template placeholders are the master contract
- Alignment logic is heuristic and line-order sensitive
- Not ideal for documents whose output order has changed significantly

### 3. Heuristic recovery for missing placeholders

Implemented in:

- `mapper/template_engine.py`

What it does:

- Uses previous/next known placeholder anchors in text dumps
- Extracts table blocks or paragraph/bullet regions between anchors
- Rebuilds values for placeholders that disappeared from the original JSON extraction
- Produces aligned/final JSONs and "vanished placeholder" diagnostics

When to use:

- When placeholders are not directly preserved in one or both documents and you still need to recover their values

Strengths:

- Gives the pipeline a second chance before validation
- Handles bullets and tables explicitly
- Produces debug artifacts like boundary reports

Weaknesses:

- Heuristic, not semantic
- Can drift if anchor order changes or repeated structures appear
- Harder to generalize to arbitrary documents without template discipline

### 4. Strict normalized comparison

Implemented in:

- `validator/comparator.py`

What it does:

- Normalizes values with lowercasing and trimming
- Passes exact normalized text matches
- Passes exact numeric matches for numeric types
- Fails short non-exact values without fuzzy fallback

When to use:

- Short fields where wording flexibility is not desired
- IDs, names, scalar values, and tightly controlled placeholders

Strengths:

- Deterministic
- Cheap
- Easy to reason about in test reports

Weaknesses:

- Too strict for paraphrased long text
- No token-level or edit-distance fuzzy scoring for short non-exact text

### 5. LLM semantic comparison for long text

Implemented in:

- `validator/llm_compare.py`
- called from `validator/comparator.py`

What it does:

- Sends long text pairs to OpenAI `gpt-4.1-mini`
- Requests a strict JSON response with `score`, `verdict`, and `reason`
- Uses a threshold of `0.75`
- Caches repeated text-pair comparisons in-memory inside the current run

When to use:

- Paragraph-like placeholders where meaning matters more than wording

Strengths:

- Handles paraphrase better than exact matching
- Produces human-readable reasoning
- Helps with long-form AI-generated content

Weaknesses:

- Requires `OPENAI_API_KEY`
- Adds latency and external API dependency
- Cache is process-local only
- Scores are model-mediated, not purely deterministic in the mathematical sense even with `temperature=0`

### 6. HTML report rendering via pytest hooks

Implemented in:

- `tests/conftest.py`

What it does:

- Adds placeholder, expected, actual, and status columns to pytest HTML output
- Tracks pass/fail accuracy across placeholder tests
- Highlights mismatched words in red for the HTML report

When to use:

- When a reviewer needs a visually navigable report instead of raw TXT only

Strengths:

- Familiar test-report workflow
- One placeholder per test case
- Easy to share with non-developers

Weaknesses:

- Depends on final JSONs already existing
- Word-level highlighting is simple positional highlighting, not semantic diffing

## Algorithms not present

- Dice coefficient or Sørensen-Dice scoring: not implemented in this repo
- Embedding-vector similarity search: not implemented directly
- Cosine similarity over embeddings: not implemented directly

The semantic layer here is prompt-based LLM comparison, not embedding retrieval or vector scoring.

## Input format

The pipeline expects three DOCX inputs under a selected prefix folder such as `csr/`, `icf/`, or `cepi/`:

- `<prefix>/data/<prefix>_template.docx`
- `<prefix>/data/<prefix>_reference.docx`
- `<prefix>/data/<prefix>_test.docx`

The active document family is selected indirectly in `utils/config.py` through:

- `REF_FILE = "csr/data/csr_reference.docx"`

That file path is used to derive:

- `prefix = csr | icf | cepi`
- `version = v1.1.00`

Environment input:

- `.env` with `OPENAI_API_KEY=...`

## Output format

Outputs are written under `<prefix>/output/` and include:

- text dumps:

  - `<prefix>_template_text_dump_<version>.txt`
  - `<prefix>_reference_text_dump_<version>.txt`
  - `<prefix>_test_text_dump_<version>.txt`
- initial JSON maps:

  - `<prefix>_template_<version>.json`
  - `<prefix>_reference_<version>.json`
  - `<prefix>_test_<version>.json`
- aligned and final JSONs:

  - `<prefix>_aligned_reference_<version>.json`
  - `<prefix>_aligned_test_<version>.json`
  - `<prefix>_final_reference_<version>.json`
  - `<prefix>_final_test_<version>.json`
- diagnostics:

  - already replaced in reference/test
  - extra in reference
  - boundary debug
  - vanished in reference/test
- reports:

  - TXT validation report from `compare_json`
  - HTML pytest report when pytest is run manually

## How to run it

### Python version

No explicit Python version pin is declared in the repo. Based on the codebase, use Python `3.10+` as the practical default.

Reason:

- f-strings are used throughout
- modern package compatibility is simplest on 3.10+
- no syntax requires something newer than that

### Install dependencies

```bash

pip install -r requirements.txt

```

Dependencies listed:

- `pytest`
- `openai`
- `pytest-html`
- `python-dotenv`
- `python-docx`

### Configure API key

Create a `.env` file in the repo root:

```env

OPENAI_API_KEY=your_api_key_here

```

### Choose the active document family

Edit `utils/config.py` and set:

```python

REF_FILE = "csr/data/csr_reference.docx"

```

Use `csr`, `icf`, or `cepi` as needed.

### Run the full pipeline

```bash

python main.py

```

### Run placeholder-level HTML validation after the pipeline

```bash

python -m pytest -v --html=output/report.html --self-contained-html

```

Note:

- `tests/test_placeholder.py` expects the final JSON outputs to already exist.
- In practice, run `python main.py` first.

## Integration notes for our Node.js server

This repo is a good candidate for external integration from `server/test-runner-server.js`, but it should stay isolated from the Playwright repo rather than being merged into the TypeScript runtime directly.

### Option 1: Subprocess execution

Best for a first integration.

Pattern:

- Node writes or copies the three source DOCX files into the selected prefix data folder
- Node updates a config value or passes an override
- Node runs `python main.py`
- Node reads final JSON/TXT/HTML outputs and surfaces them in the UI

Pros:

- Lowest engineering risk
- Keeps Python dependencies isolated
- Easy to swap out later

Cons:

- Requires Python environment on the host
- Harder to stream structured progress unless stdout is parsed

### Option 2: Lightweight REST wrapper around Python

Pattern:

- Wrap the Python pipeline in Flask or FastAPI
- Node uploads documents or a job spec
- Python returns paths or structured JSON results

Pros:

- Cleaner separation of concerns
- Easier long-term service boundary
- Better for multi-user or remote execution

Cons:

- More moving parts
- Additional deployment/runtime management

### Option 3: Shared file handoff

Pattern:

- Node writes inputs to a watched folder
- Python runs on demand or on a scheduler
- Node only polls result artifacts

Pros:

- Simple integration contract
- Good for batch/offline runs

Cons:

- Weak request/response ergonomics
- Harder to debug job ownership and timing

Recommended starting path:

- Use subprocess execution first.

## What we can borrow into the TypeScript accuracy scorer

These are the most reusable ideas from this repo:

- `fix_broken_placeholders()` from `mapper/placeholder_mapper.py`

  - Good candidate for porting into TypeScript when placeholders split across lines or OCR-style spacing damage occurs
- Structural markers from `parser/text_extractor.py`

  - The `__TABLE_START__`, `__TABLE_END__`, `__BULLET_START__`, `__BULLET_END__`, and `__STRIKE__` approach is worth copying if we expand beyond flat Excel-only scoring
- Missing-placeholder recovery logic from `mapper/template_engine.py`

  - The anchor-based recovery between previous/next placeholders could inform a second-pass TypeScript recovery mode for raw DOCX comparison
- Comparator split by text length from `validator/comparator.py`

  - The idea of routing short values to strict comparison and long values to semantic comparison fits our TypeScript scorer well
- Process-local semantic cache from `validator/comparator.py`

  - The in-memory `(ref, test)` cache is a cheap win for repeated comparisons
- HTML report concept from `tests/conftest.py`

  - Not the exact implementation, but the report shape is useful for a stakeholder-facing diff table

## What not to borrow directly

- `utils/config.py` global `REF_FILE` switch

  - For our Node/Playwright workflow, request-scoped inputs are better than editing a shared config file
- Import-time OpenAI client failure in `validator/llm_compare.py`

  - In our server flow, failing during import is brittle; lazy initialization with explicit route-time error handling is safer
- Strict fail-only short-text logic in `smart_compare()`

  - Our TypeScript scorer already supports more graded thresholds, which is a better fit for mixed placeholder types

## Practical takeaway for the AgileWriter suite

This Python repo is strongest as a reference implementation for DOCX structure extraction, placeholder repair, and second-pass alignment, especially when exact placeholder matching breaks down. Its main semantic comparison path is useful, but it is prompt-based LLM scoring rather than embedding similarity or Dice coefficient math. For our Playwright/Node stack, the most valuable borrowable pieces are the extraction and alignment heuristics, while the cleanest integration path is a subprocess job that hands off files and reads back final JSON/report artifacts.

