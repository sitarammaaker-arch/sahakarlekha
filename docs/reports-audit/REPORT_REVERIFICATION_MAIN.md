# Re-verification of findings against `origin/main` (2cefda6)

**Why this file exists:** the original audit ran on branch `feat/registers-show-returns`, which was 287 commits behind main. Each CRITICAL/HIGH/MEDIUM finding was re-checked against current main code (read-only). Where this file and ALL_FINDINGS.md disagree, **this file wins**.

## Status counts
* Slices A+D (incl. security): STILL-PRESENT 39 · CHANGED 8 · FIXED-ON-MAIN 1 · UNVERIFIED 1
* Slices B+C: STILL-PRESENT 45 · CHANGED 7 · FIXED-ON-MAIN 5 (B-01 KCC wrong ledger, B-03 dummy-voucher false success, B-28 Hindi PDF cells, C-24, C-28)

## Fixed in this change set (branch `fix/reports-audit-p0p1`, tests added)
| Finding | Fix | Test |
|---|---|---|
| D-S01 CSV/XLSX formula injection | `neutraliseFormula` in buildCsv/buildWorkbook (typed numbers and numeric strings untouched) | test:export-hardening |
| D-15, E-01, C-32 | `safeSheetName` (31 chars, forbidden chars, duplicates), 32,767-char cell cap, `stripExt` (no `.csv.csv`) | test:export-hardening |
| D-S02 PII to viewer | `authorizeExport(..., mode)`: viewer-rank only gets `redacted` for entities holding PII | test:export-generator |
| U-01 (Vouchers page) | `if (!v?.id) return` before the "saved" toast at 3 sites | tsc (UI guard) |
| A-03 (Ledger, Day Book, Audit Certificate) | `isCountedVoucher` — same rule as `activeVouchers` | test:counted-voucher |
| A-04 Audit Certificate Cash/Bank = 0 | sign corrected (Dr-positive) | tsc; UNVERIFIED visually |
| A-06 Day Book PDF opening cash | page-computed opening passed to the generator | tsc; UNVERIFIED visually |
| D-02 long society names clip | `fitLine` shrink-then-ellipsis in PDF header | test:pdf-fit |
| D-04 "Rs. NaN" | non-finite guard in shared `fmt` | — |
| C-11 GSTR-1 place of supply hard-coded 09 | society state from GSTIN/state, recipient state per invoice, export refuses when unknown | test:gst-pos |
| C-12 GSTR-1 HSN N/A + B2B misses `gstin` | HSN resolved from item master; `gstin`‖`gstNo` | test:gst-pos |
| C-01 Stock Valuation FIFO label | selector removed; always states Weighted Average | tsc |

CI-equivalent: all 327 `test:*` scripts pass locally; `tsc --noEmit` clean.

## NOT fixed (still open on main) — need your decision / expert input
A-05 Cash/Bank Book opening-closing under filters · A-07 BRS ignores clearedDate · A-08 R&P not FY-bounded · A-09/D-06 imbalance tolerance & silent plug · A-10/A-11/A-12 narration-based FY/appropriation matching, rollover `financialYearStart` · B-02 loan interest accrual · B-04/B-05/B-06 asset/depreciation/aging · B-15/B-16 profit distribution legacy path & reserve fund · B-17..B-23 register content · C-05 consumer outstanding · C-13/C-14 GSTR-1 period/sections · C-15..C-17 Form 26Q/16A (need TDS expert) · C-18 multi-rate invoice · D-12/D-S03/D-S05 Export Center scope, server-side export auth, audit trail · D-01 header Hindi/footers · no print buttons on statements · Registered Society type.

---
## V_AD re-verification against main (D:\Website\sahakarlekha-fix, origin/main 2cefda6)

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

## V_BC re-verification of sections B and C against main (D:\Website\sahakarlekha-fix, fix/reports-audit-p0p1 @ origin/main 2cefda6)

Scope: every CRITICAL/HIGH/MEDIUM finding of sections B and C of ALL_FINDINGS.md (57 items). LOW/INFORMATIONAL skipped. Read-only. Line numbers are from the current main checkout. Uncommitted export-hardening edits in exportUtils.ts / generator.ts were ignored: statuses for B-33 and C-32 are for committed HEAD.
Risk legend: LOW = pure function / UI text / export formatting. ACCT = touches posting, ledger or statutory computation.

Totals: STILL-PRESENT 45, CHANGED 7, FIXED-ON-MAIN 5, UNVERIFIED 0.

## Section B

| ID | Sev | Status on main | Evidence | Fix suggestion | Risk |
|---|---|---|---|---|---|
| B-01 | CRIT | FIXED-ON-MAIN | KccLoan.tsx:120,195 use `kccLoanAccountId` (lib/loans/accounts.ts: exact id first, asset type only, "never 2305"); fyLocked on disbursement :118; no voucher => no loan :137; commit b8f9124 #509 | none | - |
| B-02 | CRIT | CHANGED (mostly fixed) | periodDays inclusive (lib/interestDayCount.ts:28, #529); overdue loans accrue (lib/loans/interestAccrual.ts:78,84, f3f7c25 #510); per-loan accruals saved first LoanInterest.tsx:192-195; fyLocked :185; `!v?.id` check :225; repayment clears 3313 (LoanRegister.tsx:161-169, #506). RESIDUAL: duplicate guard still `narration.includes(fromDate)` (LoanInterest.tsx:121) so monthly-then-annual overlap not refused; outstanding is still today's balance (interestAccrual.ts:91) | Refuse when any stored accrual record (loan_interest_accruals) overlaps [from,to], instead of narration text | ACCT |
| B-03 | HIGH | FIXED-ON-MAIN | LoanRegister.tsx:181-189 (`posted = !!v?.id`, destructive toast, no loan mutation, #506); KccLoan.tsx:135,214; ProfitDistribution.tsx:212 `if (v?.id) n++ else failed.push`, :326; ReserveFund.tsx:158-166 failed list; LoanInterest.tsx:225; #513 (5f77e68) | none | - |
| B-04 | HIGH | STILL-PRESENT | lib/pdf.ts:1246-1252 `calcBookValue` is SLM by elapsed years vs today; header hard-codes "Depreciation Method: SLM" :1245; screen uses AssetRegister.tsx:202 `cost - calcAccumDep`; PDF still receives unfiltered `assets` (AssetRegister.tsx:406) | Pass the screen's per-asset book values (or import the shared calcAccumDep from lib/depreciation) into the PDF generator; print method per row | LOW (report-only, no posting) |
| B-05 | HIGH | STILL-PRESENT | DepreciationSchedule.tsx:101-104 deductions = cost of ALL `status==='disposed'`; :94 depreciation only for activeAssets | Deductions only when `disposalDate` within FY; include part-year charge and remove accumulated dep of disposals | ACCT-report (schedule feeds audit; no posting) |
| B-06 | HIGH | STILL-PRESENT | AgingAnalysis.tsx:97-113 nets each voucher line into its own date bucket (no FIFO allocation); `today` module constant :44-45; no openingBalance read; routed at App.tsx:388. (Bills Outstanding page has real asOf + bill allocations, so this page is the legacy one) | Allocate credits to oldest debits, add opening balance to oldest bucket, as-on date; or redirect route to Bills Outstanding | LOW (report-only) |
| B-07 | MED | STILL-PRESENT | BillsOutstanding.tsx:39 `getOpenBills(sales, vouchers, c.id)`; billUtils.ts:73-77 has no asOf param; getBillSettledMap (:28) uses all vouchers | Add `asOf` param and ignore voucher.date > asOf in settled map | LOW |
| B-08 | MED | STILL-PRESENT | BudgetModule.tsx:67-76 `map[l.accountId] += l.amount` ignores `l.type` | Sign by Dr/Cr per account type (expense Dr +, Cr -; income reverse) | LOW (report-only) |
| B-09 | MED | STILL-PRESENT | lib/memberSnapshot.ts:32-35 `hasShareCapVoucher ? 0 : member.shareCapital`; OB row dropped once any share voucher exists | Emit an "Opening (uncovered)" row for member.shareCapital minus voucher total, or print getMemberShareReconciliation | LOW (display) |
| B-10 | MED | STILL-PRESENT | ShareNominationRegister.tsx:37-53 still uses flat.shareCount/shareFaceValue, no reconciliation to member share capital | Add a visible reconciliation row vs ledger 1102 | LOW |
| B-11 | MED | STILL-PRESENT | MeetingRegister.tsx:59 `sameType.length + 1`; ElectionModule.tsx:92 `elections.length + 1`, :99 `elec_${Date.now()}` | Use max(existing suffix)+1 locally, or next_document_number RPC | LOW |
| B-12 | HIGH | STILL-PRESENT | MeetingRegister.tsx:182 `meetingDelete` -> supabaseService.ts:94 `dbDelete` (hard delete), local filter :188; no audit event / FY check | Soft-delete (isDeleted) + emitAudit; route via DataContext | ACCT-adjacent (statutory record, not ledger) |
| B-14 | MED | STILL-PRESENT | `matchesActiveBranch` used only on DayBook, Ledger, Members, GST/TDS/Sale/Purchase registers; ShareRegister, Form1MemberList, LoanRegister, AssetRegister have zero branch references | Apply matchesActiveBranch to members/loans/assets in those pages, or label society-wide | LOW |
| B-15 | CRIT | CHANGED (core gap still present) | Frozen member snapshot exists (ProfitDistribution.tsx:184-190, 212 per-member ids); bonus dated FY-end :316; statutoryLimits wired :118. STILL: comment "OPTIONAL — never block dividend/bonus" :241 and `canPost` ignores statutory reserve :242; legacy path still ungated; dividend dated `today` :297; ReserveFund also optional | When `society.statutoryAppropriation` on, disable legacy post buttons and require reserve before dividend (call the existing addStatutoryAppropriation gate) | ACCT |
| B-16 | HIGH | STILL-PRESENT | ReserveFund.tsx:144,152 `date: today`; banner "entirely optional" :205; one journal per fund non-atomic :148-159 | Default date to FY end (or AGM date within FY); warn/block when reserve% < statutory | ACCT |
| B-17 | HIGH | STILL-PRESENT | Form1MemberList.tsx:36 status filter `'all'|'active'|'inactive'`, default 'active'; :74,127,288 maps every non-active to "Inactive"; no statusChangedAt/Reason | Show real status (5 values) + cessation date/reason; default filter all | LOW (display/export) |
| B-18 | HIGH | STILL-PRESENT | ShareRegister.tsx:133 `generateShareRegisterPDF(members, society)` vs screen `approvedMembers` :35 | Pass `approvedMembers` (or `filtered`) | LOW |
| B-19 | HIGH | STILL-PRESENT | NominationRegister.tsx:46 activeMembers only; exports :93,:120 use activeMembers not filtered list; no `nominees[]` use | Export `filtered`; render nominees[] with share % | LOW |
| B-20 | HIGH | STILL-PRESENT | stateAuditFormats.ts: 8 formats `schedules: HARYANA_SCHEDULES`; getStateAuditFormat falls back to generic :536-537; computed rows 1%/3% :176-177 vs per-state educationFundPct :378-416; pdf.ts:206 default 'hr' vs AuditSchedules.tsx:194 society.state; no source citations. Statutory content needs external validation | Derive fund rows from format.educationFundPct; one default; warn for unmapped states | ACCT-report (needs CA/legal source) |
| B-21 | HIGH | STILL-PRESENT | DataContext.tsx:2902,2918 update/delete AuditObjection call `guardFYLocked()` (add path :2871 has no FY guard, only auditNote); pdf.ts:1312,1315 truncate objection 60 / action 40 chars | Skip FY guard when role has auditNote; wrap text in PDF instead of substring | LOW (PDF) / permission (guard) |
| B-22 | HIGH | CHANGED (partial) | Overdue now derived from dueDate (LoanRegister.tsx:223 `statusOf`, #516 c2d1fce) and PDF gets derived status :344. STILL: no NPA class, no security/guarantor/interest-outstanding columns (pdf.ts generateLoanRegisterPDF head, 11 cols), no deposit register, no 194A on deposit interest | Add DCB/NPA columns from existing outstanding+overdue-days | LOW (columns) / ACCT (194A) |
| B-23 | HIGH | STILL-PRESENT | lib/complianceCalendar.ts:70-79 hard-coded 15th/11th/20th, monthly GST only (no QRMP), no sources | Move to dated rule catalog with source+effective-from; add QRMP flag. Needs CA input | LOW (dates) but EXTERNAL VALIDATION |
| B-24 | MED | STILL-PRESENT | OutstandingRegister.tsx:31 `useState('21')`; depreciationRateMaster.ts:1-9 "commonly-used defaults" | Label as defaults / require entry; source them | LOW |
| B-25 | MED | STILL-PRESENT | No legalForm field in types/index.ts; wording cooperative-only | Document scope or add legalForm label switch | LOW |
| B-26 | MED | STILL-PRESENT | ElectionModule.tsx:97 status computed once at creation (:128 only changes on result entry) | Derive status from electionDate at render | LOW |
| B-28 | HIGH | FIXED-ON-MAIN (tables); labels English by design | lib/pdf.ts:20 `installDevanagariCells()` + lib/pdfDevanagari.ts (browser-canvas image for Hindi cells), commit 0c725c0 #547. Hindi in free `doc.text` outside tables is still helvetica (pdf.ts:24-26) -- residual, low | none (optionally route Hindi society name header through same canvas) | - |
| B-29 | MED | STILL-PRESENT | pdf.ts:1312,1315 (60/40 chars); MeetingRegister.tsx:224 `substring(0,60)` | Wrap full text via autotable | LOW |
| B-30 | MED | STILL-PRESENT | window.print only in AdvanceRegister, Godowns, GuideCertificate, Member360, MemberPortal, Payroll, WageRegister, WageSlip, BarcodeLabels; Form1MemberList has `print:` CSS (:188) but no button | Add a Print button to Form1MemberList | LOW |
| B-32 | MED | STILL-PRESENT | ShareRegister.tsx:133, AssetRegister.tsx:406, AuditRegister.tsx:219 pass full arrays; LoanRegister.tsx:344 passes all `loans`; NominationRegister exports activeMembers | Pass filtered lists | LOW |
| B-33 | MED | STILL-PRESENT (committed HEAD) | exportUtils.ts HEAD:60 `escape` only doubles quotes, no =,+,-,@ neutralisation; no neutralisation in export/generator.ts at HEAD. Working-tree edits are in progress (ignored) | Prefix cells starting with = + - @ \t \r with `'` in buildCsv and XLSX string cells (numbers untouched) | LOW |

## Section C

| ID | Sev | Status on main | Evidence | Fix suggestion | Risk |
|---|---|---|---|---|---|
| C-01 | HIGH | STILL-PRESENT | StockValuation.tsx:83 method state, :106 value always WA, :148 PDF subtitle prints "FIFO" when selected. Only mitigation is note :239 | Remove selector or force subtitle/method to WA | LOW (UI text) |
| C-02 | MED | STILL-PRESENT | Inventory.tsx:685-688 `stockItems.reduce(...)` over all items incl. inactive; other reports filter isActive | `stockItems.filter(i=>i.isActive)` in totalStockValue | LOW |
| C-03 | MED | CHANGED | Closing now whole-history WA cost, matches Trading (ClosingStockReport.tsx:105-111, 926505e "Audit #11"). STILL: opening = openingStock x purchaseRate :100-101 (ignores prior-FY movements); flow value = `abs(m.amount)` :93 (sale at selling price) | Derive FY-opening from movements before FY start; value sale at WA cost | ACCT-report |
| C-04 | MED | CHANGED | godownStock.ts:13,44 now has UNASSIGNED_GODOWN bucket for movements without godownId; but opening stock never included and no reconciliation vs Inventory (Godowns.tsx:91) | Add opening stock to Unassigned + reconciliation line | LOW |
| C-05 | HIGH | STILL-PRESENT | lib/consumer/registers.ts:74,76 call memberOutstanding/memberAgeing without `returns` (credit.ts:52-57 has the `returns` param, default []); buildOutstandingRegister signature takes no returns (ConsumerRegisters.tsx:35) | Add `returns` arg and pass activeReturns, as ConsumerDataContext does | LOW-ACCT (read-only register, wrong demand amount) |
| C-06 | MED | STILL-PRESENT | registers.ts:26-40 sums all sales in range, unknown paymentMode -> cash, no return netting | Filter POS sales, net returns, add "other" tender | LOW |
| C-07 | MED | STILL-PRESENT | lib/marketing/registers.ts:30-33 date from `createdAt`; no rejected filter (grep "rejected" none) | Exclude/separate rejected; use arrival date | LOW |
| C-08 | MED | STILL-PRESENT | DairyDataContext.tsx:392 `'DS/' + (approved && !deleted count + 1)` | Use next_document_number RPC (T-03) or max+1 | ACCT-adjacent (numbering) |
| C-10 | MED | STILL-PRESENT | WageSlip.tsx:35 `computePfEsi(period, PF_ESI_DEFAULTS)` | Read posted run's per-worker values | LOW |
| C-11 | CRIT | STILL-PRESENT | GstSummary.tsx:91 `stateCode \|\| '09'`, :493 and :542 `pos` same fallback; lib/gstStates resolver not used here | pos per invoice via resolveStateCode(buyer GSTIN/state); fall back to society GSTIN state, never '09' | ACCT-statutory (JSON export only, no posting) |
| C-12 | CRIT | STILL-PRESENT (HSN half CHANGED) | B2B test still `cust?.gstNo` only (GstSummary.tsx:101,204); HSN summary reads `(item as any).hsnCode` from sale items :267 -> 'N/A' (returns side already looks up stockItems :112) | Resolve hsn via stockItems; `gstin \|\| gstNo` | ACCT-statutory (export only) |
| C-13 | HIGH | STILL-PRESENT | GstSummary.tsx:375,475 period from fromDate; :491 `idt: s.date` ISO; :510 sply_ty 'INTRA'; :553-554 version/hash placeholders | Force single-month range; dd-mm-yyyy; INTER/INTRA by pos. Needs schema validation | ACCT-statutory (export) |
| C-14 | HIGH | STILL-PRESENT | payload keys b2b/b2cs/cdnr/hsn only (GstSummary.tsx:557-560 region); `isup_rev` zeros :380 | Add nil/exempt, B2CL, doc-issued; RCM via lib/rcm.ts. Needs external validation | ACCT-statutory |
| C-15 | CRIT | STILL-PRESENT | TdsRegister.tsx:221-225 allEntries includes salaryTdsEntries (section 192, :199); :381-391 26Q export uses quarterEntries unfiltered; tds26q.ts:62 'SahakarLekha v1.0', :76 `society.state.toUpperCase()` as state code, :123-124 fake BSR 0000000/00000000, :18 '192' mapped | Filter `section !== '192'` before validate26QData/generate26QText; separate 24Q; validate with FVU | ACCT-statutory (export) - filter is low-risk |
| C-16 | HIGH | STILL-PRESENT | TdsRegister.tsx:151 `panFromGstin(supplier?.gstNo)`, :154 section '194Q' for every purchase, :157 `p.tdsPct \|\| 0.1`; lib/tax/computeTds.ts used only by purchaseTdsAdvice/ask, not by the register | Use supplier.pan and the supplier's section; route via computeTds. Needs CA mapping | ACCT |
| C-17 | HIGH | STILL-PRESENT | TdsForm16A.tsx:111 "Section 203 ... 1961", title "TDS Form 16A" :112,167; FY list stops 2025-26 :204 | Rename to "TDS statement (not Form 16A)"; add 2026-27 | LOW (UI text) |
| C-18 | HIGH | STILL-PRESENT (misprint part UNVERIFIED) | Invoice-level single GST rate (types/index.ts:1308); pdf.ts:2576 `isTaxInvoice = sellerGstin && taxAmount>0`, :2593 "Original for Recipient" fixed, :2948 "no tax is chargeable" branch. Did not re-open the grand-total-with-hidden-tax path | Block tax without GSTIN; per-line rate table | ACCT-statutory |
| C-19 | MED | STILL-PRESENT | GSTR9.tsx:49-50 passes unfiltered salesReturns/purchaseReturns while sales/purchases are branch-filtered :39-40 | Apply matchesActiveBranch to returns | LOW |
| C-20 | MED | CHANGED | Missing HSN now blocks (EWayBill.tsx:123-127, Slice 3) but fallback code '9999' remains :141 (dead after block); STILL: docDate ISO :167, pincode '000000' :155, inward docNo = purchaseNo :166,192, save failure only console.error :213 | Toast on save failure with rollback hint; dd/mm/yyyy | LOW |
| C-21 | MED | STILL-PRESENT | PfEsi.tsx:87 emits `, 0, 0` NCP/refund though daysOf :76 exists | Derive NCP = days in month - present days | ACCT-statutory (export) |
| C-22 | MED | STILL-PRESENT | pdf.ts:1682 single `'Deductions'` line; TdsRegister reads legacy `salaryRecords` only (:98,181) | Print PF/ESI/PT/TDS breakup; merge new Payroll TDS | LOW (PDF) / ACCT (merge) |
| C-24 | MED | FIXED-ON-MAIN (removed) | lib/annualReview now only p2Calculator.ts/p8Calculator.ts; p8Pdf.ts deleted in 4830ce1 #518 | none | - |
| C-28 | HIGH | FIXED-ON-MAIN (tables) | Same as B-28: pdf.ts:20 installDevanagariCells; #547 (0c725c0). Labels remain English by design (pdf.ts:23-26) | none | - |
| C-30 | MED | STILL-PRESENT | pdf.ts:2113 "correct as per the physical verification and Books of Account" | Reword to "as per Books of Account" | LOW (UI text) |
| C-32 | HIGH | STILL-PRESENT (HEAD; export-hardening WIP in tree) | exportUtils.ts HEAD:162,170 append .csv/.xlsx; callers pass extensions: Inventory.tsx:911-912, Customers.tsx:139,148, SaleManagement.tsx:432,437, PurchaseManagement.tsx:463,468, SalaryManagement.tsx:292,561,567, GSTR9.tsx:79, HsnMaster.tsx:139,145, Vouchers.tsx:526,535, ConsumerRegisters.tsx:45,50 | In triggerDownload/downloadCSV/downloadExcel strip an existing trailing `.csv/.xlsx` | LOW |
| C-33 | MED | STILL-PRESENT (salary verified; rest UNVERIFIED) | SalaryManagement.tsx:561-567 exports all `salaryRecords`, no filters. Did not re-open TdsForm16A/DairyRegisters/EntityExportButton | Export the filtered list | LOW |
| C-34 | MED | CHANGED | SaleRegister.tsx:70-81,143-144,265 now shows returns as a netted section (d63abb4 #390); STILL: CSV/XLSX rows only sales, no returns/GSTIN/HSN (SaleRegister.tsx:83-91); GstSummary.tsx:355-356 and StockValuation.tsx:132-133 export `.toFixed()` strings. Purchase register export / PDF not re-checked | Include return rows in export; export numbers not strings | LOW |

## Notes
- Also observed: SaleRegister.tsx:358 still claims the register "can be used for GSTR-1 filing" (C-36, LOW).
- Items needing external statutory validation (not code-fixable alone): B-20, B-23, C-13, C-14, C-15 layout, C-16 sections, C-21.

---

## Batch 2 (branch `fix/reports-audit-p2`)
| Finding | Fix | Test |
|---|---|---|
| A-05 Cash/Bank Book opening/closing under date filter / branch | `bookWindow`: opening = running balance before the window (or in-scope account opening); closing = last running balance in the window | test:book-window |
| A-07 BRS ignores clearing date | `isClearedAsOf`: cleared only if `clearedDate <= as-on date`; BRS also excludes rejected/pending vouchers (`isCountedVoucher`) | test:bank-clearing |
| D-12 Export Center scope label | exports are whole-table: file named `<entity>-all-years-<date>`, README/audit record "all financial years, all branches" | test:export-buttons/generator |

**Deliberately NOT done — A-08 (R&P not FY-bounded):** doing it the Trial-Balance way changes receipts/payments totals for multi-year societies and the prior-year snapshot taken at FY close (SocietySetup), and the ledger projection takes the same openings. That is a financial-calculation change that needs a design + CA sign-off, not a display fix.
