Document Status: Historical
Superseded By: TBD
Reason Preserved: Original implementation retained

# BASEURL Usage Audit

| File | Pattern | Risk | Required Change |
|---|---|---|---|
| `runtime-config.ts` | `runtimeConfig.baseUrl = process.env.BASEURL \|\| ''` | High | None, provided injected `process.env.BASEURL` strictly strips trailing slash. |
| `AW_00_10_consolidated_flow.spec.ts` | `page.goto(BASEURL + '/signin')` | High | If dynamic BASEURL ends in `/`, it resolves to `//signin` and fails. Normalization is strictly required to strip trailing slashes. |
| `AW_11_to_20.spec.ts` | `page.goto(BASEURL as string)` | Medium | Less prone to concatenation breakage, but inconsistent with relative navigation. |
| `health_report_runner.ts` | N/A (relies on `app-navigation.ts`) | Low | Relies on `app-navigation.ts` which uses `BASEURL + '/signin'` logic. |
| `playwright.config.js` | `baseURL: process.env.BASEURL` | Medium | Injected environment variable will be correctly picked up. |

## Conclusion
Because multiple files explicitly concatenate `BASEURL + '/signin'`, the dynamic `BASEURL` **must absolutely not** contain a trailing slash. Normalize to the root host.

