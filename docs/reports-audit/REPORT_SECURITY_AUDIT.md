# Report Security Audit

Includes security-relevant findings raised by slices A–C (see their finding sections: permission checks on exports, role gating).


---

## Tenant / RLS / permission / export leakage


Scope: src/lib/export/*, ExportCenter, EntityExportButton, exportUtils, pdf.ts helpers, RLS migrations (007, 029-032, 039, 044, 048), route guards. Evidence is source-level; production DB state is UNVERIFIED unless stated.

## Summary of what is sound
- Every registry read applies `.eq('society_id', societyId)` (source.ts:131-149; preflight.ts:100-112), exclude/global entities are refused in both source and generator (source.ts:77-84; generator.ts:92-104).
- RLS: migration 007 enables RLS on every table with a society_id column, drops `qual='true'` policies, scopes CRUD by `get_current_society_id()`, and makes audit_log and ledger_events append-only (007:76-135). Role scoping of mutations in 029-032; branch SELECT scoping for vouchers/sales/purchases/members in 039:60-73.
- The audit row is awaited before bytes leave (generator.ts:205-235; run.ts:45-86). The route guard is applied to all 129 routes; every ProtectedRoute route has a MODULE_CATALOG entry (verified by script: 129/129).
- No secrets in output: registry marks credentials/MFA `exclude`; PDFs print only society identifiers, PAN/TAN/GSTIN.

## Findings

### D-S01 HIGH - CSV formula injection
- Evidence: exportUtils.ts:60 (`escape` only doubles quotes). Sample `REPORT_AUDIT_EVIDENCE/D_csv_injection_sample.csv` contains `"=HYPERLINK(""http://evil"",""x"")"`, `"+cmd|calc"`, `"@SUM(1)"`, tab-prefixed cells unchanged. XLSX is safe (cells typed `s`).
- Scenario: a member or supplier named `=HYPERLINK(...)`, or a narration `=cmd|...`, flows into any CSV (Export Center, 45+ page callers). An auditor/CA opening the CSV in Excel executes it.
- Fix: in buildCsv, for string cells matching /^[=+\-@\t\r]/ prefix `'`; leave true numbers untouched (negative amounts are numbers, not strings).
- Test: buildCsv(['n'], [['=1+1'],['-5 as number',-5]]) yields `'=1+1` and `-5` unchanged.

### D-S02 HIGH - "Full" export mode returns every PII column to viewer-rank roles
- Evidence: member entity `minRole: 'viewer'` (export/entities/member.ts:39) with Aadhaar and PAN columns (member.ts:59-60); `authorizeExport` checks role/capability/format but ignores `mode` (generator.ts:92-104); ExportCenter offers `full` to everyone (ExportCenter.tsx:42-46); route requiredRoles includes viewer (moduleCatalog.ts:191). The same applies to all `viewer` minRole entities with piiClass columns.
- Scenario: a read-only viewer (or externalCA/boardMember rank 0) selects Members + Full + XLSX and receives Aadhaar/PAN/phone/nominees of every member. Audit row is written but access was never denied.
- Fix: require accountant/admin for `full` and for any export containing non-`none` piiClass columns (default to redacted for rank 0); add `mode` to authorizeExport.
- Test: authorizeExport(member, {role:'viewer'}, 'csv') with mode full returns ok:false.

### D-S03 MEDIUM - Export authorization and role gating are client-side only
- Evidence: authorizeExport runs in the browser (generator.ts:92-104). Server RLS role-scoping (029-032) adds the role predicate to MUTATION policies; its header says SELECT stays tenant-only (030_role_scoped_rls_finance_group.sql:14). CapabilityGuard is "presentation-layer enforcement" (CapabilityGuard.tsx:10-12). ProtectedRoute checks authentication only (App.tsx:223-246).
- Scenario: any authenticated society user (including roles the UI hides exports from, e.g. cashier, dataEntry) can call PostgREST directly with their JWT and read every tenant table in the society, bypassing the export registry, redaction and the audit trail entirely.
- Fix: role-scoped SELECT policies for PII/financial tables (or a SECURITY DEFINER export RPC that does the role check and writes the audit row server-side). Until then document that the registry is a UX control, not a security boundary.
- Test: staging user with role cashier selects from members via REST; expect 0 rows or 403.

### D-S04 MEDIUM - Export Center ignores branch scope, FY and period; relabels data as current FY
- Evidence: fetchEntityRows takes only societyId (source.ts:131-149); no import of branchScope anywhere in src/lib/export or ExportCenter (grep: 0 hits); filenameBase and README meta use `society.financialYear` (ExportCenter.tsx:151,160-166; EntityExportButton.tsx:86) while rows are the whole table. Server branch SELECT RLS covers only vouchers, sales, purchases, members (039:60-73) plus godowns (048); all other entities are unscoped by branch.
- Scenario: a branch-restricted accountant exports loans, deposits, stock, journal-type registers for all branches; a file named `loan-2025-26.xlsx` containing 2019-2026 rows goes to the auditor as the FY file. fyLocked/period lock is irrelevant to reads, but the label is wrong.
- Fix: add branchId/FY/date filters to source.ts (use matchesBranch semantics of branchScope.ts) and name the file from the real range; reject unscoped export for restricted users.
- Test: restricted user exports loans; assert only own-branch + HO-legacy rows.

### D-S05 MEDIUM - Export audit trail covers the registry path only
- Evidence: `recordExport/runEntityExport/logExportAudit` appear only in EntityExportButton.tsx, ExportCenter.tsx, run.ts, generator.ts, audit.ts, auditLog.ts, backup/run.ts, restore/trail.ts (grep). pdf.ts has 32 `doc.save` calls (with `trackEvent` in addHeader recording only a GA event, pdf.ts:225) and 29 further `.save(` calls in pages; ~70 page/component files call downloadCSV/downloadExcel/generate*PDF.
- Scenario: member lists (Form1MemberList, Share Register PDF, member passbook/application PDFs, KYC) are downloaded with no audit_log row, defeating the DPDP "who took the member list" guarantee that generator.ts:1-30 claims.
- Fix: route PDF generators through a common `finalizePdf(doc, filename, audit)` that awaits recordExport (format 'pdf'; ExportDescription already allows it, audit.ts:36), starting with PII-bearing ones.
- Test: grep gate that every `.save(` / `downloadCSV` call site is preceded by recordExport.

### D-S06 MEDIUM - Unverified correctness of tenant isolation for later-created tables; cross-tenant live test not run
- Evidence: migration 035 creates `society_activities` with policy `allow_all ... using (true) with check (true)` (035_society_activities.sql:28-33) AFTER 007 ran; no later migration touches the table (grep: only 035/036 and supabase-tables.sql). test:rls-coverage is static and derives its table list from supabase-tables.sql only (scripts/test-rls-coverage.mjs:27-34) and its live part only prints SQL when `pg` is absent. test:cross-tenant-isolation SKIPPED (needs credentials). export/jobs.ts:29-34 and source.ts header repeat the baseline claim that "35 of the schema's policies are using (true)", stale after 007, which hides the real residual cases.
- Scenario: any tenant can read/modify another tenant's activity/capability configuration via REST if the policy is still live in prod; the Export Center filter is then the only boundary for that table.
- Fix: run the three SQL assertions printed by test:rls-coverage against prod (UNVERIFIED here); add a migration re-running the 007 sweep for tables created after 007; make the test enumerate migrations, not only supabase-tables.sql.
- Test: `select tablename from pg_policies where schemaname='public' and (qual='true' or with_check='true')` returns 0 rows apart from the known public inboxes.

### D-S07 MEDIUM - Hindi font fetched from jsDelivr `@main` on every app start, and never used
- Evidence: fontLoader.ts:4-5 (unpinned mutable branch `@main`, no SRI), App.tsx:220 calls `preloadHindiFont()` at module load; `getHindiFont` has zero consumers; PDFs use helvetica (pdf.ts:25-27).
- Impact: a third-party request with every user's IP on every load, a supply-chain exposure (the font bytes would be embedded in generated statutory PDFs if ever wired), wasted bandwidth, and it hides that Hindi PDFs are broken.
- Fix: self-host a pinned font in /public, lazy-load only when generating a PDF, and actually register it with jsPDF (addFileToVFS/addFont). Delete the preload until then.
- Test: network log at app start shows no cdn.jsdelivr.net request.

### D-S08 LOW - Filename construction
- Evidence: pdfFileName sanitises only the society slug (pdf.ts:44-51); `reportType` is not sanitised (script output `../..Cash"Book__evil_script_`); BankReconciliation.tsx:281 only replaces whitespace in bankAccountName; ExportCenter filenameBase uses entity.key (safe). GSTR PDFs embed GSTIN (GstSummary.tsx:446,607).
- Risk is low because browsers strip path separators and reportType is a developer constant; but Hindi names collapse to `___` (collision, VQ-07).
- Fix: one shared `safeFileName()` used by every `.save(`.

### D-S09 LOW - Printed "Report ID" and export id are not verifiable
- Evidence: pdf.ts:30-34 and audit.ts:49 use Math.random; the PDF report id is never persisted, so a printed `SL-CB-...` id cannot be traced to any record, while audit_log holds export ids only for the registry path.
- Fix: persist report ids in audit_log when PDFs are generated (ties to D-S05) or drop the id.

### D-S10 LOW - Popup print documents
- Evidence: Payroll.tsx:302 `esc` escapes `< > &` but not quotes; others escape quotes (Godowns.tsx:82, dairy/slip.ts:8, BarcodeLabels.tsx:18). Values only appear in element text/title here, so exploitability is low (UNVERIFIED that no attribute context exists in the 400 lines of template).
- Fix: use one shared escape that includes `"` and `'`.

### D-S11 INFORMATIONAL
- ExportCenter casts `user.role` to `'admin'|'accountant'|'viewer'` (ExportCenter.tsx:58, EntityExportButton.tsx:62) though 17 roles exist; roleAtLeast fails closed for unranked roles (registry.types.ts:140-145), so cashier/salesOperator/employee/dataEntry get no exports. Correct behaviour, misleading type.
- MultiSocietyConsolidation's cross-society RPCs are gated server-side to super admin (020_gate_super_admin_rpcs.sql:98-102); UI also checks `isSuperAdmin` (MultiSocietyConsolidation.tsx:367).
- Export row cap of 50,000 with explicit "too-large" refusal (source.ts:48-49, run.ts:70) is good; entire dataset is materialised in memory first (preflight.ts header).
- Redacted mode masks only piiClass columns; free-text narration/remarks can still carry personal data (generator.ts:147-153). Document it.
