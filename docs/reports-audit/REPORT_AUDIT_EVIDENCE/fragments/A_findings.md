# Slice A findings — Core financial statements (audit 2026-10-03)

Scope: TB, BS, I&E/P&L, R&P, Trading A/c, Cash/Bank/Day Book, Ledger, Voucher register, Deleted vouchers, BRS, Reports hub, Fund Statement, Statutory Reconciliation, Multi-Society, Federation, NABARD, Audit Certificate, comparatives. READ-ONLY; nothing in src/ was modified. "UNVERIFIED" = proof needs runtime/prod data. Statutory conformance of ANY statement layout = EXTERNAL VALIDATION NEEDED (see S-01).

Entity types: `SocietyType` = marketing_processing | pacs | consumer | labour | dairy | housing | sugar | producer | multistate | multipurpose | other (src/types/index.ts:1004). All are cooperative societies. No "Registered Society" (Societies Registration Act 1860 / trust / NGO) type exists anywhere in src (grep for 1860 / registered society returned only GST wording). Statement selection is capability-driven (src/lib/reports/statements.ts:37-53); only `nabard_return` gates on legal type 'pacs'.

Counts: CRITICAL 0 (A-01 would be CRITICAL if prod holds multi-FY vouchers - UNVERIFIED), HIGH 9, MEDIUM 21, LOW 11, INFORMATIONAL 5 (total 46).

---
## Accounting / Data

### A-01 HIGH — Statements are cumulative-from-inception; "FY" figures are not period figures; rollover does not reset
- Evidence: `getTrialBalance` filters only `v.date <= asOnDate`, no lower bound (DataContext.tsx:4749-4751); `getProfitLoss`/`getTradingAccount` call it with FY end (5393-5396, 5604-5607). Current I&E = `getProfitLoss(fyEndDate)` (ProfitLoss.tsx:35) but the prior-year column = `deltaProfitLoss(end,start)` (ProfitLoss.tsx:46) — two different bases on one page. `handleRolloverFY` only changes `financialYear`/snapshots and unlocks (SocietySetup.tsx:307-343); it does not close nominal accounts, archive vouchers or move openings. `computeYearClose` (lib/rules/yearClose.ts) has no consumer outside tests. `OpeningBalances` carry-forward writes `account.openingBalance` (OpeningBalances.tsx:119-176) while all prior vouchers stay in the TB.
- Failure scenario: Society runs FY2025-26 then rolls over. FY2026-27 I&E "For the Financial Year 2026-27" shows 2025-26 + 2026-27 income and expense; if the user also applies "carry forward audited closing" the BS accounts count prior-year closing twice (opening + still-present old vouchers). TB column "Debit (period)" is cumulative.
- UNVERIFIED: whether prod societies have >1 FY of vouchers or purge old vouchers. Becomes CRITICAL if yes.
- Fix: introduce FY lower bound (financialYearStart) for nominal accounts and for R&P/Cash Book "period" columns; at rollover post a year-close journal (wire computeYearClose) and set openings from it; or define and enforce one model.
- Test: fixture with vouchers in FY1 and FY2, rollover, assert FY2 I&E excludes FY1 and BS still balances with openings applied once.

### A-02 HIGH — Trading A/c opening/closing stock logic is untested and internally inconsistent when ledger stock exists
- Evidence: opening stock = `openingDebit` of 3400 children only (DataContext.tsx:5456-5459); closing = ledger net of 3400 children when any non-zero, else physical (5449-5453); BS drops 3400 leaves and injects physical stock when no journal is posted (BalanceSheet.tsx:121-134); `postClosingStock` posts the FULL physical value, not value minus opening (5582-5593). `npm run test:trading-account` only exercises two pure helpers (lib/tradingAccount.ts), not `getTradingAccount`.
- Scenario (code-reasoned): ledger 3403 opening O>0, no closing journal: Trading A/c closing = O (stale) so GP ignores physical stock; BS shows physical X, imbalance X-O. After posting closing journal C: ledger 3403 = O+C, Cr side shows O+C vs Dr O, so GP and BS stock are overstated by O. If opening stock is held only in `StockItem.openingStock` (ledger O=0) the Dr side has no opening stock at all.
- UNVERIFIED at runtime (no fixture run).
- Fix: single stock rule per CLAUDE.md RULE 2; add an integration test over `getTradingAccount` + BS tie with O>0.

### A-03 HIGH — Pages bypass `activeVouchers` (rejected / pending / branch) and diverge from the Trial Balance
- Evidence: context rule excludes rejected and pending-under-approval vouchers (DataContext.tsx:4462-4469). Raw `vouchers.filter(!isDeleted)` is used in Ledger.tsx:67-69 (branch only), DayBook.tsx:85, BankReconciliation.tsx:104-142, AuditCertificate.tsx:53, NabardReport.tsx:96, FederationReport.tsx:55, Vouchers.tsx:524 (export).
- Scenario: society with maker-checker; a rejected voucher still appears in Ledger/Day Book/BRS/Audit Certificate/Federation return while TB, Cash Book and BS ignore it. CLAUDE.md RULE 5 / RULE 2 violated.
- Fix: expose `activeVouchers` (or selector) from useData and use it everywhere.
- Test: reject a voucher, assert Ledger closing == TB net for that account.

### A-04 HIGH — Audit Certificate default Cash/Bank = Rs 0 (sign inverted)
- Evidence: `getBalance` is credit-positive (AuditCertificate.tsx:49-60: debit opening -> negative, Dr line `bal -= amount`). Default `cashBookBal = Math.max(0, round(cashBalance))` (88-89). A normal Dr cash balance is negative so the default is 0; PDF/XLSX print the state value (163-164, 102-103).
- Scenario: Cash Rs 50,000 Dr -> certificate prints "Cash in Hand (as per Cash Book): Rs. 0.00" unless the auditor retypes it. Also uses raw vouchers and hardcoded '3301'.
- Fix: use `getAccountBalance`; show ledger value beside override.
- Test: cash Dr 50000 -> field default 50000.

### A-05 HIGH — Cash Book / Bank Book opening & closing wrong under filters, overdraft or branch
- Evidence: CashBook.tsx:39 `openingBalance = account.openingBalance` (unsigned, not as of `fromDate`, ignores branch scope); table/PDF/CSV print it as the opening row (CashBook.tsx:93-121; pdf.ts:318-325) and `closingBalance = getAccountBalance(CASH)` all-time (CashBook.tsx:47). Rows come from `getCashBookEntries(from,to)` whose running balance is correct (DataContext.tsx:4631-4661) so opening + rows != closing. BankBook.tsx:44-45 same, plus no date filter UI.
- Scenario: filter June -> opening shows year-start OB, total row shows today's balance. Bank overdraft opening (type credit) prints as positive.
- Fix: derive opening = first row runningBalance -/+ amount (or have the getter return opening); closing = last row.
- Test: filter mid-year; assert opening + receipts - payments == closing.

### A-06 HIGH — Day Book PDF opening cash ignores prior vouchers
- Evidence: pdf.ts:1380-1387 loops `entries` (already restricted to the range) for `v.date < firstDate`, which can never match; runCash starts at raw account opening (1376). On-screen Day Book computes pre-period from all vouchers (DayBook.tsx:107-120).
- Scenario: PDF for May opens at inception cash, screen opens at April closing.
- Fix: pass `cashOB` from the page. Test: PDF opening == screen opening.

### A-07 MEDIUM — Bank reconciliation ignores `clearedDate`
- Evidence: `isCleared` used alone (BankReconciliation.tsx:112-118, 376); `clearedDate` is stored (DataContext.tsx:2514) but never read in the page (grep).
- Scenario: BRS as at 31 Mar; cheque cleared 5 Apr is treated as cleared so deposits/cheques in transit are understated and the derived statement balance is wrong. Also opening ignores branch scope; raw vouchers (A-03).
- Fix: cleared iff `clearedDate <= asOfDate`.

### A-08 MEDIUM — Receipts & Payments not FY-bounded, no period picker
- Evidence: `getReceiptsPayments()` called without date (ReceiptsPayments.tsx:23) while TB/P&L/BS use FY end. Includes vouchers dated after FY end and prior years; AUDIT_NCDC doc itself flags it (AUDIT_NCDC_Compliance_Report.md line 152 region). Totals summed in float on page (24-27) vs paise in context.
- Fix: add from/to defaulting to FY, pass to getter.

### A-09 MEDIUM — Balance tolerance of Rs 1 and silent plug
- Evidence: TB/BS/PDF treat |diff| < 1 as balanced (TrialBalance.tsx:77, BalanceSheet.tsx:145, pdf.ts:477). On add, a residual < Rs 1 is silently added to the largest line (DataContext.tsx:1790-1798); on edit, vouchers unbalanced by 0.01-0.99 are accepted (2133 blocks only `diff >= 1`); `voucherLinesBalance` uses float with 0.01 (validation.ts:169-176).
- Scenario: user-entered amount altered by up to Rs 0.99 without notice; accumulated sub-rupee drifts shown "Balanced" on a certified TB.
- Fix: tolerance 0.005 on reports; reject/prompt instead of plugging; paise arithmetic in validation.

### A-10 MEDIUM — Closing-stock-posted detection by narration text
- Evidence: `v.narration.includes(fy)` (DataContext.tsx:5435-5446, 5572-5576). Editing narration or a second FY string match changes posted/unposted state, flipping BS/Trading logic (A-02).
- Fix: structured flag/refType on the closing-stock journal.

### A-11 MEDIUM — Appropriation figures matched by narration text
- Evidence: ProfitLoss.tsx:62-66, SocietySetup.tsx:296-302, FederationReport.tsx:172-177 use `narration.includes(financialYear)`; any voucher mentioning the FY with Dr 1208 counts.
- Fix: structured appropriation reference (the T-20 engine voucher).

### A-12 MEDIUM — Rollover leaves `financialYearStart` stale
- Evidence: `updateSociety` in handleRolloverFY omits `financialYearStart` (SocietySetup.tsx:332-341); Day Book default range and the voucher-date warning use it (DayBook.tsx:69; DataContext.tsx:1759-1764).
- Fix: update start with FY.

### A-13 LOW — FY end hardcoded as `20${yy}-03-31` in ~10 places
- Evidence: DataContext.tsx:1759, 5393, 5604; TrialBalance.tsx:27; BalanceSheet.tsx:57; ProfitLoss.tsx:33; OpeningBalances.tsx:123 uses a different formula (start year + 1). A malformed FY string (e.g. "2025-2026") yields an invalid date. UNVERIFIED whether setup validates the format.

### A-14 LOW — Page-level totals use float, context uses paise
- TB page (TrialBalance.tsx:66-73), BS (BalanceSheet.tsx:139-140), R&P (ReceiptsPayments.tsx:24-28), Cash Book totals (CashBook.tsx:44-46). Display can differ by 0.01 from context.

### A-15 MEDIUM — Multi-Society Consolidation lacks integrity checks
- Mixed FYs allowed (MultiSocietyConsolidation.tsx:249), no inter-society elimination, equity excludes surplus so A != L+E+S unchecked, exports rounded to whole rupees (`fmtNum`, MultiSocietyConsolidation.tsx:209), duplicates only detected by file name (447), ignores approval status. TB cumulative (A-01).

### A-16 LOW — Reports hub KPIs not FY-bounded
- `getAccountBalance` for cash/bank (Reports.tsx:62-64) is all-time while Net Surplus uses FY end (61).

### A-17 INFORMATIONAL — Synthetic "[Deleted] xxxxxxxx" TB rows
- Legs on accounts missing from non-group set become synthetic liability rows (DataContext.tsx:4795-4806). Consistent with memory note (group accounts with postings). Keeps TB balanced but hides misposting.

### A-18 INFORMATIONAL — Tests mirror rather than execute the real aggregators
- `test:accounting` is a JS mirror of voucherImmutability (scripts/test-accounting.mjs:1-3). No script imports `getTrialBalance`/`getProfitLoss`/`getTradingAccount`/BS assembly from DataContext. Ledger-lib tests (T-09) pass but cover projections, not report assembly.

### A-19 LOW — NABARD report integrity
- NPA buckets hardcoded 90/365/1095 days from due date, whole outstanding treated as overdue (NabardReport.tsx:56-75); `today` recreated each render defeats useMemo (43-44, 75); no as-on date; loan subledger not tied to GL.

## Statutory

### S-01 HIGH — No authoritative statutory source in repo for any statement layout
- AUDIT_NCDC_Compliance_Report.md is an internal audit that cites NCDC annexures but does not contain their text; docs/CA-VERIFICATION-2026-07.md is a blank TDS/payroll questionnaire (lines 1-118) with no statement content; stateAuditFormats.ts is code. Therefore TB/BS/I&E/R&P/Trading layout, Federation return, NABARD report and Audit Certificate wording = EXTERNAL VALIDATION NEEDED. The product must not claim "statutory compliant".

### S-02 MEDIUM — Entity type coverage
- Cooperative types only; Registered Society (1860) / trust / Section 8 not modelled. A registered society would receive cooperative-Act wording (e.g. "Cooperative Societies Act", appropriation to statutory reserve).

### S-03 MEDIUM — Pre-printed auditor's certificate / hardcoded dates
- addAuditorCertificate prints "certify ... presents a true and fair view ... as on 31st March" with society name and state Act (pdf.ts:197-206) on BS and I&E PDFs; BS title always "As at 31st March 20YY" (pdf.ts:652) although the page has an as-on picker (BalanceSheet.tsx:57-63). Audit Certificate page header "[Under the Cooperative Societies Act]" (AuditCertificate.tsx:125) regardless of state.
- Fix: dynamic as-on; make certificate wording configurable and CA-approved.

### S-04 MEDIUM — Appropriation statement missing as a report
- Registry lists `pl_appropriation` (statements.ts:38) but Reports hub only maps three codes (Reports.tsx STMT_META); appropriation exists only as a section on the I&E page and in CSV/XLSX, not in the PDF (pdf.ts:495-559, `void reserveFund`). Indicative education fund hard-coded at 1% (ProfitLoss.tsx:78-80).

### S-05 MEDIUM — Trading A/c exports omit activity-wise breakdown
- Screen shows `activities`/`unallocated`; PDF/XLSX/CSV do not (TradingAccount.tsx:44-58,76-95).

### S-06 MEDIUM — I&E PDF omits prior-year column and appropriation shown on screen; BS/TB PY columns differ screen vs PDF
- pdf.ts:495-559 vs ProfitLoss.tsx; BS PDF uses snapshot `previousYearBalances` (pdf.ts:656-660) while screen prefers computed (BalanceSheet.tsx:86-96).

### S-07 LOW — NABARD/legal-type gating inconsistent
- Nav gate = capability `lending` (moduleCatalog.ts:154); registry = legal type pacs only (statements.ts:53). Federation return gate = `procurement_msp` (moduleCatalog.ts:155) with no legal-type check.

## Security

### SEC-01 MEDIUM — Export permission (ECR-19) enforced on only 5 pages
- `can('export')` appears only in TrialBalance, BalanceSheet, ProfitLoss, ReceiptsPayments, TradingAccount (grep). Cash Book, Bank Book, Day Book, Ledger, Vouchers, Deleted Vouchers, Fund Statement, Audit Certificate, NABARD, Federation, Multi-Society expose XLSX/CSV to roles lacking `export` (cashier, salesOperator, employee, dataEntry, readOnly — rbac.ts:73-91). PDF is ungated everywhere (treated as print).
- Fix: gate all XLSX/CSV buttons; test via role matrix.

### SEC-02 MEDIUM — CSV/XLSX formula injection
- `buildCsv` quotes but does not neutralise leading `=`, `+`, `-`, `@` (exportUtils.ts:57-62). User-entered narrations/account names flow into every export.
- Scenario: narration `=HYPERLINK(...)` executes when auditor opens CSV in Excel.
- Fix: prefix `'` for such cells in CSV (and XLSX strings).

### SEC-03 INFORMATIONAL — Cross-tenant surfaces
- Multi-Society "live societies" RPCs are super-admin only and server-gated (supabase/migrations/020_gate_super_admin_rpcs.sql; page gate MultiSocietyConsolidation.tsx:366). Tenant isolation for report data otherwise relies on RLS (memory: LIVE). UNVERIFIED here (no prod access).

### SEC-04 LOW — Third-party font fetch + non-verifiable Report ID
- `preloadHindiFont()` fetches from cdn.jsdelivr.net at startup (App.tsx:215-220; fontLoader.ts:5) yet PDFs never use it (pdf.ts:20-22). Report ID uses Math.random (pdf.ts:30-34) — not tied to content hash, so it cannot authenticate a statement.

## Print / PDF

### P-01 HIGH — PDFs use Helvetica only; Devanagari text cannot render
- pdf.ts:20-22 (`setupFont` always helvetica); Ledger.tsx:155 comment acknowledges; narrations, member/party names and Hindi account names (`nameHi`) in Hindi will be blank/garbled in all PDFs including audit statements. Hindi font loader exists but is unused. Runtime rendering UNVERIFIED (no PDF produced), but jsPDF standard fonts have no Devanagari glyphs.
- Fix: embed Noto Sans Devanagari via addFileToVFS for PDF paths; test with a Hindi narration.

### P-02 MEDIUM — No print button / print stylesheet for any statement
- No `window.print` in slice pages; layout components contain no `print:hidden` (grep of src/components/layout). Ctrl+P prints sidebar/header. Only Day Book/Audit Certificate have partial print CSS. index.css:264-290 defines `.no-print`/`.report-table` but statement pages do not use `.report-table`.

### P-03 MEDIUM — PDF names/subtitles ignore filters
- pdfFileName gives `Report_Society_FY_x.pdf` unless both dates passed (pdf.ts:40-47); TB uses as-on only in subtitle; Cash/Bank PDF subtitle says FY even when date filtered (pdf.ts:303, 358). Repeated downloads overwrite/confuse.

## Export

### E-01 MEDIUM — Double file extensions
- Vouchers.tsx:526,535 pass 'vouchers.csv'/'vouchers.xlsx' and exportUtils appends again (exportUtils.ts:162,170) -> vouchers.csv.csv; same DeletedVouchers.tsx:67,73.

### E-02 MEDIUM — Exports carry no provenance
- No slice page passes `meta` to downloadExcel* (only Multi-Society has it); sheets have no society/reg no/FY/as-on/filter header and filenames omit society name. buildReadmeSheet exists (exportUtils.ts:74-97) but is opt-in.

### E-03 LOW — Numbers exported as text
- NABARD/Federation export `fmt()`-formatted strings (NabardReport.tsx:154) so Excel cannot sum them.

### E-04 LOW — Day Book export naming/scope
- File name always embeds fromDate/toDate state (DayBook.tsx:201,205) even when `filtered` is false and everything is exported (entries line ~90).

### E-05 MEDIUM — Balance Sheet XLSX/CSV not equivalent to screen/PDF
- Missing unposted closing-stock row and PY; not blocked when unbalanced while PDF is (BalanceSheet.tsx:233-257,264-278). Export grand total != row sum when `unpostedStock > 0`.

### E-06 MEDIUM — Voucher register export incomplete
- No status/approval, FY/date filter, created-by or multi-line detail; includes rejected/pending (Vouchers.tsx:519-535).

### E-07 INFORMATIONAL — Coverage gaps
- BRS no XLSX/CSV; Statutory Reconciliation no export; Fund Statement CSV only.

## UX

### U-01 HIGH — False "saved" toast and form wipe when addVoucher is refused
- `addVoucher` returns an empty-id stub on FY-lock, period-lock, permission and subscription-expired (DataContext.tsx:1728-1757). Vouchers.tsx:376-379, 408-412, 441-444 show "Voucher saved" and call `handleClear()` regardless (only trackEvent checks `v.id`); CashBook.tsx:65 and BankBook.tsx:97 show "Entry saved" and close the dialog. DayBook.tsx:60-64 shows the correct pattern.
- Scenario: FY audit-locked: user sees destructive lock toast AND success toast, form cleared, entry lost. Matches memory "false-success-toast pattern" (CLAUDE RULE 1/6).
- Fix: `if (!v.id) return;` before success toast/clear. Test: lock FY, submit, assert form retained and no success toast.

### U-02 MEDIUM — ProfitLoss page title is not capability-driven
- Hard-coded "Income & Expenditure" (ProfitLoss.tsx:117,252) while the hub labels it "Profit & Loss A/c" for trading societies (statements.ts:36-37).

### U-03 INFORMATIONAL — Hindi column labels
- Cash Book heads "रसीद (जमा) / भुगतान (नाम)" (CashBook.tsx:258): in strict Hindi accounting जमा=Credit, नाम=Debit while receipts are debits to Cash. Verify convention with the CA.

### U-04 LOW — Day Book filter semantics
- Date inputs have no effect until "filter" is clicked; pre-period opening uses first visible entry rather than `fromDate` (DayBook.tsx:97-120), and with zero entries shows only account opening.

### U-05 LOW — BS "Detailed/Summary" toggle state not echoed in CSV/XLSX
- CSV always full-detail.

### U-06 LOW — Audit Certificate nav excludes auditor role
- requiredRoles ['admin','accountant'] (moduleCatalog.ts:170) although auditors are its primary users (the page is auditor-facing).

## Missing reports
See A_gaps.md.
