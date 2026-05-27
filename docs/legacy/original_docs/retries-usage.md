Document Status: Historical
Superseded By: TBD
Reason Preserved: Original implementation retained

# Retry Policy Usage Audit

| Source | File / Location | Value | Scope | Impact |
|---|---|---|---|---|
| **Global Config** | `playwright.config.js` | `retries: 0` (Implicit Default) | Global | Tests fail fast globally unless overridden. |
| **Spec Override** | `AW_00_10_consolidated_flow.spec.ts` | `retries: 2` via `test.describe.configure` | File | Will retry twice on failure. Execution time per attempt is short/medium. |
| **Heavy Spec** | `health_ICF_full.spec.ts` | None | File | Defaults to global (0). If global changes to 2, this ~25min script will run for 75 mins on failure. |
| **Heavy Spec** | `health_M264.spec.ts` | None | File | Same as ICF Full. |
| **CI Wrappers** | `package.json` / pipeline scripts | Unknown/None | CI Environment | No `--retries` flag observed in package.json. |

## Conclusion
The repository has a fragmented retry topology. `AW_00_10` manually hardcodes `retries: 2`. Implementing a global `retries: process.env.CI ? 2 : 0` policy is highly dangerous unless heavy scripts (`health_M264`, `health_ICF_full`, `health_CSR`) are explicitly guarded with `test.describe.configure({ retries: 0 })`.

