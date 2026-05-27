Document Status: Historical
Superseded By: TBD
Reason Preserved: Original implementation retained

# DOCX Report Flow Audit

## Matrix: Generation vs Download Timing

| Generation Timing | Download Timing | Result / Risk |
|---|---|---|
| After Success | Pre-generation | 404 Not Found (Safe) |
| After Success | Mid-generation | Serves incomplete ZIP (Case B: Structural Corruption) |
| After Success | Post-generation | Clean Download (Safe) |
| After Failure | Mid-generation | Serves incomplete ZIP (Case B: Structural Corruption) |
| **After Failure** | **Post-generation** | **Case A: Partial Content. Generator parses incomplete `step-results.json`** |

## Findings
1. `health_ICF_full.spec.ts` fails at "Wait for training stages", but the report still generates.
2. `generate-word-report.js` does **not** await the `fs.WriteStream('close')` event before exiting. It relies on the `html-to-docx` promise, which buffers in memory and synchronously writes via `fs.writeFileSync`. Wait, code inspection shows it uses `fs.writeFileSync(OUTPUT_FILE, fileBuffer)`. This means it does NOT use a write stream, but writes the entire buffer synchronously!
3. If it uses `writeFileSync`, the file is created instantaneously (relative to Node execution). The race condition is much tighter, but still exists if the UI endpoint reads it mid-write block.
4. However, the UI `/download-report` endpoint selects `files[0]` from `fs.readdirSync()`. If multiple `.docx` artifacts accumulate (e.g. from previous runs in a non-cleaned session), it will serve the chronologically first file returned by the filesystem, which is non-deterministic.
5. If the script encounters missing screenshots after a failure, the HTML rendering handles it safely because screenshots aren't embedded in this version of the generator (they remain in `reports/screenshots` according to the template notes).

## Conclusion
The bug is a mix of Case B (Download race during synchronous write/disk flush) and Selection Logic (`/download-report` serving `files[0]`). The atomic rename will harden the write phase, but the endpoint MUST be updated to select the newest `.docx`.

