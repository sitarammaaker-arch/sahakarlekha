# Report Fix Plan (accounting → statutory → security → PDF/print → export → UX)
IDs refer to `REPORT_AUDIT_EVIDENCE/ALL_FINDINGS.md`. Data-integrity fixes carry the strictest DELIVERY-FRAMEWORK modifier. Never rewrite history to make a report pass.

## P0 — accounting correctness / wrong filing
| # | Fix | Findings | Depends on | Acceptance |
|---|---|---|---|---|
| 1 | Period-correct statements: TB/I&E/R&P by FY, balances carried via year-close; prior-year column on same basis | A-01 | read-only check of prod multi-year data | 2-FY fixture: FY2 I&E excludes FY1; BS balances; getter test added |
| 2 | One `activeVouchers` source for Ledger, Day Book, BRS, Audit Cert, NABARD, Federation | A-03 | — | rejected/pending voucher absent everywhere; parity test vs TB |
| 3 | Fix Trading A/c stock logic + test (RULE 2) | A-02 | — | opening-stock-in-ledger fixture ties to BS |
| 4 | Cash/Bank Book + Day Book opening/closing under filters; Audit Cert sign | A-04..A-06 | — | opening+movements=closing across filters/branch/overdraft |
| 5 | KCC ledger resolution; loan interest accrual rewrite | B-01, B-02 | CA confirms interest basis | disbursement Dr loan asset; day-count tests |
| 6 | Remove/gate legacy Profit Distribution path | B-15, B-16 | statutory gate rules (external) | no appropriation without reserve/cap/AGM |
| 7 | `addVoucher` blocked → error, not dummy; pages stop false-success toasts | U-01, B-03 | — | FY-locked save: destructive toast, no row |
| 8 | GSTR-1: place of supply from society state, HSN from items, unify `gstin`/`gstNo`, period from range | C-11..C-14 | add `stateCode`/`hsnCode` columns (migration: user must run) | JSON validates against official offline-tool schema (external) |
| 9 | Label Form 26Q / Form 16A "draft aid" until validated; exclude salary rows | C-15..C-17 | TDS expert validation | UI banner; salary rows excluded |

## P1 — security & PDF correctness
| # | Fix | Findings | Acceptance |
|---|---|---|---|
| 10 | CSV formula-injection guard (string cells starting `= + - @ tab CR`; typed numbers untouched) | D-S01 | test:export-utils cases; negative numbers stay numeric |
| 11 | Member "full" export server-gated; PAN/Aadhaar masked for viewer | D-S02 | viewer export has no PII |
| 12 | Server-side export authorisation; audit trail for all PDFs/page exporters | D security | unauthorised role refused at DB |
| 13 | Embed Devanagari TTF via `addFont`; replace Helvetica in all generators | P-01, B-28, C-28, D-01 | text-extract of rendered PDF contains Hindi society name |
| 14 | Wrap/shrink long society names; flexible amount columns | D-02 | 80-char name and ₹99,99,99,999.99 render cleanly |
| 15 | Export Center honours FY/branch/date, or label honestly | D-12 | file scope equals filename scope |
| 16 | Review `society_activities` allow_all policy in prod | D security | removed or justified |

## P2 — register/statutory content
Asset register parity (B-04/05), aging buckets (B-06), Form 1 cessation (B-17), Share/Nomination register filters (B-18/19), minute-book soft-delete (B-12), audit-rectification lock (B-21), audit schedules sourcing (B-20), loan NPA/overdue + deposit register (B-22), compliance calendar sourcing (B-23), stock valuation method (C-01), consumer outstanding (C-05), multi-rate invoice (C-18), double extensions (C-32).

## P3 — print/UX
Print stylesheet (hide chrome, repeat headers, A4/landscape), print buttons on statutory reports, XLSX sheet-name sanitiser, consistent filenames, Registered Society decision (product/legal input needed).
