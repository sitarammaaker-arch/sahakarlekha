# Slice A gaps — missing reports / fields / formats (supported modules)

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
