# Reports, Printing, Export & Statutory-Readiness Audit — SahakarLekha

Date: 2026-10-03 · Branch audited: `feat/registers-show-returns` (HEAD 6fb1758) · Mode: read-only (no `src/` change)
Method: four parallel slice audits (A core statements · B registers/statutory · C trade/tax/payroll/domain · D export infra/QA/security) → fragments in `REPORT_AUDIT_EVIDENCE/fragments/`, merged by `REPORT_AUDIT_EVIDENCE/merge.mjs`. Every finding cites `file:line` in `REPORT_AUDIT_EVIDENCE/ALL_FINDINGS.md`. Nothing here is a legal opinion: statutory items are marked **EXTERNAL VALIDATION NEEDED** unless a source is in the repo.

> **BASELINE CAVEAT (added after re-verification).** The slice audits ran on a branch 287 commits behind `origin/main`. Findings were then re-checked against main: see **REPORT_REVERIFICATION_MAIN.md**, which supersedes the status in this file. Notably B-01 (KCC ledger), B-03, B-28 and Hindi PDF *table cells* were already fixed on main; the "all PDFs garbled" statement applies to headers/footers/signatories only. Twelve findings are fixed in branch `fix/reports-audit-p0p1`.

## Deliverables
| File | Content |
|---|---|
| REPORT_INVENTORY.csv | 116 report/export surfaces |
| REPORT_STATUTORY_COMPLIANCE_MATRIX.csv | 76 report × requirement rows |
| REPORT_EXPORT_COVERAGE.csv | 95 rows, Print/PDF/XLSX/CSV |
| REPORT_VISUAL_QA.md | rendered-output defects (4 generators actually rendered) |
| REPORT_DATA_RECONCILIATION.md | formula/integrity analysis + 21 test scripts |
| REPORT_SECURITY_AUDIT.md | tenant/RLS/permission/export findings |
| REPORT_GAP_REGISTER.md | missing reports/fields/formats |
| REPORT_FIX_PLAN.md / REPORT_TEST_PLAN.md | prioritised plan / regression tests |
| REPORT_AUDIT_EVIDENCE/ | 22 generated PDF/XLSX/CSV, 5 PNG renders, ALL_FINDINGS.md |

## Scope facts (verified by the slice auditors)
* **Entity types:** only *Cooperative Societies* are modelled (`SocietyType`, src/types/index.ts:1004 — activity types). There is **no Registered Society (Societies Registration Act) mode**; "registered" in code means GST-registered. The two entity types therefore cannot be audited separately; this is itself a coverage gap.
* **Statutory sources in repo:** none authoritative for statement layouts. Only `docs/research/TASK2.3-COOP-ACCOUNTING-REGISTERS.md` (form numbers "[NV per state]"), `AUDIT_NCDC_Compliance_Report.md` (automated, partly stale) and `docs/CA-VERIFICATION-2026-07.md` (unanswered questionnaire). So **no report can be certified statutory from repo evidence**.
* **Finding totals (slice auditors):** A 46 (0C/9H/21M/11L/5I) · B ~34 (3C/~14H/~12M) · C 37 (3C/9H/15M/8L/2I) · D 20 + 11 security (2H). Roughly 148 findings, **6 CRITICAL**.

## Executive summary — what matters most
**CRITICAL**
1. **C-11** GSTR-1 place of supply hard-coded `09` (UP) for every society.
2. **C-12** GSTR-1 HSN summary empty; B2B misclassified (reads only `gstNo`, not `gstin`).
3. **C-15** Form 26Q export mixes salary s.192 rows, home-grown layout, fake BSR `0000000` challan — not filable.
4. **B-01** KCC postings resolve to ledger 2305 (DCCB borrowings) — disbursement reduces a liability.
5. **B-02** Loan interest accrual: wrong day count/base, overdue loans skipped, income double-counted.
6. **B-15** Profit Distribution legacy path has no reserve / dividend-cap / AGM gate beside the new statutory path.

**HIGH — statements/data:** A-01 TB/I&E/R&P cumulative from inception, FY rollover resets nothing (would be CRITICAL with multi-year prod data — UNVERIFIED); A-02 Trading A/c stock logic inconsistent and untested; A-03 Ledger/Day Book/BRS/Audit Cert/NABARD/Federation include rejected/pending vouchers the TB excludes; A-04 Audit Certificate cash/bank default ₹0; A-05/A-06 wrong opening/closing in filtered Cash/Bank Book and Day Book PDF; U-01/B-03 false "saved" toast when `addVoucher` is refused; B-04/B-05 asset register / depreciation roll-forward mismatch; B-06 aging buckets wrong.
**HIGH — print/PDF:** every PDF is Helvetica-only, so **Devanagari prints as garbage** (pdf.ts:25-27; font loader has no consumer; A P-01, B-28, C-28, D-01); long society names clip; fixed 28 mm amount columns wrap digits; no print flow, sidebar/header not hidden in print.
**HIGH — export/security:** CSV formula injection (exportUtils.ts:60); Members "full" export includes Aadhaar/PAN for viewer-rank roles; export authorisation is client-side only (RLS SELECT is tenant-only); Export Center ignores FY/branch/date yet labels files with current FY; ~70 page exporters and all PDFs leave no audit trail; double extensions (`.csv.csv`); `society_activities` `allow_all using(true)` policy (UNVERIFIED in prod).

## Final verdict
| # | Area | Status | Basis |
|---|---|---|---|
| 1 | Accounting correctness | **NOT READY — HIGH risk** | 21 ledger/report test scripts pass, but none exercise the DataContext getters the pages use (REPORT_DATA_RECONCILIATION.md); A-01..A-06, B-01/02/15 are code-evidenced. Prod-data impact UNVERIFIED. |
| 2 | Statutory/audit readiness | **NOT DEMONSTRATED** | No authoritative source in repo; all layouts EXTERNAL VALIDATION NEEDED; GSTR-1 and 26Q outputs demonstrably wrong (C-11/12/15). Treat as management/audit-useful only. |
| 3 | Print readiness | **FAIL** | No dedicated print flow; print CSS leaves chrome visible (D). Actual browser print not run (UNVERIFIED). |
| 4 | PDF readiness | **FAIL for Hindi; PARTIAL for English** | Rendered samples: English tables paginate; Hindi garbled; long names clip. Only 4 of ~30 generators rendered; rest UNVERIFIED. |
| 5 | Excel/CSV readiness | **PARTIAL** | XLSX builder works (test:xlsx pass) but throws on invalid/duplicate sheet names; CSV injection; uneven coverage (REPORT_EXPORT_COVERAGE.csv). |
| 6 | Report coverage | **Broad but uneven** | 116 surfaces inventoried; Registered Society absent. |
| 7 | Security | **MEDIUM-HIGH risk** | Tenant RLS present (static test pass); cross-tenant live test SKIPPED (no staging credentials); export authorisation browser-side; PII over-exposure. |
| 8 | Missing reports | **Significant** | See REPORT_GAP_REGISTER.md. |

## What I did not do
* **No fixes applied.** CSV-injection guard and double-extension fixes are low-risk but touch shared export code on a branch with unrelated uncommitted work, and your rule is to batch PRs; they are staged in REPORT_FIX_PLAN.md awaiting your go-ahead.
* No production data queried; no browser-print run; ~26 PDF generators not rendered; cross-tenant test skipped; accessibility checked from source only.
