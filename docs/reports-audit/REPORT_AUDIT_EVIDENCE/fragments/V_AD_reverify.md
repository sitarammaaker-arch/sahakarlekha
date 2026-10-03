# V_AD re-verification against main (D:\Website\sahakarlekha-fix, origin/main 2cefda6)

Scope: CRITICAL/HIGH/MEDIUM findings in ALL_FINDINGS.md sections A and D, plus D_security.md and D_visual_qa.md (VQ-xx map onto D-xx, noted below). READ-ONLY. All paths relative to `D:\Website\sahakarlekha-fix`; `DC` = `src/contexts/DataContext.tsx` (the audit cited `src/context/`, it is `src/contexts/`).
Important: the uncommitted edit in `src/lib/exportUtils.ts` / `src/lib/export/generator.ts` already fixes D-S01, D-S02, D-15, E-01 (CSV injection, PII mode gate, sheet-name sanitising, double extension). Judged against committed HEAD those are STILL-PRESENT (fix not yet on main) and flagged "(fix uncommitted)".

Counts: STILL-PRESENT 39, CHANGED 8, FIXED-ON-MAIN 1, UNVERIFIED 1.

| ID | Sev | Status on main | Evidence | Fix suggestion | Risk |
|---|---|---|---|---|---|
| A-01 | HIGH | CHANGED (mostly fixed) | `DC:5228-5250` TB now uses `fyStartOf`/`fyStartFromLabel`; opening = brought-forward at FY start, txn columns FY-only (Phase-2 C "D1 one continuous ledger"). `src/pages/SocietySetup.tsx:319-361` rollover still only snapshots + changes FY (year-close handled server-side, mig 090). ProfitLoss PY-column basis not re-checked | Re-run audit test: FY1+FY2 vouchers, assert FY2 I&E excludes FY1 | accounting |
| A-02 | HIGH | CHANGED | Trading A/c now pure module `src/lib/reports/tradingAndProfitLoss.ts:34-209` using `closingStock()` from `src/lib/tradingAccount.ts` (one rule, #538); `DC:5684-5700`; tests `scripts/test-trading-pl.mjs`, `test-trading-account.mjs`. Opening stock still = 3400 children openingDebit (`:98-101`) | Add O>0 integration tie test BS vs Trading | low (test only) |
| A-03 | HIGH | STILL-PRESENT | `src/pages/AuditCertificate.tsx:53`, `NabardReport.tsx:97`, `FederationReport.tsx:56,173,178` raw `vouchers.filter(!isDeleted)`; `Ledger.tsx:67-69` and `DayBook.tsx:85` filter only isDeleted+branch, not rejected/pending (`activeVouchers` at `DC:5041-5048` does) | Expose `activeVouchers` from useData and use it in these pages | accounting (reads only) |
| A-04 | HIGH | STILL-PRESENT | `AuditCertificate.tsx:49-65` credit-positive `getBalance`; `:88-89` default `Math.max(0, ...)` so Dr cash prints 0 | Default = `-getBalance` (or `getAccountBalance`); show ledger value beside override | low (UI) |
| A-05 | HIGH | STILL-PRESENT | `CashBook.tsx:39` `openingBalance = account.openingBalance` (not as-of fromDate, not branch scoped), `:47` closing = all-time `getAccountBalance`; `BankBook.tsx:44-46` same | Derive opening from `computeCashBook` openingMinor (returned in `DC:5200-5214`) / first row; closing = last row | low-med (report display) |
| A-06 | HIGH | STILL-PRESENT | `src/lib/pdf.ts:1358-1400` loop over `entries` for `v.date < firstDate` can never match; page passes `entries` only (`DayBook.tsx:177`) | Pass page-computed opening cash into `generateDayBookPDF` | low (pure/PDF) |
| A-07 | MED | STILL-PRESENT | `BankReconciliation.tsx:102-118` uses `isCleared` only; `clearedDate` only displayed (`:800`) | cleared iff `clearedDate <= asOfDate` | low |
| A-08 | MED | STILL-PRESENT | `ReceiptsPayments.tsx:23` `getReceiptsPayments()` no date; `DC:5589-5600` | Add from/to defaulting to FY | low-med |
| A-09 | MED | STILL-PRESENT | `TrialBalance.tsx:77`, `BalanceSheet.tsx:109`, `pdf.ts:481` `< 1`; silent plug `DC:1814-1827` | Tolerance 0.005 on reports; prompt instead of plug | touches accounting (add path) |
| A-10 | MED | CHANGED (partly) | `tradingAndProfitLoss.ts:73-87` still `narration.includes(fy)`, but year-close journal now detected by `refType === 'fy.close.stock'`; `DC:5701-5710` still narration | Stamp `refType` on the manual closing-stock journal too | accounting |
| A-11 | MED | STILL-PRESENT | `ProfitLoss.tsx:62-66`, `SocietySetup.tsx:313`, `FederationReport.tsx:173,178` narration/FY matching | Use structured refType from T-20 appropriation voucher | accounting |
| A-12 | MED | STILL-PRESENT | `SocietySetup.tsx:319-361` rollover `updateSociety` omits `financialYearStart`; `DayBook.tsx:69` and `DC:1788` read it (mig 073 may derive server-side, not verified) | Include new FY start in rollover update | low-med |
| A-15 | MED | STILL-PRESENT | `MultiSocietyConsolidation.tsx:209` `fmtNum = Math.round`, mixed FYs not blocked | Warn on mixed FY, export paise | low |
| S-01 | HIGH | STILL-PRESENT (not code) | No authoritative statutory source added; external validation needed | Keep disclaimers; get CA/authority text | n/a |
| S-02 | MED | STILL-PRESENT | `src/types/index.ts:958` SocietyType cooperative-only | Product decision | n/a |
| S-03 | MED | STILL-PRESENT | `pdf.ts:211` "true and fair ... as on 31st March", `:659` BS title hardcoded, `:2054`; `AuditCertificate.tsx:125` | Derive date from as-on; draft wording for auditor | low |
| S-04 | MED | STILL-PRESENT | `Reports.tsx:59-65` STMT_META filter; appropriation only as I&E section (`ProfitLoss.tsx:224`) | Add STMT_META entry/route | low |
| S-05 | MED | STILL-PRESENT | `TradingAccount.tsx:30,363-385` activities on screen only (exports not opened in detail) | Add activity rows to export | low |
| S-06 | MED | UNVERIFIED | I&E PDF body not re-opened | Re-read `pdf.ts` I&E generator | - |
| SEC-01 | MED | STILL-PRESENT | `can('export')` only in TrialBalance, BalanceSheet, ProfitLoss, ReceiptsPayments, TradingAccount | Gate XLSX/CSV in remaining pages | low |
| SEC-02 (=D-S01=D-13=VQ-11) | MED/HIGH | STILL-PRESENT on HEAD (fix uncommitted) | HEAD `src/lib/exportUtils.ts:60` escape only doubles quotes; working copy adds `neutraliseFormula` | Commit the working-copy fix | low (pure fn) |
| P-01 | HIGH | CHANGED | `pdf.ts:4-6` `installDevanagariCells()` (#547, `src/lib/pdfDevanagari.ts`) renders Hindi table CELLS as canvas images; labels English; `setupFont` still helvetica (`pdf.ts:22`) | See D-01 for header gap | low |
| P-02 | MED | CHANGED | App chrome hidden via `print:hidden` in `src/components/layout/MainLayout.tsx`; `index.css @media print` minimal; no print buttons on statements (window.print in 11 files) | Add print button / `@page` to statement pages | low |
| P-03 | MED | STILL-PRESENT | `pdf.ts:40-50` `pdfFileName` unchanged | Include as-on/range in name | low |
| E-01 | MED | STILL-PRESENT on HEAD (fix uncommitted) | `Vouchers.tsx:526,535` pass 'vouchers.csv'; HEAD `exportUtils.ts:162,170` append ext | Commit `stripExt` fix | low |
| E-02 | MED | STILL-PRESENT | CashBook/TB etc call `downloadExcelSingle` without meta (`CashBook.tsx:115`, `TrialBalance.tsx:105`) | Pass ExportMeta | low |
| E-05 | MED | STILL-PRESENT (not fully traced) | BS unposted-stock row only on screen (`BalanceSheet.tsx:363-371`) | Add row to CSV/XLSX | low |
| E-06 | MED | STILL-PRESENT | `Vouchers.tsx:519-535` uses `branchVouchers` (includes rejected/pending), 7 cols, 'vouchers.csv' | Use active filter + status column | low |
| U-01 | HIGH | CHANGED | FIXED in `CashBook.tsx:65-70` and `BankBook.tsx:98-100` (`!v?.id` guard, destructive toast). STILL in `Vouchers.tsx:376-379, 409-410, 441-444` (success toast + `handleClear()` regardless of `v.id`); stub from `DC:1759-1783` | `if (!v?.id) return;` before toast/clear at 3 sites | low (UI) |
| U-02 | MED | STILL-PRESENT | `ProfitLoss.tsx:109,117,252` hardcoded "Income & Expenditure" | Use statements.ts label | low |
| D-01 (=VQ-01) | HIGH | CHANGED (partial) | Table cells fixed (#547). Header society name `pdf.ts:236-240` plain `doc.text(society.name)` with helvetica; footer/signatory still helvetica | Render header name/signatories via the same canvas path | low |
| D-02 (=VQ-02) | HIGH | STILL-PRESENT | `pdf.ts:236-240` centre text, no `splitTextToSize` | Wrap name, shift startY | low |
| D-03 (=VQ-03) | MED | STILL-PRESENT | `pdf.ts:344,391,904,956` `cellWidth: 28` | minCellWidth / font shrink | low |
| D-04 (=VQ-04) | MED | STILL-PRESENT | `pdf.ts:16-17` `fmt` unguarded | Guard non-finite -> 0.00 | low (pure) |
| D-05 (=VQ-05) | MED | STILL-PRESENT | `addNoDataMessage` count in pdf.ts = 3 (def + 2 uses) | Guard each generator | low |
| D-06 (=VQ-06) | MED | STILL-PRESENT | `pdf.ts:481` `< 1`, no money.ts import | Paise compare | low-med |
| D-07 | MED | STILL-PRESENT | `pdf.ts:211` | As S-03 | low |
| D-08 | MED | STILL-PRESENT | jspdf imported directly in BankReconciliation, BudgetModule, GstSummary, FederationReport, NabardReport, AuditCertificate, etc. | Route via addHeader/addPageNumbers | low |
| D-09 | MED | CHANGED | Chrome hidden in `MainLayout.tsx` (`print:hidden`); statements still lack print path (see P-02) | Add print buttons | low |
| D-12 (=D-S04) | HIGH/MED | STILL-PRESENT | `ExportCenter.tsx:151,161`, `EntityExportButton.tsx:86,96` label with `society.financialYear`; `src/lib/export/source.ts` has no branch/FY filtering | Add FY/branch filters, name by range | touches RLS-adjacent read scope |
| D-14 (=D-S02) | HIGH | STILL-PRESENT on HEAD (fix uncommitted) | HEAD `generator.ts` authorizeExport has no `mode`; working copy adds gate at `generator.ts:110-117` | Commit | low |
| D-15 (=VQ-10) | MED | STILL-PRESENT on HEAD (fix uncommitted) | HEAD `exportUtils.ts:111` `slice(0,31)`; working copy adds `safeSheetName` | Commit | low |
| D-16 | MED | STILL-PRESENT | `downloadCSV` has no meta | Provenance row | low |
| D-17 (=D-S05) | MED | STILL-PRESENT | `recordExport/runEntityExport` only in EntityExportButton, ExportCenter, run.ts, generator.ts, audit.ts, backup, restore; pdf.ts only `trackEvent('pdf_download')` (`:231`) | `finalizePdf` with audit for PII PDFs | low-med |
| D-S03 | MED | STILL-PRESENT (unverified server) | Role-scoped SELECT only in 031/032 + branch SELECT 039/048; no export-RPC | Role-scoped SELECT or definer RPC | touches RLS/accounting access |
| D-S06 | MED | FIXED-ON-MAIN (code) | `supabase/migrations/063_society_activities_tenant_rls.sql` drops `allow_all` and adds tenant policies; prod application not verified | Run audit SQL on prod | n/a |
| D-S07 | MED | STILL-PRESENT | `src/lib/fontLoader.ts:4-5` jsDelivr `@main`; `src/App.tsx:221,226` `preloadHindiFont()` at load | Remove preload or self-host pinned | low |
| VQ-07..VQ-09 (LOW) | LOW | STILL-PRESENT | `pdfFileName` sanitize `[a-zA-Z0-9]`; footer "Generated free with SahakarLekha" at `pdf.ts:119` | n/a (LOW) | low |

Notes: D-10 and D-11 are LOW (still present, same as VQ-07/VQ-08). D-S08..D-S10 LOW not assessed except D-S09 (`pdf.ts:38`, `export/audit.ts:49` still Math.random) and D-S10 (`Payroll.tsx:303,668` `esc` still excludes quotes) which are STILL-PRESENT.
