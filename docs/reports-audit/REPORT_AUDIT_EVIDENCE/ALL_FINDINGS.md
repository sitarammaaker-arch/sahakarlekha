# All findings (verbatim from slice auditors)




---

## A — Core financial statements


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


---

## B — Registers & statutory


Audit date 2026-10-03. Read-only. Every citation is a file:line that was opened. "UNVERIFIED" means the repo does not hold the evidence needed. A report existing is never treated as "statutory compliant": the only statutory sources found in the repo are `docs/research/TASK2.3-COOP-ACCOUNTING-REGISTERS.md` (itself marked [NV per state] throughout), `AUDIT_NCDC_Compliance_Report.md` (an automated audit, not a statute) and `docs/CA-VERIFICATION-2026-07.md` (an unanswered TDS/salary questionnaire, not a source for any register). `src/lib/rules/ucas.ts:11` states its own values are "[NV per state]".

## Entity types
Only Cooperative Societies are modelled. `SocietyType` (src/types/index.ts:1004) lists activity types (pacs, dairy, housing, ...), there is no legal-form field, and no "Registered Society" (Societies Registration Act / trust) concept anywhere (grep of src for "registered society" finds only GST wording). Statutory wording on Form 1, the application form and the auditor certificate is fixed to "Cooperative Societies Act" (src/pages/Form1MemberList.tsx:93, src/lib/pdf.ts:2386, src/lib/pdf.ts:204). Jurisdiction resolves only 'hr' by alias (src/lib/jurisdiction.ts:15-19). Audit formats exist for 9 states (src/lib/stateAuditFormats.ts:519-529); every other state silently gets the "Multi-State Cooperative Societies Act, 2002" label (stateAuditFormats.ts:506-515, 532-535).

Access control: routes are role-gated by the module catalog through CapabilityGuard (src/components/CapabilityGuard.tsx:21-43), e.g. loanInterest/auditSchedules/reserveFund/profitDistribution = admin|accountant, boardOfDirectors = admin (moduleCatalog.ts:162,171-174,178). Soft-deleted members/loans/assets/objections are filtered at load (DataContext.tsx:955,999-1001); vouchers are not, so each page must filter `isDeleted` itself (most do).

---
## Accounting / Data

### B-01 CRITICAL — KCC loan postings resolve to the wrong ledger account
Evidence: src/pages/KccLoan.tsx:98-100 and :163 use `accounts.find(a => a.id === '3313' || name includes 'kcc' || name includes 'crop loan')`. In every default chart (src/lib/storage.ts:212, 396, 696) account 2305 "KCC / Crop Loan (DCCB)" is a LIABILITY and appears before 3313 "Member Loan Interest Rec." (storage.ts:251), so `find` returns 2305. Disbursement is `Dr loanAccount / Cr 3301` (KccLoan.tsx:104-115); repayment credits the same account (:163-168).
Failure scenario: Society disburses KCC ₹50,000 to a member. The debit lands on the DCCB borrowing account (reducing a liability) instead of a member-loan asset. Balance Sheet understates both borrowings and loans; KCC register and GL disagree. If a society deletes 2305, the debit lands on the interest-receivable account instead.
Also in the same flow: the voucher error is swallowed (`catch { /* ignore voucher errors */ }`, :116) and the `kcc_loans` row is saved anyway (:142-146); if `loanAccount && cashAccount` is falsy the voucher is silently skipped (:102); there is no `society.fyLocked` check on disbursement (only repayment has it, :153); writes go straight to supabase (`kccLoanInsert`) bypassing DataContext audit/period-lock.
Fix: configure an explicit asset head for KCC loans (3303 "Short-term Loans (KCC)" exists in one template, storage.ts:418) or a society setting; abort the save and roll back the register row if the voucher is not created; route through a DataContext function with RULE 1/RULE 6 guards.
Test: default chart, disburse ₹50,000; assert debit account type is asset and balance of 2305 unchanged; repeat with period lock enabled and assert no register row is created.

### B-02 CRITICAL — Loan interest accrual: wrong day count, wrong base, overdue loans excluded, double-counted income
Evidence: src/pages/LoanInterest.tsx:
- `daysBetween` returns end minus start, not inclusive (:60-63), so a calendar month loses a day and an annual 1-Apr to 31-Mar run gets 364 days. 
- Interest uses today's outstanding (`loan.amount - loan.repaidAmount`, :145) for a past period and does not clamp to the disbursement or closure date (:143-158). Repayments inside the period are ignored.
- Only `status === 'active'` loans accrue (:112); "overdue" is a manual status (LoanRegister.tsx:92), so loans past due stop earning interest.
- The posted journal is one consolidated voucher with no `memberId` (:166-178), so interest receivable (3313) has no per-member trail.
- The duplicate guard is `v.narration.includes(fromDate)` (:123): a monthly run and then an annual run overlap and both post.
- No `society.fyLocked` check on the page (handlePost :166); success toast is shown regardless of what `addVoucher` returned (:180-185).
- Accrual is Dr 3313 / Cr 4408 (LoanInterest.tsx:36-37) but LoanRegister.recordRepayment credits interest received straight to 4408 (LoanRegister.tsx:132-135); nothing credits 3313 (grep "3313" finds only KccLoan, LoanInterest, storage, stateAuditFormats). Interest income is therefore booked twice and 3313 grows forever.
Failure scenario: loan ₹1,00,000 at 12%, 1-30 April: correct 30 days = ₹986.30; the page computes 29 days = ₹953.42. Member pays the interest in cash: income is credited once at accrual and again at receipt.
Fix: compute per loan on the day-balance between max(from, disbursement) and min(to, closure) inclusive; include overdue loans; post member-tagged lines; on repayment credit 3313 up to accrued interest; reject overlap by stored period key; add fyLocked and period-lock handling.
Test: 1-30 April loan above must produce 986.30; accrue then repay interest then assert 3313 = 0 and 4408 counted once; run monthly then annual and assert the second is refused.

### B-03 HIGH — False success: pages treat the blocked-voucher dummy as a posted voucher
Evidence: `addVoucher` never throws; on role denial, FY lock, expired plan or period lock it returns an object with `id: ''` (DataContext.tsx:1727-1757). Callers:
- LoanRegister.recordRepayment wraps it in try/catch and then always runs `updateLoan(repaidAmount...)` and shows "Repayment recorded & posted" (LoanRegister.tsx:136-145). Register says repaid, ledger has no receipt (RULE 1 divergence).
- KccLoan.handleRepayment does the same (KccLoan.tsx:152-190).
- ProfitDistribution.settleDividend counts `n++` per member regardless and toasts "Dividend paid to N members" (ProfitDistribution.tsx:163-172); handlePost and ReserveFund.handlePost toast "journal entries posted" without checking ids (ProfitDistribution.tsx:213-250, ReserveFund.tsx:125-145); LoanInterest.handlePost likewise.
This is the false-success-toast pattern already recorded for updateVoucher (#345).
Fix: check `v?.id` after every `addVoucher`; on empty id stop and do not mutate the register or toast success; make addVoucher return null or throw.
Test: set periodLockDate after the repayment date, record a repayment; assert loan.repaidAmount unchanged and no success toast.

### B-04 HIGH — Asset Register PDF uses a different book-value formula from the screen (RULE 2)
Evidence: src/lib/pdf.ts:1238-1246 `calcBookValue`: simple SLM by elapsed years to the last 31 March relative to today's date, ignoring `depreciationMethod` (WDV), `residualValue`, `depreciationPostedFY`, `disposalDate`. The screen uses `calcAccumDep` per method and society FY (AssetRegister.tsx:181-203). The PDF header hard-codes "Depreciation Method: SLM" (pdf.ts:1236). PDF totals include disposed assets (`assets` is passed unfiltered, AssetRegister.tsx:399), and the screen total does too (:233-235).
Failure scenario: WDV asset shows ₹X on screen and ₹Y in the printed register; Depreciation Schedule shows a third figure.
Fix: PDF must call the same lib/depreciation functions with society.financialYear; separate disposed assets; print the method per row.
Test: WDV 15% asset, bought 2023-24, FY 2025-26; PDF Book Value must equal screen Book Value and Depreciation Schedule closing.

### B-05 HIGH — Depreciation Schedule roll-forward does not tie after any disposal
Evidence: src/pages/DepreciationSchedule.tsx:102-104 deductions = cost of ALL assets with status 'disposed' (any year); opening WDV counts every asset purchased before FY start including ones disposed earlier (:128-131); depreciation is computed for `activeAssets` only (:122-125) so an asset disposed in the year gets no part-year depreciation; accumulated depreciation of disposals is never removed.
Failure scenario: asset disposed in FY1; FY2 schedule deducts its cost again (opening already included it) so closing WDV is wrong and cannot tie to the ledger.
Fix: deductions only where `disposalDate` falls in the FY and remove their accumulated depreciation; include part-year charge; add gross-block/accumulated columns.
Test: dispose an asset in FY1 then open the FY2 schedule; deductions must be 0.

### B-06 HIGH — Aging Analysis buckets and totals are wrong
Evidence: src/pages/AgingAnalysis.tsx:97-113 nets every voucher line into the bucket of its own date, so a receipt today is a negative amount in "0-30" while the old invoice stays in ">180"; no FIFO or bill-wise allocation. Sub-account `openingBalance` is never read (grep finds none), so totals differ from Trial Balance. `today` is a module-level constant (:44-45), stale after midnight in a long session. No as-on date control.
Failure scenario: customer invoice 100 at 120 days, paid 100 today: report shows 91-180 = 100 and 0-30 = -100 (total 0), hiding that the invoice was cleared and mis-stating overdue.
Fix: allocate credits to oldest debits (or use bill-wise settlement), include opening balance in the oldest bucket, add as-on date.
Test: scenario above must show all buckets zero; customer with opening balance 500 must show 500.

### B-07 MEDIUM — Bills Outstanding "as of" date only changes the age, not the balance
Evidence: src/pages/BillsOutstanding.tsx:39-41 calls `getOpenBills(sales, vouchers, c.id)`; billUtils.getOpenBills (src/lib/billUtils.ts:73-84) takes no as-of date and `getBillSettledMap(vouchers)` uses all vouchers.
Failure scenario: audit cut-off report as of 31 March still shows a bill as settled by a receipt posted in April.
Fix: pass asOf and ignore settlements after it. Test: receipt dated after asOf must not reduce the balance.

### B-08 MEDIUM — Budget vs Actual "actual" ignores debit/credit direction
Evidence: src/pages/BudgetModule.tsx:67-76 sums `l.amount` for each line regardless of `l.type`. Purchase returns (Cr 5101), expense refunds and sales returns add to the actual instead of subtracting.
Fix: use signed by side per account type. Test: post a purchase return; expense actual must fall.

### B-09 MEDIUM — Member share ledger drops the opening share-capital row once any share voucher exists
Evidence: src/contexts/DataContext.tsx:4824-4842: "If a proper voucher exists, start at 0 (voucher covers it)". A migrated member with scalar `shareCapital` 1000 and a later voucher of 500 shows 500 on the ledger/passbook (Members.tsx:991-1014) while the scalar says 1500. `getMemberShareReconciliation` exists (DataContext.tsx:4873) but the passbook PDF does not show it.
Fix: show an opening row for the uncovered difference or print the reconciliation. Test: member shareCapital 1000 with no vouchers, add one 500 voucher; ledger must end at 1500.

### B-10 MEDIUM — Two parallel share registers for housing
Evidence: housing stores shares/face value on the flat (types HousingFlat.shareCount/shareFaceValue, src/types/index.ts:238-244; src/pages/ShareNominationRegister.tsx:41-52; lib/pdf.ts:1072-1113) while the member-level Share Register uses `Member.shareCount/shareCapital` and the ledger control 1102. Nothing reconciles them; the flat register total (shares × face) is not tied to the ledger.
Fix: single source or a visible reconciliation row. Test: change flat shares to 10 with member capital 5000; totals should be flagged.

### B-11 MEDIUM — Locally computed document numbers repeat after deletion
Evidence: meeting number = same-type count in current calendar year + 1 (src/pages/MeetingRegister.tsx:56-62); election number = `elections.length + 1` (src/pages/ElectionModule.tsx:92); election id `elec_${Date.now()}` (:100). Voucher/loan numbers use the server sequence (DataContext.tsx:4893-4898), these pages do not (T-03 not applied).
Test: create 3 meetings, delete #2, add one: duplicate number.

### B-12 HIGH — Minute book entries are hard-deleted and bypass the audit trail
Evidence: `meetingDelete` → `supabase.from(table).delete()` (src/lib/supabaseService.ts:44-49, 84); MeetingRegister.tsx:182-189. KccLoan, Meeting, Election, Budget write directly through supabaseService from the page (no emitAudit, no FY/period lock, no maker-checker, no branch stamp). TASK2.3:104-109 treats the minute book as a statutory record.
Fix: soft-delete with audit event; move to DataContext functions with guards. Test: delete a meeting; row must remain with isDeleted and an audit log entry.

### B-13 LOW — 'SOC001' fallback society id in page-level writes
Evidence: `user?.societyId || 'SOC001'` at KccLoan.tsx:50, MeetingRegister.tsx:98, ElectionModule.tsx:70, BudgetModule.tsx:37 (and DataContext.tsx:353,877). Routes require authentication, so this is reachable only if societyId is missing; RLS is UNVERIFIED for these tables from this slice.
Fix: fail closed when societyId is absent. Test: user without societyId must not write.

### B-14 MEDIUM — Registers are not branch-aware
Evidence: only Members.tsx uses `matchesActiveBranch` (Members.tsx:348); none of the other slice pages reference branch (grep counts 0). ShareRegister, Form1, LoanRegister, Deposits, AssetRegister use the full `members/loans/assets` arrays. Server-side branch RLS exists per project notes (ECR-17) — UNVERIFIED from this slice whether it covers every table used here.
Fix: apply the same branch scope as the ledger reports, or state that registers are society-wide. Test: restricted-branch user opens Share Register; only own-branch members.

---
## Statutory

### B-15 CRITICAL — Profit Distribution has two parallel appropriation paths; the legacy one is ungated
Evidence: src/pages/ProfitDistribution.tsx:210 comment "Appropriations (reserve/education) are OPTIONAL — never block dividend/bonus"; `canPost` ignores the statutory reserve (:211); no use of `ucasDividendCapPct` anywhere outside ucas.ts/appropriation.ts (grep); vouchers are dated `today` (:225-235); duplicates detected by narration text (`narration.includes(fy)`, :68-70). The new StatutoryAppropriationPanel (:367) calls `addStatutoryAppropriation`, which requires a feature flag, permission, period lock, an AGM authority attestation and a refusal on cap breach (DataContext.tsx:5668-5700) with education 5% and dividend cap 15% (lib/rules/ucas.ts:30-35). The legacy path uses education 1% (lib/appropriation.ts:45, ReserveFund.tsx:35, stateAuditFormats.ts:176). `AUDIT_NCDC_Compliance_Report.md:187` lists a "Section 65 gate blocks dividend" as a strength; that gate does not exist in the page code.
Failure scenario: an accountant posts a 30% dividend with no reserve and no AGM resolution; the same surplus can later be appropriated again through the statutory panel.
Also: dividend is on the current `shareCapital` (:116) not time-weighted; the settlement split is recomputed from current capital with per-member rounding that need not sum to the posted dividend (:151-157); `dividend_cap_pct` 15, `reserve` 25, `education` 5 are national defaults explicitly "[NV per state]" (ucas.ts:11,32-35): EXTERNAL VALIDATION NEEDED.
Fix: when `society.statutoryAppropriation` is on, disable the legacy post buttons; always require reserve before dividend; freeze member amounts at posting; date at AGM/FY-end; verify percentages against each State Act.
Test: net surplus ₹1,00,000; post dividend 20% with zero reserve; expect refusal. Post via legacy then statutory; expect refusal of second.

### B-16 HIGH — Reserve Fund page treats the statutory reserve as optional and dates postings "today"
Evidence: src/pages/ReserveFund.tsx:123,129 date = today; banner text "entirely optional" (:150-160); one journal per fund (non-atomic, :125-145); only a warning if `reservePct < 25` (:192). Appropriation of FY 2025-26 posted in April 2026 falls into the next FY books.
Fix: FY-end date or user-chosen AGM date within the FY; block distribution until reserve posted. Test: post in a later FY; voucher date must be within the appropriated FY.

### B-17 HIGH — Form 1 Register of Members omits cessation data and mislabels ex-members
Evidence: src/pages/Form1MemberList.tsx:35-46: status filter only `all|active|inactive`; `MemberStatus` has five values (src/types/index.ts:22) so resigned/expelled/deceased members appear as "Inactive" (:74, :127) and are hidden by the default 'active' filter; `statusChangedAt/statusReason` (types :194-195) are not exported; no occupation, age, nominee address, or additional nominees. Source: TASK2.3:46 cites Form I of the Maharashtra rules [NV per state]; the "Form 1" caption (Form1MemberList.tsx:91) has no source for other states.
Fix: show true status plus cessation date/reason; default to all-statuses register; add the missing columns; confirm the prescribed form per state. Test: create one member in each status; export "All"; every status and date must appear.

### B-18 HIGH — Share Register PDF is passed all members, screen uses approved members
Evidence: ShareRegister.tsx:35 (approved only) vs :132 `generateShareRegisterPDF(members, society)`; PDF prints "Certified that the above is a true and correct Register of Members and Share Capital" (lib/pdf.ts:1014-1019). Pending and rejected applicants and ceased members are printed, and total capital differs from the screen total. Status shown as Active/Inactive only (pdf.ts:973).
Fix: pass the filtered set and print true status. Test: pending member with capital 1000: PDF total must equal screen total.

### B-19 HIGH — Nomination Register shows only the legacy single nominee and ignores filters on export
Evidence: NominationRegister.tsx:46 (active members only), exports use `activeMembers` regardless of search/with/without (:93, :120); save writes only `nomineeName/Relation/Phone` (:81-85) although Members.tsx:449-505 stores `nominees[]` (share %); no register or PDF reads `nominees[]` (grep of pages for "nominees" finds only Members.tsx). Inactive/deceased members' nominations (the moment they matter) are excluded.
Fix: render/edit `nominees[]`; export the filtered view; include deceased/inactive members. Test: member with two nominees 60/40 appears with both.

### B-20 HIGH — Audit Schedules: statutory content unsourced, state fallback wrong, fund percentages inconsistent
Evidence: Act names, section ranges and form numbers ("Sec 63-68", "Form-S", "Form 6-A", "Form-14", "Sec 65(2)") appear only as code comments/notes (stateAuditFormats.ts:213-216,228-236,372-440); no document in the repo cites them: EXTERNAL VALIDATION NEEDED. Nine states are configured but eight of them reuse the Haryana schedules (stateAuditFormats.ts:374-498 `schedules: HARYANA_SCHEDULES`); the 36-entry state list (constants.ts:17-62) means most states get the generic Multi-State Act label. The page defaults `getStateAuditFormat(society.state)` (AuditSchedules.tsx:190) while the PDF auditor certificate defaults to `'hr'` (pdf.ts:200): the same society can be certified under two Acts. Computed rows use fixed 1%/3% for education/co-op development (stateAuditFormats.ts:176-177) while the PDF cover prints `format.educationFundPct` (Kerala 5, Gujarat 2; pdf.ts:2236-2240). The PDF ignores `specialRenderer` (depreciation, trading), so Schedule IV and X print as plain lists unlike the screen (pdf.ts:2199-2310 vs AuditSchedules.tsx:260). Account IDs are hard-coded, so custom or merged heads fall outside the schedules; previous-year values are summed without the credit-side sign flip used for the current year (stateAuditFormats.ts:98-123 vs 138-170).
Fix: obtain each state's prescribed schedules and cite them; derive computed funds from the format; one default; warn for unmapped states. Test: society with state Tamil Nadu: PDF must warn that no state format is configured.

### B-21 HIGH — Audit Rectification Register blocked by FY audit-lock and truncated in print
Evidence: `addAuditObjection/updateAuditObjection/deleteAuditObjection` call `guardFYLocked()` (DataContext.tsx:2601,2631,2647). Audit objections arise after the year is closed/locked, which is when the lock is on; the `auditNote` permission (rbac.ts:55-57) is not used to bypass it. PDF cuts objection text at 60 characters and action taken at 40 (lib/pdf.ts:1304-1309), and omits `remarks`; `doc.setTextColor` set in `didDrawCell` is never reset (pdf.ts:1324-1336). Statutory source: TASK2.3:110.
Fix: permit auditNote writes under FY lock; wrap full text. Test: lock FY, add objection as auditor: allowed; long text prints in full.

### B-22 HIGH — Loan Register lacks overdue/NPA derivation and key columns; no deposit register output
Evidence: Loan.status is a manual dropdown ('active'|'cleared'|'overdue', LoanRegister.tsx:88-92; types :576-578 (LoanStatus)); PDF omits security, guarantors, interest outstanding, NPA class (pdf.ts:1185-1232); PDF unknown member prints the raw id (:1189). TASK2.3:57-58 expects NPA and DCB; none exists. Deposits page has no register/passbook/FD receipt output and interest posting computes no TDS (DataContext.tsx:3227-3270) although a 194A threshold rule exists (lib/rules/tax.ts:268-274).
Fix: derive overdue days and NPA stage from dueDate/repayments; add DCB view; apply 194A at deposit interest posting. Test: loan with dueDate 200 days ago and no repayment is shown overdue/NPA.

### B-23 HIGH — Compliance Calendar dates are unsourced and incomplete
Evidence: src/lib/complianceCalendar.ts:60-103 hard-codes EPF/ESI 15th, TDS 7th (30 April for March), GSTR-1 11th, GSTR-3B 20th, 24Q quarterly, ITR 31 Oct, "Cooperative statutory audit" 30 Sep. No source in the repo (CA-VERIFICATION-2026-07.md is a blank questionnaire). GST assumed monthly (no QRMP), no weekend/holiday shift, 24Q shown whenever a TAN exists, no 26Q, advance tax, GSTR-9, Form 16/16A, AGM, Registrar annual return. EXTERNAL VALIDATION NEEDED.
Fix: move dates into the dated rule catalog (lib/rules) with source and effective-from. Test: QRMP society must see quarterly GST dates.

### B-24 MEDIUM — Unsourced numeric defaults printed or used in statutory output
Depreciation rate master "commonly-used ... defaults" (depreciationRateMaster.ts:1-9; Computer 40% is an Income-tax WDV rate used as SLM); housing arrears interest 21% default (OutstandingRegister.tsx:31); UCAS national defaults (ucas.ts:11). All EXTERNAL VALIDATION NEEDED.

### B-25 MEDIUM — Registered Societies are not supported
See Entity types. No legal-form field; Income and Expenditure/Receipts and Payments for non-cooperative societies and trust variants are absent. Statutory wording is cooperative-only. Fix: add a legalForm setting and swap labels, or document scope. Test: society type 'other' prints a cooperative Act on the certificate.

### B-26 MEDIUM — Election and Board records are weak statutory evidence
Election status is computed only when the election is created and never refreshed (ElectionModule.tsx:100-104); votes are typed in; no voter roll or returning officer. Board members live as JSON in society settings and can be hard-removed (BoardOfDirectors.tsx:112-118); an expired term does not stop a person printing as signatory (addSignatureBlock/getSignatoryNames, pdf.ts:110-176). Source: EXTERNAL VALIDATION NEEDED.

### B-27 INFORMATIONAL — HAFED Annual Review proforma generators are dead code
src/lib/annualReview/p1Pdf.ts..p9Pdf.ts have no importer; the report page was deleted (git 4c259a9 "remove: HAFED Annual Review Report (Proforma 1-9) page", leftovers removal 4830ce1). Claim "matches Haryana HAFED format exactly" (p1Pdf.ts:2) is unverified.

---
## Print / PDF

### B-28 HIGH — Devanagari is unreadable in every PDF
Evidence: `setupFont` always returns 'helvetica' (src/lib/pdf.ts:24-27); `preloadHindiFont` fetches NotoSansDevanagari from a CDN at app start (App.tsx:220, fontLoader.ts:1-39) but nothing ever calls `addFont`/`getHindiFont` (grep). Member names, addresses, narrations and board names in Hindi print garbled in Form 1, Share Register, Passbook, Loan Register, Nomination Register, meeting resolutions. The CDN download is wasted on every page load. sampleReport.ts:5 documents the limitation.
Fix: embed a Devanagari TTF via `doc.addFont` and use it when text contains Devanagari. Test: member "रामकुमार" in Form 1 PDF must be legible.

### B-29 MEDIUM — Text truncated in statutory registers
Audit register (60/40 chars, pdf.ts:1304-1309) and meeting resolutions (60 chars, MeetingRegister.tsx:224); minutes are not printed at all in the PDF (only on screen). Fix: wrap full text, add continuation. Test: 300-character resolution prints in full.

### B-30 MEDIUM — Almost no Print button; Form 1 print layout is orphaned
Only AdvanceRegister (window.print, AdvanceRegister.tsx:8-45) and GuideCertificate have print. Form1MemberList has `print:` CSS and a hidden print header (Form1MemberList.tsx:186-205) but no button. The shared PDF footer adds "Generated free with SahakarLekha · sahakarlekha.com" to statutory register printouts (pdf.ts:101).

### B-31 LOW — Header/date inconsistencies
Form 1 builds a custom header with no Report ID (Form1MemberList.tsx:90-110); Asset Register "As on" is today's date, not FY end (pdf.ts:1236); signatures: Form 1 labels "Registrar / Auditor" as a signatory (:148, :310); AdvanceRegister prints only society name (no reg no/FY).

---
## Export

### B-32 MEDIUM — Exports ignore on-screen filters
NominationRegister (all three formats use activeMembers, :93,:120), LoanRegister PDF (all loans, :268), ShareRegister PDF (all members, :132), AssetRegister PDF (:399), AuditRegister PDF (:219). Fix: export the filtered list or label the export "all records". Test: filter to 'overdue'; PDF must contain only overdue.

### B-33 MEDIUM — CSV formula injection
`buildCsv` quotes fields but does not neutralise leading = + - @ (src/lib/exportUtils.ts:50-60 area, `buildCsv` ~lines 61-66). Member names, nominees, narrations are user data exported by every CSV above. Fix: prefix such cells with an apostrophe or tab. Test: member name "=HYPERLINK(...)" exports inert.

### B-34 LOW — Export filenames and README
CSV/XLSX filenames have no society or FY (e.g. 'form1-member-list', 'nomination-register', 'loan-interest'); `downloadExcelSingle` is called without meta so no README sheet (Form1MemberList.tsx:88-89). Exported CSV for LoanInterest drops loan no and member id that the PDF carries (LoanInterest.tsx:187-191). Audit Schedules CSV/Excel put CY before PY while screen and PDF show PY first (AuditSchedules.tsx:226-232 vs :40-52).

---
## Security
B-33 (CSV injection), B-13 ('SOC001' fallback), B-12 (page-level writes without audit) above. B-35 LOW: Guide certificate numbers are FNV-1a over name+date with a public namespace (guideCertId.ts:10-40), so anyone can mint a "valid" certificate; the file itself says it detects typos not forgery (INFORMATIONAL).

## UX
B-36 LOW: Compliance Calendar sits under Reports (moduleCatalog.ts:133); Member Statement, Outstanding Register, Fund Statement, Complaints, Transfer Register exist only under the housing capability so a PACS has no member-wise statement. Advance Register page text calls itself a statutory register (AdvanceRegister.tsx:31 area) without a source; election status never refreshes (B-26).

## Missing reports
See B_gaps.md.


---

## C — Trade, tax, payroll, domain


Read-only audit. Every cite is a file:line I opened. "EXTERNAL VALIDATION NEEDED" = the statutory source (CGST Rules, GSTN/NSDL/EPFO/ESIC schemas, labour forms) is NOT in the repo; only docs found were docs/CA-VERIFICATION-2026-07.md (an unanswered CA questionnaire, not a statutory source), docs/research/TASK2.6-COOP-TAX-STATUTORY-COMPLIANCE.md (summary table, no schemas) and AUDIT_NCDC_Compliance_Report.md.

## Entity-type support (cooperative vs registered society)
- Code models ONLY cooperative society types: `SocietyType = 'marketing_processing' | 'pacs' | 'consumer' | 'labour' | 'dairy' | 'housing' | 'sugar' | 'producer' | 'multistate' | 'multipurpose' | 'other'` (src/types/index.ts:1004). Grep for "Registered Society" / "Societies Registration" finds nothing about legal form; the word "registered" in code means GST-registered (lib/consumer/posGst.ts:13, lib/navigation/capabilities.ts:84).
- There is no Registered-Society (Societies Registration Act) mode, bye-law set, or report variant. A Registered Society must use `other` and gets cooperative wording on all reports (Auditor certificate wording uses state cooperative Act via stateAuditFormats: pdf.ts:204).
- Capabilities gate reports per society (moduleCatalog.ts:59-185): `gst`, `tds`, `inventory_sales`, `pf_esi`, `labour`, `dairy_collection`, `pos_billing`, `procurement_msp`, `haryana_compliance`, `housing`. Route enforcement is presentation-layer only (CapabilityGuard.tsx header comment). Reports in the `reports` domain carry no `requiredRoles` (moduleCatalog.ts:138-153), so any role that can see the sidebar group can open GST/TDS/stock reports.

---
## A. ACCOUNTING / DATA

### C-01 — HIGH — Stock Valuation FIFO/WA selector is dead; PDF can print "Method: FIFO" over Weighted-Average values
- Evidence: StockValuation.tsx:83 (`method` state), :100 and :106 (value always `computeStockValue`, `method: 'WA'`), :148 (PDF subtitle reads `method`), :118 (comment says table "can use FIFO/WA per item" — it cannot).
- Scenario: Accountant picks FIFO for the auditor, downloads PDF: header says FIFO, numbers are WA. Audit evidence is mislabelled.
- Fix: remove selector or implement FIFO with the canonical qty (lib/stockUtils.ts:104 computeStockValue). Test: switch to FIFO on an item with two purchase rates -> value must differ or control must be disabled.

### C-02 — MEDIUM — Inventory total includes inactive items; every other stock report excludes them (RULE 2)
- Evidence: Inventory.tsx:617-620 sums `stockItems` (all) vs StockValuation.tsx:90 (`isActive`), ClosingStockReport.tsx:82, DataContext.tsx:5427 (`filter(s => s.isActive)`).
- Scenario: deactivate an item with stock: Inventory shows total X, Stock Valuation/Trading A/c show X minus item.
- Fix: one `activeStockValue` helper; test parity across Inventory/StockValuation/ClosingStock/Trading A/c.

### C-03 — MEDIUM — Closing Stock Report cannot reconcile once prior-FY movements exist; sale value mixed with cost
- Evidence: ClosingStockReport.tsx:100-102 (opening = `item.openingStock` × `purchaseRate`), :83 (flows limited to FY), :107-110 (closing = whole history <= FY end), :93 (flow value = `|m.amount|`, which stockUtils.ts:95 says is unreliable on imported movements). Sale column is selling amount, others cost.
- Scenario: FY 2026-27 report for an item bought and sold in 2025-26: Opening + flows != Closing; sale value at selling price breaks value identity printed in the info note (:358).
- Fix: derive FY-opening from history before FY start; value sales at WA cost; test identity for each item.

### C-04 — MEDIUM — Godown stock ignores opening stock and reconciliation
- Evidence: Godowns.tsx:91 `computeGodownStock(stockMovements)`; godownStock.ts:39 signature takes movements only; stockUtils.ts:25-28 NOTE admits per-godown views read raw movements.
- Scenario: godown totals do not sum to Inventory quantity (opening stock not in any godown; drifted/orphan movements counted).
- Fix: assign opening stock to an "Unassigned" godown row and show a reconciliation line vs computeStock. Test: sum(godown) == Inventory qty.

### C-05 — HIGH — Consumer Outstanding Register omits credit-adjusted returns; disagrees with Member Credit screen
- Evidence: registers.ts:74,76 call `memberOutstanding`/`memberAgeing` without the `returns` arg (credit.ts:53-57 default `[]`); ConsumerDataContext.tsx:244,248 pass `activeReturns`. `asOf` (ConsumerRegisters.tsx:35) only affects ageing, not balances.
- Scenario: Member buys Rs 1,000 on credit, returns Rs 400 adjusted to credit: Member Credit shows 600, Consumer Registers (and its CSV) shows 1,000 — demand sent for money not owed.
- Fix: pass returns; filter sales/recoveries by `asOf`. Test as above.

### C-06 — MEDIUM — Counter Z-report overstates sales and mis-buckets unknown tenders
- Evidence: registers.ts:18-37 sums all `sales` (not counter-only, not net of returns); unknown `paymentMode` falls into cash (registers.ts:30).
- Fix: filter to POS sales, net sales returns, show "other". Test: return after sale reduces Z total.

### C-07 — MEDIUM — Procurement registers count rejected lots and use system timestamp as date
- Evidence: registers.ts:31-45 (date = `createdAt`, no status filter), :52-64 commodity summary over all lots; OperationalStatus includes `'rejected'` (procurement/entities.ts:8-10).
- Scenario: rejected lot (not accepted) still adds qty/value to Procurement Register and Commodity Summary.
- Fix: exclude or separate `rejected`; use arrival/weighment date. Test: reject a lot -> totals fall.

### C-08 — MEDIUM — Dairy settlement number derived from count (duplicates possible)
- Evidence: DairyDataContext.tsx:408 `'DS/' + (approved && !deleted count + 1)`.
- Scenario: approve DS/0001, DS/0002; delete DS/0001; next approval = DS/0002 (duplicate on a farmer payment document).
- Fix: use next_document_number RPC (T-03). Test: delete-then-approve yields unique number.

### C-09 — LOW — Work Order Profit overstated; wage formula copy-pasted with float math
- Evidence: WorkOrderProfit.tsx:26 profit = billed − wage only; `days × dailyWage` repeated in WorkOrderProfit.tsx:23, WorkerLedger.tsx:22, WageRegister.tsx:40,109, WageSlip.tsx:33, MusterRoll.tsx:78 with `+(x).toFixed(2)` float rounding, not money.ts (T-02).
- Fix: shared `wageOf` on money.ts; include employer PF/ESI in cost.

### C-10 — MEDIUM — Wage Slip deductions are recomputed with DEFAULT rates, not the posted PF/ESI run
- Evidence: WageSlip.tsx:35 `computePfEsi(period, PF_ESI_DEFAULTS)`; PfEsi.tsx:28,29 lets the user edit rates and posts a run with those.
- Scenario: user posts a run with a changed ceiling; slip shows different EPF/ESI than the voucher (RULE 2).
- Fix: read the posted run's per-worker values.

---
## B. STATUTORY

### C-11 — CRITICAL — GSTR-1 JSON: place of supply is hard-coded 09 (Uttar Pradesh) for every society
- Evidence: GstSummary.tsx:90 `(society as {stateCode?}).stateCode || '09'`, :469 (`pos` of every B2B invoice), :518 (CDNR). `stateCode` is not a field anywhere in src (grep: only GstSummary and unrelated stateAuditFormats.ts:49). lib/gstStates.ts:22-37 already has `stateCodeFromGstin/resolveStateCode` (used by EWayBill.tsx:16,126) but GstSummary does not use it.
- Scenario: Haryana society uploads GSTR-1 JSON; every invoice carries pos 09 -> wrong POS, wrong IGST/CGST characterisation at portal. Schema itself: EXTERNAL VALIDATION NEEDED.
- Fix: pos from buyer GSTIN/state per invoice (supplier state from society.gstin). Test: Haryana->Haryana B2B must emit pos "06".

### C-12 — CRITICAL — GSTR-1 HSN summary is empty (all "N/A") and B2B classification misses customers who have `gstin`
- Evidence: GstSummary.tsx:243 reads `(item as any).hsnCode` from SALE items; `SaleItem` has no hsnCode (types/index.ts:1288-1295) and SaleManagement saves none (hsn is looked up from stockItems only for the PDF: SaleManagement.tsx:356). Returned items do look up stockItems (GstSummary.tsx:111) so the two halves disagree. B2B test uses `cust?.gstNo` only (:100,:203,:457) although Customer has primary `gstin` and `gstNo` as "legacy alias" (types/index.ts:1692-1693); invoice code uses `gstin || gstNo` (SaleManagement.tsx:338).
- Scenario: customer entered with `gstin` only -> invoice goes to B2CS (no ctin), HSN rows all "N/A" (:498 sets hsn_sc '' ) — return fails HSN validation.
- Fix: resolve hsn via stockItems; use `gstin || gstNo`. Test: sale of HSN 3102 item -> HSN row 3102.

### C-13 — HIGH — GSTR-1/3B JSON period is the month of the FROM date even for a whole-FY range; date format and fixed placeholders
- Evidence: GstSummary.tsx:351 and :451 (`fp`/`ret_period` from `fromDate`); default range is the FY (fyBounds, :36-38); `idt: s.date` ISO (:467), `hash: 'hash'` (:530), `version: 'GST3.0.4'` (:529), B2CS `sply_ty: 'INTRA'` for all rates incl. IGST (:486), HSN `val` = taxable value (:502), no HSN rate column. Schema: EXTERNAL VALIDATION NEEDED.
- Scenario: default Export of the FY files April under ret_period 042026 with 12 months of totals.
- Fix: force single-month range for export; dd-mm-yyyy dates; INTER/INTRA by POS.

### C-14 — HIGH — GSTR-1 has no B2CL, nil/exempt/non-GST, document-issued, RCM sections; GSTR-3B 3.1(d) RCM is zero
- Evidence: payload keys only b2b/b2cs/cdnr/hsn (GstSummary.tsx:528-537); 3B `isup_rev` all zero (:356) while GSTR9.tsx:57 computes RCM via lib/rcm.ts; ITC `OTH` = all purchases (:361-365) with no blocked-credit / unregistered-supplier flag.
- Fix: add sections; per-purchase ITC eligibility. Statutory content: EXTERNAL VALIDATION NEEDED.

### C-15 — CRITICAL — Form 26Q export includes salary (s.192) entries and uses a home-grown, unvalidated file layout
- Evidence: TdsRegister.tsx:211 merges `salaryTdsEntries` into `allEntries`; :214 `quarterEntries`; :307-324 export passes `quarterEntries`; TDS on salary belongs to 24Q (form24Q.ts:2-3). tds26q.ts:60-67 pipe-delimited FH/BH/CH/DD records with `'SahakarLekha v1.0'` as utility name, `society.state.toUpperCase()` as "State code" (:76), undeposited entries emitted as a fake challan BSR `0000000` date `00000000` (:123-124), 194I mapped to `'4IB'` only (:22). No NSDL RPU/FVU spec in repo -> EXTERNAL VALIDATION NEEDED; expect FVU rejection.
- Scenario: Q1 with salary TDS: 26Q file contains section-192 deductee rows (wrong form); upload rejected or mis-filed.
- Fix: exclude 192; generate per NSDL spec and validate through FVU; test: salary + purchase entries -> 26Q holds only purchase rows.

### C-16 — HIGH — TDS entries default to section 194Q, PAN source misses supplier PAN, and sections are 1961-Act for FY 2026-27
- Evidence: TdsRegister.tsx:143 (`section: '194Q'` for every purchase TDS, `deducteeType 'firm'` :141), :140 `panFromGstin(supplier?.gstNo)` (not `gstin`, not supplier PAN), :146 `tdsRate: p.tdsPct || 0.1`. PurchaseManagement.tsx:742 TDS% is a typed number (max 30) with no threshold: lib/tax/computeTds.ts exists but nothing imports it (grep). TdsRegister.tsx:329-338 itself says the file carries repealed 1961 numbers for FY 2026-27 (Act 2025 in force 1-4-2026 per docs/CA-VERIFICATION-2026-07.md:7-12), and the CA questionnaire is unanswered in the repo.
- Fix: carry the supplier's real section; PAN from supplier.pan with fallback; use the rules engine; section-mapping per tdsSections.ts once CA-verified.

### C-17 — HIGH — "Form 16A" is a society-generated supplier statement, not the statutory certificate
- Evidence: TdsForm16A.tsx:99-165 prints summary/per-supplier PDF titled "TDS Form 16A" citing "Section 203 of Income Tax Act, 1961" (:111). No certificate number, quarter, section, deductee PAN, challan BSR/date, TRACES signature. Deductor PAN/TAN are blank inputs (:44-45) even though society.tan/entityPan exist (pdf.ts addHeader prints them). FY list stops at 2025-26 (:204) — FY 2026-27 (current) cannot be chosen. Source only purchase TDS (:52-66), so Register (salary/manual entries) and 16A disagree (RULE 2). Form 16A authenticity = TRACES: EXTERNAL VALIDATION NEEDED.
- Fix: rename "TDS statement" or integrate TRACES; add FY 2026-27; same dataset as Register.

### C-18 — HIGH — Sale invoice supports one GST rate per invoice and misprints Bill-of-Supply when tax was charged
- Evidence: invoice-level `cgstPct/sgstPct/igstPct` (types/index.ts:1308; invoiceTotals.ts); PDF table has HSN but no per-line rate/tax (pdf.ts:2700-2712); `isTaxInvoice = GSTIN && taxAmount > 0` (pdf.ts:2540); if the society has no GSTIN and the invoice carries tax, tax rows are hidden but Grand Total includes tax and the footer says "no tax is chargeable" (pdf.ts:2912). "Original for Recipient" hard-coded (:2557); seller state printed as raw code e.g. "hr" (:2572). Rule 46 content: EXTERNAL VALIDATION NEEDED.
- Fix: per-line tax rate and rate-wise tax table; block tax without GSTIN.

### C-19 — MEDIUM — GSTR-9 is a headline worksheet, not the GSTR-9 table structure; returns not branch-scoped
- Evidence: gstr9.ts:77-80 maps Table 7 to "ITC reversed (debit notes)"; GSTR9.tsx:39-40 filters sales/purchases by branch but passes unfiltered `salesReturns/purchaseReturns` (:49-50); `r2` float rounding (gstr9.ts:13); ITC availed = all purchases (:101); disclaimer in gstExport.ts:36 and GSTR9.tsx footer admit simplification. Schema/applicability: EXTERNAL VALIDATION NEEDED.
- Scenario: Branch B selected: GSTR-9 outward nets branch-B sales against ALL-branch credit notes.
- Fix: apply `matchesActiveBranch` to returns; rename the page "GST annual consolidation".

### C-20 — MEDIUM — E-Way Bill JSON: fabricated HSN, non-NIC date format, inward bill uses our number, silent save failure
- Evidence: EWayBill.tsx:131 HSN fallback `'9999'`; :157 `docDate: s.date` ISO; :145 pincode fallback `'000000'`; :156 inward docNo = `purchaseNo` (our number, not supplier bill no); :203 save failure only `console.error` (RULE 1: user never told the record was not stored). Field names in itemList (`name,hsn,qty,unit,taxable,gstRate`, :127-135) differ from the NIC bulk-upload names as I recall them — UNVERIFIED, schema not in repo.
- Fix: block when HSN missing; supplier bill no for inward; toast on save failure.

### C-21 — MEDIUM — PF ECR / ESI files: NCP days always 0; rates hard-coded; statutory formats unverified
- Evidence: PfEsi.tsx:87 emits `, 0, 0` for NCP days/refund although `daysOf()` (:78-80) exists; ESI file omits reason code/last working day (:97-103, UNVERIFIED vs ESIC template); PF ceiling/ESI threshold constants (payrollStatutory.ts:15-16) and editable rates not persisted (PfEsi.tsx:28). EPFO/ESIC specs: EXTERNAL VALIDATION NEEDED. Labour-code transition status: EXTERNAL VALIDATION NEEDED.
- Fix: derive NCP from muster; rules table with citation.

### C-22 — MEDIUM — Salary slip hides statutory breakup; 24Q worksheet limited to legacy payroll and basic+allowances
- Evidence: pdf.ts:1674 single "Deductions" line though SalaryRecord stores pf/esi/pt/tds (types/index.ts:1768-1773); form24Q.ts:46 gross = basic+allowances; build24Q reads `salaryRecords` only (SalaryManagement.tsx:288) while the new Payroll engine (Payroll.tsx) never feeds TdsRegister/24Q (TdsRegister.tsx:169-171 reads `salaryRecords` only).
- Fix: print breakup; merge new payroll TDS into register.

### C-23 — INFORMATIONAL — Income-tax slab data for FY 2026-27 is marked verified; section mapping is not
- Evidence: rules/incomeTax.ts:131-141 (`verified: true`, CA confirmation 2026-07-16), :46-66 FY2024-25 `verified:false`; rules/tdsSections.ts:25,121 (every 2025 mapping `verified:false`). No statutory text is in the repo; "verified" there is ownership by the founder/CA, per the file's own note (incomeTax.ts:129). EXTERNAL VALIDATION NEEDED remains.

### C-24 — MEDIUM — HAFED Proforma 8 (Kachi Aarat) PDF generator is orphaned
- Evidence: generateP8PDF exported at lib/annualReview/p8Pdf.ts:15; no importer in src (grep); KachiAaratRegister.tsx offers only the generic export (:172). Source for the proforma: none public (AUDIT_NCDC_Compliance_Report.md:64) -> EXTERNAL VALIDATION NEEDED.

---
## C. SECURITY / PRIVACY
### C-25 — LOW — Hindi font is fetched from a third-party CDN at every app start but never used by any PDF
- Evidence: App.tsx:220 `preloadHindiFont()`; fontLoader.ts:4-5 fetches from cdn.jsdelivr.net; pdf.ts:26 `setupFont` always returns 'helvetica'; grep shows `getHindiFont` unused outside fontLoader. Needless third-party request (privacy/perf) with no benefit.

### C-26 — LOW — PDF footers/brand lines on legal documents
- Evidence: addPageNumbers prints "Generated free with SahakarLekha . sahakarlekha.com" link on every report (pdf.ts:101); invoices print "Generated by SahakarLekha.com" (pdf.ts:2945). Not a leak, but marketing text on statutory documents (invoice, register) the society signs.

### C-27 — INFORMATIONAL — Statutory report access is nav-gated only
- Evidence: moduleCatalog.ts:143-153 GST/TDS/stock reports have capability gates but no `requiredRoles`; CapabilityGuard.tsx header: "presentation-layer enforcement". Server-side RLS is the real control (outside this slice).

---
## D. PRINT / PDF
### C-28 — HIGH — All jsPDF documents are English-only; Devanagari party/item/employee names garble
- Evidence: pdf.ts:26 (`setupFont` returns helvetica; comment at :24 "All PDFs use English only"), slip.ts:3-4 states helvetica lacks Hindi glyphs. Affects invoices (pdf.ts:2532), purchase record, registers, closing stock, salary slip, maintenance bill, 16A. Hindi-first users (RULE 7) with Hindi master names get blank/garbled cells in statutory prints. Only HTML-print documents (Payroll payslip, milk slip, WHR) render Hindi.
- Fix: embed a Devanagari TTF (fontLoader exists) or route to HTML print.

### C-29 — LOW — Maintenance receipt prints "Rs. Rs."
- Evidence: pdf.ts:1169,1173 `Rs. ${fmt(...)}` while `fmt` already returns "Rs. ..." (pdf.ts:14-15).

### C-30 — MEDIUM — Closing Stock PDF certifies "physical verification" for a book-derived statement
- Evidence: pdf.ts:2105 note; no physical count exists (AUDIT_NCDC_Compliance_Report.md:161 "No physical-count vs book reconciliation UI").
- Fix: reword to "as per books" or add physical-count capture.

### C-31 — LOW — Print via CSS visibility hack; no print on main registers
- Evidence: WageRegister.tsx/WageSlip.tsx use `body * {visibility:hidden}` print CSS (hidden nodes still occupy layout, may leave blank leading pages — UNVERIFIED in browser). Sale/Purchase Register, Inventory, GST Summary, Stock Valuation, TDS Register have no print button (grep window.print: only CalculatorShell, AdvanceRegister, BarcodeLabels, Godowns, GuideCertificate, Payroll, WageRegister, WageSlip). PDF is the only print path.

---
## E. EXPORT
### C-32 — HIGH (systemic) — Double file extensions on many exports
- Evidence: `downloadCSV` appends ".csv" (exportUtils.ts:162) and `downloadExcel` appends ".xlsx" (:170) but callers pass names with extensions: Inventory.tsx:824,829; Customers.tsx:139,148; Suppliers.tsx:140,149; HsnMaster.tsx:136,142; SaleManagement.tsx:402,407; PurchaseManagement.tsx:423,428; SalaryManagement.tsx:292 (Form 24Q), :557,:563; GSTR9.tsx:79; ConsumerRegisters.tsx:45,50; Dividend.tsx:48; ExpiryDamage.tsx:85; Patronage.tsx:67 (+ other slices: Vouchers.tsx:526,535, LedgerHeads, OpeningBalances, UserManagement...). Result `inventory.csv.csv`, `GSTR9_..._to_....csv.csv`; Excel may refuse to associate. Fix in exportUtils: strip a trailing known extension. Test: downloadCSV(h,r,'a.csv') -> 'a.csv'.

### C-33 — MEDIUM — Exports that ignore on-screen filters
- Salary history (SalaryManagement.tsx:553-564 exports all records irrespective of month/employee/paid filters at :295-296,325); Form 16A CSV/XLSX ignore supplier filter (TdsForm16A.tsx:86-100); EntityExportButton exports the whole table by design (EntityExportButton.tsx:19-23) — Muster Roll, Dept Bills, Work Orders, Kachi Aarat, dairy pages export every row, not the month/work-order on screen; Dairy settlement register ignores from/to (DairyRegisters.tsx:25 vs :45).

### C-34 — MEDIUM — Register exports omit returns and statutory columns; CSV numbers as strings
- Sale/Purchase Register: returns shown on screen only (SaleRegister.tsx:71-80; exports :83-91); no GSTIN/POS/HSN/supplier bill no/TCS. GST Summary CSV/Stock Valuation use `.toFixed(2)` strings (GstSummary.tsx:328-332; StockValuation.tsx:72-83), so Excel treats them as text. GST Summary CSV exports Output slabs only, ITC omitted (GstSummary.tsx:337).

### C-35 — LOW — Sale/Purchase list exports are thin
- SaleManagement.tsx:399-407 exports 7 columns (no tax, GSTIN, grand total); Customers export omits address/PAN/outstanding (Customers.tsx:131-139).

---
## F. UX
### C-36 — LOW — On-screen claims overstate readiness
- SaleRegister.tsx:358 says the register "can be used for GSTR-1 filing"; GSTR-1 JSON labelled "NIC" (GstSummary.tsx:982); both lack required fields (C-11..C-14). GSTR9/gstExport carry honest disclaimers (gstExport.ts:36); GstSummary does not.

### C-37 — LOW — Delete handlers in TDS Register log Supabase failure to console only (RULE 1)
- TdsRegister.tsx:296-304: local state updated then `console.warn` on cloud failure; no rollback or toast.

---
## G. MISSING REPORTS
See C_gaps.md.


---

## D — Export infrastructure & security


Slice: src/lib/pdf.ts shared helpers, exportUtils.ts, src/lib/export/*, ExportCenter, EntityExportButton, print CSS. Security findings are detailed in D_security.md (D-S01..D-S11); generated-file evidence in D_visual_qa.md (VQ-01..VQ-11). Entity types: the export/PDF layer does not distinguish Cooperative vs Registered Society; header prints society.registrationNo only (pdf.ts:239). Registered Society support through this layer is UNVERIFIED.

## Export / Print / PDF

### D-01 HIGH - Devanagari renders as garbage in every PDF
Evidence: pdf.ts:24-27 (helvetica only, comment "All PDFs use English only"); fontLoader.ts getHindiFont has no consumer; render D_render_cashbook_hindi_p1.png. Scenario: Hindi society name, Hindi signatory names (society.signatories), narrations and party names print as spaced junk glyphs on statutory PDFs; contradicts RULE 7 Hindi-first. Fix: embed Noto Sans Devanagari via addFileToVFS and switch font when text contains U+0900-097F; use nameHi in the header. Test: generate with Hindi fixtures, pdftotext must return the original Devanagari.

### D-02 HIGH - Long society name clipped at both page edges
Evidence: pdf.ts:232-234, 95; D_render_cashbook_long10_p1.png. Scenario: real PACS names exceed 100 chars. Fix: splitTextToSize to page width and shift startY. Test: 150-char name, assert all text within 15 mm margins.

### D-03 MEDIUM - Fixed 28 mm amount columns wrap digits mid-number
Evidence: pdf.ts:338,385,896,948 and TB footer (pdf.ts ~455); D_render_cashbook_long10_p1.png. Fix: minCellWidth/smaller font for amount columns, or wrap=false with font shrink. Test: amount 12,34,56,789.00 must stay on one line.

### D-04 MEDIUM - fmt() prints "Rs. NaN"; negatives lack Dr/Cr
Evidence: pdf.ts:16-17; D_cashbook_nan PDF. Fix: coerce through money.ts, show 0.00 and log, use Dr/Cr or brackets. Test: fmt(NaN) never contains NaN.

### D-05 MEDIUM - Empty-dataset handling inconsistent
Evidence: addNoDataMessage used by few generators (pdf.ts:54, usage 3 incl. definition); Sale Register/Bank Book 0 rows render header-only table with totals and signatures (D_salereg_landscape_0rows PDF). Fix: guard every generator. Test: each generator with [] shows message.

### D-06 MEDIUM - Trial Balance tolerance of Re 1 and float arithmetic in pdf.ts
Evidence: pdf.ts:475 `< 1`; money.ts is not imported in pdf.ts (grep 0), totals are float reduces (pdf.ts:313-315). Violates T-02 paise-integer intent (CLAUDE.md RULE 2 spirit). Fix: compare in paise with 0 tolerance; sum via money.ts. Test: TB with 0.99 difference reports NOT balanced.

### D-07 MEDIUM - Auditor certificate pre-prints opinion and hardcodes "31st March"
Evidence: pdf.ts:199-205. Fix: draft-for-auditor wording or blank, date from FY end/asOn. EXTERNAL VALIDATION NEEDED for the prescribed wording.

### D-08 MEDIUM - Several PDFs bypass the shared header/footer
Evidence: grep of `from 'jspdf'` outside pdf.ts: BankReconciliation.tsx:236-281 (no reg no, FY, page numbers), BudgetModule.tsx, GstSummary.tsx:383,550 (GSTR-3B/GSTR-1 PDFs, no addHeader/page numbers), leadMagnets.ts, annualReview p1-p9 (page numbers but no addHeader). Fix: route through addHeader/addPageNumbers.

### D-09 MEDIUM - Print CSS does not hide app chrome; most reports have no print path
Evidence: index.css:264-290 only .no-print/.print-only; no `print` rule in src/components/layout/*; window.print appears in 9 files only (AdvanceRegister.tsx:36, WageRegister.tsx:74, WageSlip.tsx:74, CalculatorShell.tsx:193...). Per-page hacks (`body * {visibility:hidden}`) exist in 3 pages. Fix: global @media print hiding sidebar/header, @page A4, thead repeat.

### D-10 LOW - Footer advertises "Generated free with SahakarLekha" on all statutory PDFs
Evidence: pdf.ts:101. Pricing is paid-only (memory: pricing-tiers-locked), so wording is also inaccurate. Fix: make it a setting / remove from statutory documents.

### D-11 LOW - Filename collisions
Evidence: pdf.ts:44; Hindi names -> `CashBook___FY_2025-26.pdf`. Fix: shared safeFileName with transliteration and registration number suffix.

## Export

### D-12 HIGH - Export Center files are not FY/branch scoped but are labelled with the current FY
Evidence: ExportCenter.tsx:151,160-166; EntityExportButton.tsx:86; source.ts:131-149. Detailed in D-S04.

### D-13 HIGH - CSV formula injection (D-S01); D-14 HIGH - full-mode PII to viewer (D-S02)
See D_security.md.

### D-15 MEDIUM - XLSX builder throws on invalid/duplicate sheet names and oversize cells
Evidence: exportUtils.ts:112 (`name.slice(0,31)` only), D_gen_errors.txt. Fix: sanitise/dedupe/clip.

### D-16 MEDIUM - CSV/JSON exports carry no provenance
Evidence: ExportMeta README only for XLSX (exportUtils.ts:99-107, generator.ts:225-231); downloadCSV has no meta. A CSV on an auditor's desk cannot be tied to a society/FY/time. Fix: provenance header row or companion README.

### D-17 MEDIUM - Export audit coverage gap (D-S05)

## Accounting/Data
### D-18 INFORMATIONAL - Export soft-delete handling is correct
filterRows excludes isDeleted unless full/includeDeleted (generator.ts:147-153); `full` implies inclusion (documented). Report PDFs depend on callers for RULE 5 (pdf.ts has no isDeleted filtering except housing at line 1076) - UNVERIFIED per report in other slices.

## Statutory
### D-19 INFORMATIONAL - No statutory format is asserted by the export infra
Statutory conformance of individual PDFs is out of slice; nothing in src/lib/export claims it (registry `statutory` mode requires explicit columns, generator.ts:119-135). EXTERNAL VALIDATION NEEDED for any claim.

## UX
### D-20 LOW - Hindi font preload wastes a third-party request every load (D-S07).

## Missing reports
See D_gaps.md.

## Counts
HIGH 5 (D-01, D-02, D-12/D-S04 treated MEDIUM in security file, D-13, D-14), MEDIUM 11, LOW 4, INFO 2 in this file; plus D-S01..S11 (2 HIGH, 5 MEDIUM, 3 LOW, 1 INFO) and VQ-01..11 in the other fragments (overlapping).
