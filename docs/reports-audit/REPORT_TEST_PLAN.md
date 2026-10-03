# Report Test Plan

## Automated (model on scripts/test-*.mjs, add to the CI chain)
1. **Getter parity:** DataContext `getTrialBalance / getProfitLoss / getTradingAccount / getReceiptsPayments` vs `lib/ledger/*` on a 2-FY fixture (currently untested).
2. **Identities:** ΣDr = ΣCr; Assets = Liabilities + Equity; opening + movements = closing per account and for Cash/Bank Book under date/branch filters.
3. **Voucher filtering:** rejected, pending, soft-deleted, cancelled vouchers excluded in every page's data function (table-driven over REPORT_INVENTORY.csv).
4. **Date boundaries:** vouchers on FY start/end; 31-Mar and 01-Apr inclusive at both ends.
5. **Export utils:** CSV injection (`=1+1`, `-5` string vs number, `@x`, tab); BOM; quotes/newlines; XLSX sheet names over 31 chars, duplicates, forbidden characters, cells over 32,767 chars; filename sanitiser; no `.csv.csv`.
6. **PDF render harness** (esbuild bundle + PyMuPDF, as in slice D): each generator × {0, 1, 10, 100, 1200 rows; long name; Hindi; negative; zero; 1e9}. Assert page count, header repeat, "x of y", totals present, extractable text, Hindi codepoints present, nothing outside margins.
7. **Export matrix:** assert every format declared in REPORT_EXPORT_COVERAGE.csv exists and honours filters (extend `test:export-buttons`).
8. **GST/TDS output:** GSTR-1 JSON schema validation (official offline-tool schema, external artefact); place of supply per society state; HSN populated.
9. **Security:** cross-tenant isolation on staging (needs credentials); role matrix for each export (viewer / accountant / admin); branch-scoped user cannot export another branch.

## Manual
* Browser print preview (Chrome, Edge) for TB, BS, I&E, R&P, Cash Book, Ledger: chrome hidden, A4, headers repeat, signatures not orphaned.
* Open CSV/XLSX in Excel with Hindi names and an `=cmd` payload: Hindi correct, no formula runs.
* CA / registrar-format sign-off on every REPORT_STATUTORY_COMPLIANCE_MATRIX row marked EXTERNAL VALIDATION NEEDED.
* Multi-year society: confirm A-01 on a read-only copy of production data.
