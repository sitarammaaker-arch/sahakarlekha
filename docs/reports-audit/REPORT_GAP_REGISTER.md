# Report Gap Register

Missing reports, fields, formats, print features and compliance items, by slice.


---

## A — Core financial statements


Authority note: items marked [EXT] need an external statutory source (Act/Rules/NCDC annexure/State format) that is not in the repo; they are expectations, not confirmed legal requirements.

## Missing reports
1. P&L Appropriation Account as a standalone report [EXT] — registered in `statements.ts:38` (`pl_appropriation`) but no route/page and no hub card (Reports.tsx maps only trading_ac, profit_loss, income_expenditure). Today only a section on the I&E screen and CSV/XLSX rows.
2. Period (true FY-movement) Trial Balance — current TB "period" columns are cumulative (A-01).
3. Period Receipts & Payments with from/to picker (A-08).
4. Bank Book date-range view (none exists), multi-bank consolidated bank book.
5. Schedules to Balance Sheet printable with the BS (exists separately as /audit-schedules, out of slice; not linked from BS PDF).
6. Voucher register with FY/date/type/status filters and printable register (current: unfiltered CSV/XLSX; per-voucher PDF only).
7. Ledger: all-accounts / group-wise ledger print; account statement for multiple accounts in one PDF.
8. Cash/bank day-wise closing summary (denomination/cash verification certificate) [EXT].
9. Rejected/pending voucher register (approval queue exists in VoucherApproval; no report/export).
10. BRS data export (XLSX/CSV) and BRS history report.
11. Statutory Reconciliation tie to GL (PF/ESI payable ledger balance vs challan) and export.
12. Registered-society (1860 Act) statement set — entity type not modelled at all (S-02) [EXT].
13. DCB, deposit statement, milk payment sheet, maintenance dues, wage register, subsidy claim, stock summary are in the statement registry (statements.ts:46-51) but the Reports hub links none of them (STMT_META covers 3 codes) — discoverability gap.
14. Cash-flow statement — not present (applicability to cooperatives UNVERIFIED) [EXT].
15. Consolidated statement with inter-society elimination (Multi-Society) (A-15).

## Missing fields (on existing reports)
- All XLSX/CSV: society name, registration no, FY, as-on/from-to, generated-by/at (E-02).
- Trial Balance PDF/XLSX: account code (CSV has it, PDF does not), group subtotals.
- Balance Sheet PDF: as-on date (hardcoded 31 March), prior-year computed column; CSV: PY column, unposted stock row.
- I&E PDF: prior-year column, appropriation block, surplus-to-fund breakdown.
- R&P PDF/CSV: prior-year column; as-on/period in header.
- Trading A/c PDF/XLSX/CSV: activity-wise Annexure V section.
- Cash Book/Bank Book: correct opening for filter range, cheque number/date/clearing status columns (hub text claims "cheque details" for Bank Book, Reports.tsx bank card).
- Voucher register export: approval status, created-by, multi-line detail, reversal/reference links.
- Ledger PDF: account code, opening/closing summary block, other-side account column.
- Audit Certificate: structured audit classification rules, audit period validation, link to BS/I&E figures actually certified (cash/bank defaults wrong, A-04).
- Federation/NABARD: format authority and column mapping (EXTERNAL VALIDATION NEEDED), as-on date, GL tie.

## Missing formats
- Print: no print button/print layout for any statement (P-02).
- Hindi/Devanagari PDF (P-01).
- XLSX numeric formatting: NABARD/Federation numbers exported as text (E-03).
- Landscape/portrait choices vary (TB portrait, BS/I&E/R&P landscape) — no user control.
- Signed/locked PDF with verifiable ID (Report ID is random, SEC-04).


---

## B — Registers & statutory


Basis: `docs/research/TASK2.3-COOP-ACCOUNTING-REGISTERS.md` register list (all items there are marked [NV per state] for form numbers, so "required" below means "expected by the repo's own research", not independently verified law). Each item says what exists today.

## Missing registers (no page, no route, no export)
| Expected register (TASK2.3 line) | Present? | Notes |
|---|---|---|
| Share Transfer Register for general (non-housing) societies (:48) | NO | Transfers appear only as a tab in Share Register (ShareRegister.tsx:50-90) and in the housing Transfer Register. |
| Dividend Register (:49) | PARTIAL | Dividend payment register CSV only inside ProfitDistribution.tsx:196-210; no PDF, no unpaid-dividend ageing, no cap check. |
| Demand, Collection and Balance (DCB) Register (:58) | NO | Credit/PACS societies have loan register and KCC only. |
| NPA / overdue classification register (:57) | NO | Loan.status is a manual dropdown. |
| Security Deposit Register (:60) | NO | No page or entity. |
| Investment Register (:70) | NO | Accounts of subtype 'investment' only; FundRegister reads them for backing (FundRegister.tsx:42-49). |
| Deposit Register / Passbook / FD receipt / maturity and interest certificate | NO | Deposits page has no print or export except raw Export Center entity (Deposits.tsx:177). |
| Legal Case Register (:111) | NO | housing legalDocuments only. |
| Board Resolution Register and AGM Register (:108-109) | NO | Meeting register holds resolutions as free text. |
| Attendance / attendee list for meetings | NO | `attendees` is a count (MeetingRegister.tsx:48). |
| Dead Stock Register (:86) | NO | Asset Register is the nearest; no physical-verification date. |
| General Advance Register (members/staff/suppliers) (:59) | NO | AdvanceRegister covers labour worker advances only (AdvanceRegister.tsx:9-14). |
| Member-wise statement/passbook for non-housing societies | NO | MemberStatement is housing-gated (moduleCatalog.ts:108). Share ledger only for shares. |
| Member Register: cessation register / register of ex-members | NO | Form 1 default hides ex-members (Form1MemberList.tsx:35-46). |
| Unpaid / unclaimed dividend and unclaimed deposit register | NO | |
| Fund utilisation statement print (Fund Register export) | NO | FundRegister has no export (FundRegister.tsx). |
| Appropriation statement print (ReserveFund) | NO | ReserveFund has no PDF/XLSX. |
| Cash book denomination register, Registrar annual return, Audit report filing tracker | NO (outside slice but tied to Compliance Calendar) | Calendar has no AGM/Registrar/audit-report items (complianceCalendar.ts:60-103). |
| Notes to accounts / accounting policies | NO | AuditSchedules has schedules only. |
| 26Q, advance tax, GSTR-9 reminders | NO in calendar | |

## Missing fields in existing registers
- Form 1: occupation, age, cessation date and reason, nominee address, additional nominees, real status text for resigned/expelled/deceased.
- Share Register: allotment date per allotment, certificate status/issue dates (fields exist, types.ts:195-201, not printed), transfers, share units on transactions.
- Nomination Register: nominee age, address, share %, nomination date, witness (types Member.nominees exist, types.ts:206-210).
- Loan Register: sanction date/authority, guarantors, installment schedule, overdue days, NPA class, interest outstanding, security (Loan.security exists, types.ts:590, not printed).
- KCC: interest subvention, land/khasra number, crop insurance, overdue/NPA.
- Asset Register: method, residual value, disposal date/proceeds, physical verification date, title/survey no.
- Depreciation Schedule: gross block and accumulated depreciation roll-forward, half-year additions, disposals within the year.
- Audit Register: remarks, Registrar follow-up/report date, responsible officer, full text.
- Meeting Register: quorum, attendee names, proposer/seconder, signatures, full minutes in PDF.
- Election: voter roll, returning officer, notice dates, term start.
- Board: term-expiry alert, history, disqualification.

## Missing formats
- PDF: Reserve Fund, Fund Register, Fund Statement, Deposits, Board of Directors, Recoverables, Compliance Calendar, Transfer Register, Member Statement.
- XLSX: Share Register, Loan Register, Asset Register, Audit Register, Board of Directors.
- CSV: Loan Register, Asset Register, Audit Register.
- Print button: every register except Advance Register (Form 1 has print CSS but no button).
- Hindi-readable PDF for any register (see B-28).
- Page-numbered, FY- and registration-no headed print for Advance Register.

## Missing entity-type support
- Registered Society (Societies Registration Act / trust): no legal-form field, no tailored statutory wording or formats (B-25).
- State coverage: 9 of 36 states/UTs have an audit format; only Haryana has jurisdiction alias and capability pack (jurisdiction.ts:15-19, jurisdictionPacks.ts:36).

## Source documents that would unblock "EXTERNAL VALIDATION NEEDED" items
Prescribed form numbers and register formats for each state; State Act sections on reserve/education/dividend caps; audit-schedule formats per state; Registrar due dates (AGM, audit report, annual return); NABARD CAS manual (register set, NPA norms); Income-tax Act 2025 section numbers for TDS (CA questionnaire in docs/CA-VERIFICATION-2026-07.md is unanswered).


---

## C — Trade, tax, payroll, domain


Expectation basis: what each supported module (per moduleCatalog.ts capability list) would normally need; statutory necessity is EXTERNAL VALIDATION NEEDED unless a repo source is cited.

## Trade / stock
- Physical stock verification / stock-count sheet and book-vs-physical reconciliation (AUDIT_NCDC_Compliance_Report.md:161 confirms none). Closing Stock PDF currently certifies physical verification (pdf.ts:2105).
- Stock ledger / item-wise movement register (Bin-card) printable with opening, receipts, issues, balance; reorder-level report (Inventory low-stock uses fixed `< 5`, Inventory.tsx:621).
- Stock valuation as-on-date and lower-of-cost-or-NRV (AUDIT_NCDC_Compliance_Report.md:124,146); FIFO actually implemented.
- Godown-wise stock statement tied to Inventory totals (C-04); expiry/aging stock report for non-consumer societies.
- Customer / Supplier statement of account (ledger with opening, bills, receipts, closing), party ageing from the Customers/Suppliers pages, and PDF export (Customers.tsx / Suppliers.tsx have list exports only).
- Credit Note / Debit Note PDF for sales/purchase returns (SalesReturn/PurchaseReturn only CSV; grep: no pdf import).
- Rate-wise (multi-rate) tax invoice; Original/Duplicate/Triplicate copies; delivery challan; proforma/quotation; reverse-charge self-invoice and payment voucher.
- Purchase Register: supplier GSTIN, supplier bill no/date, ITC-eligibility, RCM, TCS columns; GSTR-2B reconciliation.
- Print buttons (window.print) on Sale/Purchase Registers, Inventory, Stock Valuation, GST Summary, TDS Register.

## GST
- GSTR-1: B2CL, exports, nil/exempt/non-GST (Table 8), advances (11), document-issued (13), place-of-supply by buyer, HSN rate column; one-month export guard.
- GSTR-3B: 3.1(b), 3.1(d) RCM, 3.2, blocked ITC, Rule 42/43 reversals, interest/late fee, 6.1 tax-paid ledger.
- GSTR-9: real table layout (4-17), 9C reconciliation not applicable; 2A/2B reconciliation.
- GSTR-2B/2A reconciliation report; ITC ledger (electronic credit ledger) and cash ledger statements.
- E-invoice (IRN/QR) readiness check; e-way bill extend/cancel/Part-B update tracking.
- HSN Master linkage to stock items and to GSTR-1 HSN (HsnMaster uses its own table; GstSummary reads stockItems).

## TDS / payroll
- Form 26Q file per NSDL RPU/FVU spec and FVU validation step; 27Q/27EQ (if applicable); TDS challan 281 reconciliation; Form 24Q Annexure I/II; Form 16 (Part A/B) for salary; Form 16A from TRACES integration or clear "statement only" labelling; FY 2026-27 selector.
- Section mapping to Income-tax Act 2025 once CA answers docs/CA-VERIFICATION-2026-07.md (all 15 questions open in the repo).
- Unified payroll TDS feed: new Payroll engine (Payroll.tsx) is not an input to TdsRegister/24Q (TdsRegister.tsx:169-171).
- Payslip variants: Hindi payslip PDF (HTML path exists in Payroll.tsx but legacy SalaryManagement slip is English-only PDF), annual salary statement, PF/ESI challan statement (ECR challan summary), Form 5/10/12A-style EPF returns (EXTERNAL), ESIC Form 5 half-yearly (EXTERNAL), Professional Tax return/challan (lib/professionalTax.ts exists, no report).
- Gratuity/bonus/leave encashment statements; bonus register (Payment of Bonus) — not present (EXTERNAL VALIDATION NEEDED for applicability).

## Labour / contract societies
- Wage Register in prescribed form (father/husband name, OT, deductions, signature/thumb), Muster Roll printable format, Register of Workmen, Register of Advances/Fines/Deductions, Employment card, Form XVII-type statutory registers — form numbers are EXTERNAL VALIDATION NEEDED (no source in repo, labour-code transition unknown).
- Printable Department Bill / Running Account Bill / Tax invoice for works contract with GST and TDS-receivable; work-order-wise cost sheet including statutory contributions.
- Worker Ledger and Work Order Profit exports/prints (none).

## Dairy / consumer / marketing / housing
- Dairy: farmer settlement slip/payment advice PDF, daily/shift collection register print, member passbook print/export, fat/SNF average register, dispatch-vs-collection variance, bonus/distribution statement printable.
- Dairy milk slip: slip number and cumulative qty, farmer signature line.
- Consumer: Z-report net of returns, member outstanding as-of correct, GST-wise sales (counter), credit-note print, patronage/dividend statutory statement (formulas not audited here).
- Marketing/procurement: HAFED Proforma 8 PDF (generator orphaned), procurement register PDF, farmer payment advice, commodity-wise stock-in-hand, J-form print (outside this slice).
- Housing: bill with due date/previous arrears/interest; member statement and demand notice are in other pages (OutstandingRegister.tsx, MemberStatement.tsx) but not linked from Maintenance Billing; sinking/repair fund statement; GST on maintenance.

## Cross-cutting
- Registered Society (Societies Registration Act) variant of reports/wording/auditor certificate — not modelled (src/types/index.ts:1004).
- Hindi (Devanagari) PDF output for invoices/registers (C-28).
- XLSX README/provenance sheet (society, FY, filters, generated by) — available in exportUtils (`meta`, exportUtils.ts:70-110) but none of the slice's XLSX callers pass `meta`.
- Single shared `wageOf`/`gstTotals` money.ts helpers instead of per-page float math.


---

## D — Export infrastructure & security


1. Devanagari PDF output (font embedding) - missing; blocks Hindi statutory statements (D-01).
2. FY / date-range / branch filters in Export Center and EntityExportButton - missing (D-12, D-S04).
3. Provenance (society, reg no, FY, generated-at, user) on CSV and JSON exports - missing (D-16).
4. Audit trail for PDF generators and page-level CSV/XLSX exports - missing (D-S05); export format 'pdf' is already allowed in ExportDescription (audit.ts:36) but unused.
5. Global print stylesheet (@page A4, hide chrome, repeat thead) and print buttons on the core ledger reports (Cash Book, Bank Book, Trial Balance, Ledger) - missing; PDF only (D-09).
6. Shared sanitising filename helper and CSV/XLSX sanitiser (formula, sheet name, cell length) - missing (D-S01, D-15, D-11).
7. Server-side export (RPC or Edge Function) that enforces role and writes the audit row - missing; export_jobs deliberately not built (jobs.ts:8-22). Needed for D-S03 and files larger than the 50,000-row inline cap.
8. Role-aware export mode gating (full/PII needs higher rank) - missing (D-S02).
9. Per-report empty-state, NaN guard and Dr/Cr presentation in pdf.ts - partially missing (D-04, D-05).
10. Live cross-tenant isolation test in CI (test:cross-tenant-isolation skipped without credentials) and a migration-enumerating RLS coverage test (D-S06).
11. Registered Society (non-cooperative) specific headings/format: UNVERIFIED whether any exists in the export layer; header only prints society.registrationNo.
12. Statutory register exports with frozen column sets via `statutory` mode exist in the generator (generator.ts:119-135) but UNVERIFIED which pages call it (grep of callers not exhaustive).
