# placeholder_inventory

Extracts every placeholder from a `.docx`.

```bash
python -m placeholder_inventory "Template.docx" --reference -o ref_Template.xlsx
python -m placeholder_inventory "Template.docx" --list    # print them
python -m placeholder_inventory "Final.docx"    --json    # machine-readable
```

## The two jobs it does

**Starting a reference file.** A reference file is what QA authors: what each
placeholder *should* contain. `--reference` gives you every placeholder with
the expected text blank, ready to fill in. That is the answer key.

**Checking AgileWriter's output.** Run it against a generated `.docx` and any
placeholder it finds was never replaced. `IDE196-002_CSR_Draft1_Final.docx`
shipped with 12 of them, so this is worth doing every time.

> A **raw QA file** is AgileWriter's own Excel output. This tool does not
> produce one and cannot - only AgileWriter can.

## Where it came from

Two extractors already existed in this codebase and each had something the
other lacked:

| | `test-openai-benchmark` | `benchmarking_automation` |
|---|---|---|
| Scans headers/footers, not just `document.xml` | yes | no |
| Flattens runs before matching | yes | yes |
| Reads tracked-change text (`w:delText`) | **no** | yes |
| Noise filtering | yes | partial |
| Tests | **none (0 of 131 files)** | 100 |

The run-flattening matters because Word splits `<Study Title>` across runs
whenever formatting changes mid-word — matching per run finds nothing. The
`w:delText` gap matters because a template with tracked changes stores its
placeholders in deletions, so a `w:t`-only scanner returns an empty list.

This module takes both, plus structure read from the document tree.

## Accuracy

Measured against `ICF_SET0 (1).docx` with `reference_files/ref_ICF_Full.xlsx`
as ground truth:

- **Extraction: 100%.** All 68 real reference placeholders found, zero false
  positives.
- **Classification: 70%** of the rows the reference itself classifies.

Two caveats worth knowing, both properties of the reference file rather than
the extractor:

1. `ref_ICF_Full.xlsx` contains a corrupted row reading
   `...for screening, screeningthe clinic, follow-up periods`. The template says
   `time in the clinic`. That text exists nowhere in the document, so it can
   never be extracted — or matched. It is silently costing you a row on every
   accuracy run today.
2. The reference's own type labels are inconsistent. The identical pattern
   `Bullet list of lay terminology of all assessments required during X` is
   labelled `List` on twelve rows, `Paragraph` on two, and `Unknown` on one.
   100% classification against it is not achievable, and chasing it would mean
   overfitting to transcription noise.

Classification uses the placeholder's wording first and document structure only
as a tie-break. Structure-first scored 50%, because ICF_SET0 uses numbered
paragraphs for ordinary sections, so `<w:numPr>` marks most of the body.

## Tests

```bash
python -m pytest placeholder_inventory -q
```

19 tests, including run-splitting, tracked deletions, headers/footers, a
malformed part, and a check that every reference placeholder is found in the
real template.
