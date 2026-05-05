# What is This Document

Welcome! If you are reading this, you want to understand how we automatically grade the AI's performance.

When AgileWriter generates a document, it fills in dozens of placeholders. Currently, a human QA engineer (like Anil) opens an Excel file and manually reads every single AI-generated answer to check if it's correct. This is slow and tedious.

This document explains the **Accuracy Scorer** — a tool we built to automate that exact checking process. Whether you are a product owner trying to understand how we measure "accuracy", or a developer who needs to tweak the scoring math, this guide will walk you through the *why*, *how*, and *what* of the accuracy checking pipeline.

# Why We Built the Accuracy Scorer

Imagine taking a 100-question test, but instead of the teacher grading it automatically, they have to read every single word you wrote and compare it to their answer key in their head. That is what our manual QA process looked like.

We built the Accuracy Scorer to be the automatic grader. It takes the AI's "test answers" (the raw QA export) and compares them to an "answer key" (the reference file). It then grades every single answer mathematically and produces a detailed 8-sheet Excel report.

Our goal is **not to replace Anil's human judgment.** Instead, the goal is to *pre-grade* the easy answers. If the AI perfectly matched the answer key, the scorer marks it as a "Match". Anil can then safely skip reading those rows and focus 100% of his time on the tricky "Partial Match" or "No Match" rows.

# The Four Files and What Each One Does

The Accuracy Scorer is powered by four specific files in the codebase. Here is how they work together:

```
tests/helpers/reference-file-loader.ts
```
This is the file reader. It opens the "answer key" (like `ref_ICF_Full.xlsx`) and reads every row. It exports a function that returns a Map where the key is the placeholder name, and the value is a list of all the expected answers for that name.

```
tests/helpers/accuracy-scorer.ts
```
This is the mathematical brain. It opens the raw QA Excel file containing the AI's answers. For every answer, it asks the file reader for the correct answer key, and then calculates exactly how similar the two pieces of text are. It exports the final graded results.

```
tests/helpers/accuracy-report-writer.ts
```
This is the printer. It takes the graded results from the brain and writes them out into a massive, heavily formatted 8-sheet Excel document and a JSON file. It also prints a quick summary table to your terminal.

```
tests/accuracy.spec.ts
```
This is the entry point. When you want to run the scorer, you run this file. It acts as the manager: it looks at your environment variables to find out which files to use, and then tells the reader, the brain, and the printer to do their jobs in order.

<!-- ADDED May 2026 -->
# Running the Scorer from the Browser UI

As of May 2026, there is a faster way to run the accuracy scorer without touching the terminal.

1. Start the server: `node server/test-runner-server.js`
2. Open `http://localhost:3000/ui/` in your browser.
3. Scroll down to the **Accuracy Scorer** panel and click the header to expand it.
4. Select a **Reference File** from the dropdown. These are loaded from the `reference_files/` folder.
5. Select a **Raw QA File** from the dropdown. These are loaded from the `raw_qa_files/` folder (newest first).
6. Click **Run Accuracy Score**.
7. The result card shows:
   - **Overall Accuracy** as a large percentage
   - **Per-type breakdown table** (Type / Total / Correct / Accuracy)
   - A **Download Excel Report** link

If you see a warning banner, it means:
- **"Reference file loaded 0 entries"** — your reference file has no data rows, or the column layout doesn't match what the loader expects.
- **"All rows returned Missing Reference"** — the raw QA file and reference file are probably for different document types (e.g., CSR QA file with ICF reference).

<!-- ADDED May 2026 -->
# Input Folders

Two folders support the accuracy scoring workflow. Both are auto-created by the server if they don't exist.

| Folder | What Goes Here | Who Fills It |
|--------|---------------|--------------|
| `reference_files/` | Excel "answer keys". Each file contains the correct expected text for every placeholder in a specific document type. Example: `ref_ICF_Full.xlsx` | Anil / Aaron |
| `raw_qa_files/` | The raw QA Excel file downloaded after each AgileWriter training run. Drop it here before scoring. | You (the tester) |

# The Reference File — Your Answer Key

The Accuracy Scorer is completely useless without an answer key. We call this answer key a **Reference File**. 

A reference file is a simple Excel document stored in the `reference_files/` folder (for example, `ref_ICF_Full.xlsx`). It has five columns:

| Col | Name | Example Value |
|-----|------|---------------|
| A (0) | Placeholder Name | `<Sponsor's Name>` |
| B (1) | Placeholder Type | KeyValue |
| C (2) | Expected Text | Smarter Codes Inc. |
| D (3) | Source Document | Protocol Example (28Sep2023).docx |
| E (4) | Notes | *(optional — e.g., "No expected value per Anil")* |

**⚠️ Important:** Sometimes the exact same placeholder name (like `<side effect>`) appears multiple times in the same document because it is used in different sentences. In the reference file, you list it 8 times with 8 different expected answers. The scorer is smart enough to try the AI's answer against *all 8* expected answers and pick the best match automatically.

# How Scoring Works

How does a computer know if a paragraph of text is "correct"? It uses a mathematical formula called the **Dice Coefficient**.

A Dice coefficient measures how similar two pieces of text are by looking at pairs of consecutive characters (called bigrams) and counting how many appear in both texts. 

The formula is:
```
score = (2 × shared bigrams) ÷ (bigrams in text A + bigrams in text B)
```
A score of `1.0` means they are perfectly identical. A score of `0.0` means they have absolutely no letters in common.

**Let's look at a plain English example:** "Smarter Codes" vs "Smarter Code"
- Bigrams in A: `Sm`, `ma`, `ar`, `rt`, `te`, `er`, `r_`, `_C`, `Co`, `od`, `de`, `es` (12 pairs)
- Bigrams in B: `Sm`, `ma`, `ar`, `rt`, `te`, `er`, `r_`, `_C`, `Co`, `od`, `de` (11 pairs)
- Shared pairs: 11
- Math: `(2 × 11) / (12 + 11)` = `22 / 23` ≈ **`0.957`**

Because `0.957` is very close to `1.0`, the scorer knows this is a nearly perfect match.

### Scoring the Five Placeholder Types
Not all placeholders are just a few words. The scorer uses different logic and different passing thresholds depending on the *Type* of the placeholder.

**1. KeyValue** (e.g., a sponsor name or date)
- **Logic:** Trims spaces and calculates the Dice coefficient.
- **Threshold:** Match ≥ `0.85`, Partial ≥ `0.50`

**2. Inline** (e.g., a fragment of text mid-sentence)
- **Logic:** Checks for an exact, case-insensitive match first. If that fails, falls back to the Dice coefficient.
- **Threshold:** Match ≥ `0.85`, Partial ≥ `0.50`

**3. Paragraph** (e.g., a multi-sentence rationale)
- **Logic:** First, it checks if the very first sentence of the expected text appears anywhere in the AI output. Then, it calculates a Dice score for the whole block of text. 
- **Threshold:** Match ≥ `0.65`, Partial ≥ `0.40`. *(This is much lower than KeyValue because the AI is allowed to rephrase paragraphs slightly).*

**4. List** (e.g., numbered bullet points)
- **Logic:** Splits both texts by newlines and bullet characters. It compares how many bullet points were expected vs how many the AI generated. Then it averages the Dice score across all points.
- **Threshold:** Match ≥ `0.65`, Partial ≥ `0.40`

**5. Table** (e.g., structured data grids)
- **Logic:** Counts the rows and columns in the expected text. Counts the rows and columns in the AI's HTML output. If they match exactly, it's marked as "Aligned". It then calculates Dice similarity across all the cell data.
- **Threshold:** Match ≥ `0.65`, Partial ≥ `0.40`

# The ICF Walkthrough — A Real Example

Let's walk through what happens when we run the scorer on the ICF Full document. We feed the scorer two files:
1. `QA report_ICF_FULL_new version.xlsx` (The raw export from AgileWriter)
2. `reference_files/ref_ICF_Full.xlsx` (Anil's answer key)

Here is how the scorer handles 5 real examples from that run:

**Example 1 — KeyValue: `<Sponsor's Name>`**
- **Reference Expected:** "Smarter Codes Inc."
- **AI Output:** "Smarter Codes Inc."
- **Math:** Exact identical strings. Dice = 1.0. 
- **Result:** **Match** ✓

**Example 2 — Paragraph: `<study rationale>`**
- **Reference Expected:** A multi-sentence paragraph about the study purpose.
- **AI Output:** A semantically similar paragraph, but with a few words changed.
- **Math:** The scorer finds the header sentence. The full text Dice score is `0.71`. Because `0.71` is greater than the `0.65` threshold for Paragraphs...
- **Result:** **Match** ✓

**Example 3 — List: `<list of study procedures>`**
- **Reference Expected:** 8 bullet points.
- **AI Output:** 7 bullet points (the AI combined two of them into one sentence).
- **Math:** The points match check fails (`8 ≠ 7`). The average text similarity is `0.62`. Because `0.62` is less than `0.65` but higher than `0.40`...
- **Result:** **Partial Match**

**Example 4 — Table: `<adverse events table>`**
- **Reference Expected:** 3 rows by 4 columns.
- **AI Output:** An HTML table with `<tr>` and `<td>` tags resulting in 3 rows and 4 columns.
- **Math:** The rows and columns match perfectly, so Alignment is `true`. The text inside the cells scores a `0.89`.
- **Result:** **Match** ✓

**Example 5 — Skipped: `<CRO Name>`**
- **Reference Expected:** "" (Completely blank).
- **AI Output:** "" (Also blank).
- **Math:** Anil intentionally left the reference blank because this specific document has no CRO Name. The scorer detects the blank expected text.
- **Result:** **Skipped** (This row is completely excluded from the final accuracy percentage calculation).

# The Two Input Formats

AgileWriter exports its raw QA data in two different spreadsheet layouts, depending on how you download it. The Accuracy Scorer is smart enough to auto-detect which format you gave it based on the name of the sheet inside the Excel file.

**Format A — "Evaluation_Data" Sheet (The direct raw export)**
- Col 0: AI detected placeholder name
- Col 9: AI Replaced Text
- Col 17: Placeholder Type
- Col 18: Placeholder ID

**Format B — "QA" Sheet (Anil's manual format)**
- Col 0: Placeholder name
- Col 2: Placeholder Type
- Col 3: Expected Value (Note: The scorer ignores this column and uses our internal reference file instead)
- Col 6: AI Replaced Text
- Col 9: Existing Similarity Score (Note: The scorer ignores this and recalculates it using our math)

# Reading the Output

When the test finishes, it generates an Excel file like `accuracy-report-2026-04-30.xlsx` containing 8 separate sheets.

- **Sheet 1 — Summary:** Shows who ran the test, when, and a table breaking down accuracy percentages for each placeholder type.
- **Sheet 2 — QA (Master Sheet):** The giant view. Every single placeholder is listed here with 45 columns of data.
- **Sheets 3 through 8 — Filtered Views:** Separate tabs for `Inline`, `Paragraph`, `KeyValue`, `Table`, `Lists`, and `Multi Tables`. These are smaller, easier-to-read views that only show columns relevant to that specific type.

If you look at the Master Sheet, here is what the columns mean:
- **Cols 0-10:** Common to everything (Name, Type, AI Text, Similarity, Final Status).
- **Cols 11-12:** Specific to KeyValue scoring.
- **Cols 13-17:** Specific to Paragraph scoring (Did it find the header? What was the percentage?).
- **Cols 18-22:** Specific to Lists (How many points were expected? Did the points match?).
- **Cols 23-31:** Specific to Tables (Expected rows/cols vs AI rows/cols, and Alignment).

# How This Relates to Anil's Manual Report

If you open Anil's manual QA report, you will notice it looks almost identical to our generated Sheet 2 (QA Master Sheet). 

This is highly intentional. 

The accuracy scorer was designed to produce an output file that Anil can open and immediately understand because all the columns are exactly where he expects them to be. We are taking his blank template, running the heavy mathematical calculations, and pre-filling the Similarity Scores and Statuses for him. He can sort by "Status" and just review the rows we flagged as "Partial Match" or "No Match."

# Running the Scorer

To run the scorer, open your terminal in the `Agile Writer Test` folder.

**Using the Default Files (ICF Full)**
If you just want to run the standard ICF Full accuracy check, run:
```bash
npx playwright test tests/accuracy.spec.ts --reporter=line
```

**Using Custom Files**
If you have a brand new QA report and a custom reference file, you pass them in as environment variables right before the command:
```bash
ACCURACY_RAW_QA_PATH="CSR_Test_raw_qa.xlsx" ACCURACY_REF_PATH="reference_files/ref_CSR.xlsx" ACCURACY_OUTPUT_DIR="reports/" npx playwright test tests/accuracy.spec.ts --reporter=line
```

**⚠️ Important:** If you pass a CSR raw QA file but accidentally pass an ICF reference file, the script will notice the names don't match and warn you in the terminal:
```
WARNING: Possible document-type mismatch.
  Raw QA: CSR_Test_raw_qa.xlsx  (detected token: "csr")
  Ref:    reference_files/ref_ICF_Full.xlsx  (detected token: "icf")
```
The test will still run, but almost every row in your final report will say "Missing Reference" because it couldn't find CSR placeholder names in an ICF answer key.

<!-- ADDED May 2026 -->
# Understanding Missing Reference and Skipped Rows

Two statuses that confuse new users:

**Missing Reference** means the scorer found a placeholder in the raw QA file, but there is no matching placeholder name in the reference file. The placeholder simply has no answer key entry.

**How to fix it:** Open the reference file in Excel. Add a new row with the placeholder name in column A, type in column B, and the correct expected text in column C.

**Skipped** means the reference file *does* contain the placeholder, but the expected text column (column C) is blank. Anil intentionally left it empty because there is no expected value for this placeholder in this specific document.

**How to fix it (if the expected text is now known):** Open the reference file, find the row for this placeholder, and fill in column C with the correct expected text. Then re-run the scorer.

Both statuses are excluded from the final accuracy percentage calculation so they don't unfairly penalize the score.

# Adjusting Thresholds

What if the scorer is being too strict on Paragraphs? You can easily change the passing grades by editing the `getThresholds()` function inside `tests/helpers/accuracy-scorer.ts`.

```typescript
function getThresholds(type: PlaceholderTypeName): { match: number; partial: number } {
  const t = (type ?? '').trim().toLowerCase();
  
  if (t === 'keyvalue' || t === 'inline') {
    return { match: 0.85, partial: 0.50 };
  }
  
  // Paragraph, List, Table, Unknown
  return { match: 0.65, partial: 0.40 };  
}
```

If you want Paragraphs to require an almost perfect match, change `0.65` to `0.80`. **Rule of thumb:** Always re-run the scorer against a known dataset and compare your new results to Anil's manual scores before committing threshold changes to Git!

# Creating a Reference File for a New Document Type

If you are testing a brand new document type (like a CSR), you need to build a new answer key from scratch. We built a script to do 90% of the work for you.

1. Run AgileWriter on the CSR template using the UI. Download the QA report Excel file.
2. Run our automated bootstrap script:
   ```bash
   node bootstrap-reference.js
   ```
3. This creates a brand new file at `reference_files/ref_CSR.xlsx`. It automatically copies all the placeholder names and types from your QA report, but leaves the "Expected Text" column totally blank.
4. Open `ref_CSR.xlsx` in Excel and manually paste the correct "Expected Text" into column C for every row. (Ask Anil for the master answers).
5. You can now use your new reference file to run accuracy checks!

# Contacts

If you need help or have questions, reach out to the right person:

- **Aaron Sequeira:** Accuracy scorer code, reference files, browser UI scoring panel, and this documentation.
- **Anil:** Expected placeholder values, QA sign-off, reference file contents, and threshold calibration.
- **Inayathulla:** General Playwright infrastructure, test runner server, and session isolation.

<!-- ADDED May 2026 -->
# The Five Placeholder Types and Their Thresholds

| Type | Match threshold | Partial Match threshold |
|---|---:|---:|
| KeyValue | >= 0.85 | >= 0.50 |
| Inline | >= 0.85 | >= 0.50 |
| Paragraph | >= 0.65 | >= 0.40 |
| List | >= 0.65 | >= 0.40 |
| Table | >= 0.65 | >= 0.40 |

To change these values, edit `getThresholds()` in [accuracy-scorer.ts](</C:/Users/Aaron Sequeira/Agile Writer Test/tests/helpers/accuracy-scorer.ts>).

<!-- ADDED May 2026 -->
# Full ICF Example - `<Sponsor's Name>`

**Placeholder:** `<Sponsor's Name>`  
**Type:** `KeyValue`  
**Expected:** `Stendarr, Inc.`  
**AI text:** `Stendarr, Inc.`

**`normalizeForCompare()` pipeline**
1. `stripHtml()` -> `Stendarr, Inc.`
2. `toLowerCase()` -> `stendarr, inc.`
3. replace non-word chars -> `stendarr  inc `
4. collapse whitespace -> `stendarr inc`

`compareTwoStrings("stendarr inc", "stendarr inc")` -> `1.0`  
Threshold check: `1.0 >= 0.85` -> **Status: Match**  
Overall similarity: `1.0000`

**Partial-match punctuation example**
- AI text: `Stendarr Inc`
- Normalized value: `stendarr inc`
- Similarity: `1.0`
- Status: **Match**

**No-match example**
- AI text: `N/A`
- Normalized value: `n a`
- Similarity vs `stendarr inc`: approximately `0.08`
- Threshold check: `0.08 < 0.50`
- Status: **No Match**

<!-- ADDED May 2026 -->
# Understanding Missing Reference

**What it means:** The raw QA file contains a placeholder name that has no entry in the reference file.

**Common causes**
1. A new placeholder was added after the reference file was created.
2. The placeholder name differs by spelling or punctuation.
3. The wrong reference file was selected for the document type.

**How to fix**
- Add the placeholder to the reference file with the correct expected text.
- Check spelling and punctuation in the reference workbook.
- Make sure the reference file matches the same document family as the raw QA file.

<!-- ADDED May 2026 -->
# Understanding Skipped

**What it means:** The placeholder exists in the reference file, but the expected text cell is blank.

**Why it matters:** The scorer knows the placeholder name, but it has no answer key text to compare against.

**How to fix**
- Fill in the expected text in the reference file if that value is now known.
- Leave it blank only when the placeholder intentionally has no approved answer for that document.

**Calculation note:** Skipped rows are excluded from the final accuracy percentage.

<!-- ADDED May 2026 -->
# Workflow A - Score from the Server UI

1. Start the server:
   ```bash
   cd "C:\Users\Aaron Sequeira\Agile Writer Test"
   node server/test-runner-server.js
   ```
2. Open `http://localhost:3000/ui/`
3. Scroll to **Accuracy Scorer**
4. Drop your reference file into `C:\Users\Aaron Sequeira\Agile Writer Test\reference_files\`
5. Drop your raw QA file into `C:\Users\Aaron Sequeira\Agile Writer Test\raw_qa_files\`
6. Click **Refresh File Lists**
7. Select the reference file, select the raw QA file, then click **Run Accuracy Score**

<!-- ADDED May 2026 -->
# Workflow B - Score from Terminal

```bash
node -e "
  const { loadReferenceFile } = require('./tests/helpers/reference-file-loader');
  const { scoreAll } = require('./tests/helpers/accuracy-scorer');
  const { generateReport } = require('./tests/helpers/accuracy-report-writer');
  const refMap = loadReferenceFile('./reference_files/ICF_reference.xlsx');
  const scored = scoreAll('./raw_qa_files/ICF_QA_output.xlsx', refMap);
  generateReport(scored, './reports/accuracy/result.xlsx', './reports/accuracy/result.json');
"
```

**Note:** This requires `ts-node` so Node can require the TypeScript helper modules directly.

<!-- ADDED May 2026 -->
# How to Read the Excel Output Report

- **Summary**: overall accuracy, per-type breakdown, row counts, generated timestamp.
- **QA**: the master sheet with all placeholders and all columns.
- **KeyValue**: short-value placeholders only.
- **Paragraph**: long-form text placeholders only.
- **Table**: structured data placeholders only.
- **Lists**: bullet and numbered list placeholders only.

**Key QA columns**
- Column A: Placeholder
- Column C: Placeholder Type
- Column D: Expected Value
- Column G: AI Replaced Text
- Column I: Matching Accuracy
- Column J: Similarity Score
