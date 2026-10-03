# D_gaps - missing capabilities in export/print infrastructure (slice D)

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
