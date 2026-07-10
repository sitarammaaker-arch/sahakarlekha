# Export System — Gap Analysis

**Date:** 2026-07-10
**Scope:** Export, backup, restore, and data-portability surfaces across the whole app.
**Method:** Static read-only audit of `src/lib/exportUtils.ts`, `src/lib/pdf.ts`, `src/pages/BackupRestore.tsx`, `src/pages/UniversalImporter.tsx`, all 6 data contexts, `supabase-tables.sql`, and every consuming page.
**Status:** Analysis only. No code written, no implementation proposed.

> **Headline:** The export *surface* is broad — 59 pages emit CSV, 45 emit Excel, 46 emit PDF. The export *system* is thin. The backup exports 16 of ~93 persisted collections and restores only 2 of them, so the product's own "Backup Now" button produces a file that cannot restore the society that made it. Every statutory file that looks like a government upload is a self-authored approximation. No export is hashed, signed, encrypted, or audit-logged.

---

## 1. Current Export Architecture

Three unrelated pipelines, all running entirely in the browser, all synchronous.

| Pipeline | Entry point | Library | Consumers |
|---|---|---|---|
| Tabular | `downloadCSV`, `downloadExcel`, `downloadExcelSingle` — [exportUtils.ts](../../src/lib/exportUtils.ts) | `xlsx@0.18.5` | 59 CSV / 45 Excel |
| Document | `generate*PDF` — [pdf.ts](../../src/lib/pdf.ts) (3,475 lines) | `jspdf` + `jspdf-autotable` | 29 via helper, ~17 inline |
| Serialization | Hand-rolled `new Blob([JSON.stringify(...)])` | none | 6 sites |

**Shape.** `exportUtils.ts` is 68 lines: a CSV writer with a UTF-8 BOM, an `XLSX.writeFile` wrapper, and a private `triggerDownload` anchor-click. `pdf.ts` is the real asset — it centralizes headers, signature blocks, auditor's certificate, page numbering, and report IDs.

**Structural observations:**

- **No export layer exists.** There is no `ExportService`, no registry of exportable entities, no format abstraction. Each page independently assembles a `headers[]` / `rows[][]` pair and calls a helper. Adding a new format means editing 59 call sites.
- **Everything is client-side.** `api/` contains exactly one function (`subscribe.ts`, an email welcome). There are zero Supabase Edge Functions. No RPC produces a file. The browser is the entire export pipeline.
- **Everything is synchronous and unbounded.** `[headers, ...rows].map(...)` materializes the full dataset in memory ([exportUtils.ts:17](../../src/lib/exportUtils.ts:17)). No chunking, no streaming, no row cap, no progress. The only `async` in the export path is dynamic `import()` for code-splitting.
- **`triggerDownload` is private and duplicated.** The same anchor-click boilerplate is re-implemented at least 6 times (`BackupRestore.tsx:90`, `SocietySetup.tsx:236` & `:363`, `GstSummary.tsx:374` & `:539`, `GSTR9.tsx:80`, `EWayBill.tsx:207`, `tds26q.ts:151`, `PfEsi.tsx:71`).
- **PDF generation is bifurcated.** 29 pages use the `pdf.ts` helpers; ~17 pages (`AgingAnalysis`, `ElectionModule`, `NabardReport`, `TdsForm16A`, `MeetingRegister`, `BankReconciliation`, …) inline their own `jsPDF` + `autoTable`, re-implementing font setup and page numbering. Governance blocks (auditor's certificate, signatories) are therefore inconsistently applied.
- **PDFs are English-only by construction.** `setupFont()` unconditionally returns `'helvetica'` ([pdf.ts:23](../../src/lib/pdf.ts:23)), and `fmt()` prints `Rs.` because Helvetica has no `₹` glyph ([pdf.ts:14](../../src/lib/pdf.ts:14)). Devanagari output is impossible in the PDF path; dairy slips work around this with a browser-print HTML window (`lib/dairy/slip.ts`). This contradicts RULE 7 (Hindi-first) for the product's most user-facing artifact.
- **9 PDF generators are dead code.** `lib/annualReview/p1Pdf.ts` … `p9Pdf.ts` export `generateP1PDF`…`generateP9PDF`; no page imports them.

---

## 2. Supported Formats

| Format | Status | Notes |
|---|---|---|
| CSV | ✅ Solid | UTF-8 BOM for Excel/Hindi. 59 pages. Quote-escaped. |
| XLSX | ✅ Solid | Multi-sheet + auto column width. 45 pages (only 4 use multi-sheet). |
| PDF | ✅ Extensive | 46 pages. Signature blocks, auditor's certificate, report IDs, confidentiality footer. English-only. |
| JSON | ⚠️ Ad-hoc | 6 hand-rolled sites. No shared helper. Used for backup + pseudo-statutory payloads. |
| Print (HTML) | ⚠️ Workaround | 8 sites. Exists mainly to render Devanagari that the PDF path cannot. |
| `.txt` (pipe / `#~#` delimited) | ⚠️ Invented | TDS 26Q and EPFO ECR. Not certified schemas. |

---

## 3. Missing Formats

Verified absent from the entire codebase (zero hits outside `node_modules`):

**Accounting interchange:** Tally XML (`ENVELOPE`/`TALLYMESSAGE`), Tally ODBC, XBRL, SAF-T, ODS/OpenDocument.
**Banking:** OFX, QIF, MT940, ISO 20022 (`pain`/`camt`), NACH mandate files, NEFT/RTGS bulk-upload files.
**Tax/statutory (real schemas):** NSDL/Protean FVU (26Q), GSTN offline-utility JSON (schema-validated), e-invoice IRN/IRP payload, TRACES-issued Form 16A.
**Integration:** REST/GraphQL export API, webhooks, scheduled email delivery, ETL/BI connector, Zapier/Make.

Notably, "Tally" appears ~dozens of times in the repo — but exclusively as **UI mimicry** (Tally-style voucher entry) and **inbound marketing copy** telling users to export CSV *from* Tally *into* SahakarLekha. There is no path back out.

**The statutory formats that do exist are approximations, and the code admits it:**

| Report | Emits | Reality |
|---|---|---|
| TDS 26Q ([tds26q.ts:48](../../src/lib/tds26q.ts:48)) | pipe-delimited `.txt` | Invented record types `FH/BH/CH/DD`; hard-codes `'SahakarLekha v1.0'` as utility name. TRACES will reject it. |
| GSTR-9 ([gstExport.ts:38](../../src/lib/gstExport.ts:38)) | CSV + JSON | Self-labelled: `_disclaimer: "...NOT a certified GSTN upload file"` |
| GSTR-1 ([GstSummary.tsx:530](../../src/pages/GstSummary.tsx:530)) | JSON | Imitates NIC shape, sets `version: 'GST3.0.4'` — and `hash: 'hash'`, a **literal placeholder where the checksum belongs**. |
| Form 16A ([TdsForm16A.tsx](../../src/pages/TdsForm16A.tsx)) | PDF | A certificate-*style* PDF. Real Form 16A can only be issued by TRACES. |
| e-Way Bill ([EWayBill.tsx:136](../../src/pages/EWayBill.tsx:136)) | JSON | Closest to a real NIC shape; manual portal upload, no API/IRN. |
| EPF ECR / ESIC ([PfEsi.tsx:82](../../src/pages/PfEsi.tsx:82)) | `.txt` / `.csv` | Plausible ECR shape, unvalidated against the official spec. |

---

## 4. Missing Modules

Of ~130 pages, roughly **46 carry business data but offer no export at all.** The pattern is stark: the *generic accounting core* (built first) exports well; every *domain vertical* (built later) exports poorly or not at all.

**Zero export, data-bearing:**
`dairy/MilkDispatch`, `dairy/FarmerSettlement`, `dairy/DairyInputs`, `dairy/RateCharts`, `marketing/AgencyReceipts`, `marketing/ProcurementMasters`, `marketing/Transport`, `ProcurementLots`, `ProcurementMatch`, `KachiAaratRegister`, `RecoverablesRegister`, `TransferRegister`, `MusterRoll`, `WorkerLedger`, `WorkerAdvances`, `WorkerMaster`, `WorkOrders`, `WorkOrderProfit`, `DepartmentBills`, `DepartmentMaster`, `ChargeHeads`, `Complaints`, `CompoundVoucher`, `Deposits`, `FundRegister`, `ReserveFund`, `Branches`, `Buildings`, `FlatsRegister`, `Parking`, `Amc`, `Insurance`, `LegalDocuments`, `MakePayment`, `ReceivePayment`, `Analytics`, `Dashboard`, `Reports`, `ComplianceCalendar`, `StatutoryReconciliation`, `LedgerHygiene`, `consumer/MemberCredit`, `consumer/PriceLists`, `consumer/PurchaseOrders`.

`Deposits`, `FundRegister`, `ReserveFund`, `WorkerLedger`, and `dairy/FarmerSettlement` are statutory registers under state cooperative rules. An auditor cannot be handed a file for any of them.

**PDF-only (no machine-readable export)** — 12 modules: `AssetRegister`, `AuditRegister`, `LoanRegister`, `ShareNominationRegister`, `OutstandingRegister`, `Members`, `MemberApplication`, `MaintenanceBilling`, `consumer/RetailCounter`, `BankReconciliation`, `GuideCertificate`, `LandingPage`.

---

## 5. Backup Capability

This is the most serious finding in the audit.

### 5.1 The backup restores 2 of the 16 things it exports

[`BackupRestore.tsx:69-86`](../../src/pages/BackupRestore.tsx:69) exports 16 collections. [`handleRestore` (`:140-188`)](../../src/pages/BackupRestore.tsx:140) loops over exactly two of them — `d.accounts` → `addAccount`, `d.members` → `addMember` — and **silently discards the other 14**, including every voucher, sale, purchase, loan, asset, stock movement, and salary record.

The UI states this plainly (`:291`): *"Vouchers need to be re-entered manually."* The success toast reads *"…Vouchers manually re-enter करें।"*

A user who loses their Supabase project and restores from `sahakarlekha-backup-2025-26-*.json` recovers a chart of accounts and a member list. **Every financial transaction in the society is gone.** The file on disk contains them; the code declines to read them.

`society` is exported too — carrying the approval matrix, period-lock state, board members, and notification config — and is likewise never applied on restore.

### 5.2 The backup covers 16 of ~93 persisted collections

`supabase-tables.sql` creates **90 tables**. Three more (`recoverables`, `kachi_aarat_entries`, `p7_entries`) are read and written by `DataContext` (`:593-595`, `:1958/1996/2041`) but have **no DDL anywhere in the repo**. Total ≈ 93.

**77 collections (83%) are absent from the backup.** Every one of these verticals is 100% uncovered:

- **Procurement engine** (16 tables) — incl. `procurement_financial_intents`, `procurement_posting_requests`, `procurement_posting_rule_results`. Per the [Farmer Payment traceability](../../CLAUDE.md) design, `Payment → EngineVoucher → PostingRuleResult → jformId` *is* the SSOT trace. Losing these tables destroys the audit trail by design.
- **Housing** (11 tables), **Dairy** (6), **Marketing masters** (10), **Consumer** (5), **Labour/payroll** (5).
- **Core financial:** `voucher_entries`, `deposit_accounts`, `deposit_transactions`, `bank_reconciliations`, `tds_entries`, `tds_challans`, `budgets`, `meeting_register`, `elections`, `branches`, `godowns`, `work_orders`.
- **Governance:** `audit_log`, `society_users`, `societies`, `society_capabilities`, `platform_admins`, `user_mfa`.

### 5.3 `voucher_entries` cannot be reconstructed

`voucher_entries` ([supabase-tables.sql:770](../../supabase-tables.sql:770)) is the relational double-entry mirror — one row per Dr/Cr leg, `on delete cascade` from `vouchers`. It is populated by the posting engine, never by the backup. Even a hypothetical full-voucher restore would leave it empty, breaking every SQL-level report and RPC that reads it. RULE 2 (reports must use the same formula as underlying state) is unsatisfiable after a restore.

### 5.4 No operational backup discipline

- Backup is a **manual button click**. No schedule, no cron, no reminder, no retention policy.
- "Last backup" is stored in `localStorage` (`:100`) — cleared with browser cache, per-device, and trivially wrong.
- Restore validates only `json.data && json.version` (`:117`). No version-compatibility check, no schema migration, no dry-run diff, no conflict resolution beyond name/ID dedupe.
- The file is **plaintext JSON** containing every member's name, father's name, phone, and address. No encryption, no passphrase, no integrity hash, no signature.

---

## 6. Data Portability

**Inbound is genuinely good.** `UniversalImporter.tsx` accepts CSV and XLSX for 4 entities (accounts, members, opening balances, bulk vouchers) with per-row validation in Hindi, a real preview/dry-run table, per-row error badges, FY-window checks, FY-lock enforcement, and idempotent re-upload via a `refType: 'bulk-import'` dedupe marker. This is above the bar for the segment.

Two defects sit inside it:
- **No transactional rollback.** Rows are committed one-by-one in a loop; a mid-loop failure leaves a partial import with no undo.
- **Opening balances are written to `localStorage`**, not Supabase (`:429-444`) — a direct RULE 1 violation (local state diverging from cloud, silently).

**Outbound is the problem.** A society that wants to leave SahakarLekha can extract: PDFs (unparseable), per-page CSVs (46 modules have none), and a JSON backup that the product itself cannot re-ingest. There is no documented schema for the backup file, no migration guide out, and no Tally/ERPNext/Odoo interchange format.

The asymmetry is the point: **the product is built to import from Tally and not to export to it.**

---

## 7. Vendor Lock-in Risks

| Risk | Severity | Evidence |
|---|---|---|
| Backup file is not restorable, even by SahakarLekha | **Critical** | `handleRestore` covers 2/16 collections |
| 83% of tables have no export path of any kind | **Critical** | 77 of ~93 |
| No interchange format to any competitor | High | No Tally XML, no ERPNext CSV bundle, no Odoo import shape |
| Backup schema is undocumented and unversioned in any spec | High | `BACKUP_VERSION = '3.0-supabase'`, no schema file |
| Statutory files are non-canonical — cannot be filed elsewhere | High | 26Q `.txt`, GSTR `hash:'hash'` |
| Domain verticals (dairy/housing/marketing/consumer) have no exit at all | High | 0 tables covered across all four |
| No API / server-side export for third-party ETL | Medium | `api/` has 1 unrelated function |

Assessed against the plain-English test "*can a society leave with its data intact?*" — **the answer today is no.** This is severe for a cooperative-sector product where the registrar, the federation, and the members collectively own the books, and where audit trails must survive a change of software vendor.

---

## 8. Enterprise Readiness

| Dimension | State |
|---|---|
| Export audit trail | ❌ **None.** `AuditAction` = `create/update/delete/approve/reject/cancel/restore/reverse` ([auditLog.ts:15](../../src/lib/auditLog.ts:15)). No `export` or `download` action; no exporter calls `logAudit`. A full-society PII download leaves zero trace. |
| Encryption / signing / checksum | ❌ **None.** No `crypto.subtle.digest`, no `sha256`, no signature on any export. `crypto` is used only for `randomUUID()`. Precedent exists — `lib/procurement/documents.ts:21` has a `hash` field "for tamper-evidence" — but it is not applied to exports. |
| Access control on export | ❌ Not evaluated per-export. Any user who can view a page can export its full dataset. |
| Large-dataset handling | ❌ Full in-memory materialization, synchronous, no pagination. A society with 100k vouchers will freeze the tab. |
| Scheduled / automated export | ❌ None. |
| Server-side generation | ❌ None. Zero Edge Functions. |
| Column selection / export profiles | ❌ None. Fixed `headers[]` per page. |
| Dedicated export date-range | ❌ None. Exports serialize whatever the page filter currently shows. |
| Supply chain | ⚠️ **`xlsx@0.18.5`** — the last version SheetJS published to npm. It predates the fixes for the known prototype-pollution and ReDoS advisories (fixed in 0.19.3 / 0.20.2, available only from the SheetJS CDN). This library **parses untrusted user-uploaded files** in `UniversalImporter`. |
| Localization of output | ⚠️ PDFs are English-only by construction. |

---

## 9. Comparison With Industry Standards

✅ full · ⚠️ partial/approximate · ❌ absent

| Capability | SahakarLekha | ERPNext | Odoo | Zoho Books | Tally | SAP B1 |
|---|---|---|---|---|---|---|
| CSV export | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| XLSX export | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PDF export | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Full-fidelity backup + restore** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scheduled / automated backup | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Encrypted / signed export | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Export audit log | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Server-side / async export | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| REST/API data export | ❌ | ✅ | ✅ | ✅ | ⚠️ ODBC/XML | ✅ |
| Column selection / export view | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Certified tax-return files | ❌ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ |
| e-invoice / IRN | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Interchange format (XML/ODS/XBRL) | ❌ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Banking file formats | ❌ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ |
| Universal import w/ validated preview | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Coverage across all modules | ❌ ~65% | ✅ | ✅ | ✅ | ✅ | ✅ |

**Reading of the table.** SahakarLekha matches the field on *presentation* formats (CSV/XLSX/PDF) and beats several on *import* ergonomics. It is absent on every dimension that defines an enterprise export system: fidelity, durability, integrity, traceability, scale, and interoperability. Every product in the comparison set — including Tally, the 1990s desktop incumbent — can round-trip its own backup. SahakarLekha cannot.

---

## 10. Gap Register

### P0 — Data loss, compliance, or lock-in blocker

| ID | Gap | Evidence |
|---|---|---|
| **EXP-01** | Restore reinstates only accounts + members; 14 of 16 exported collections are silently discarded. The backup cannot restore the society that produced it. | `BackupRestore.tsx:140-188` |
| **EXP-02** | 77 of ~93 persisted collections have no backup path. All of housing, dairy, marketing, consumer, labour, procurement, deposits, and `audit_log` are uncovered. | `supabase-tables.sql` vs `BackupRestore.tsx:69-86` |
| **EXP-03** | `voucher_entries` (the double-entry mirror) is neither exported nor reconstructible on restore, breaking all SQL-level reporting post-restore. | `supabase-tables.sql:770` |
| **EXP-04** | Backup is plaintext JSON of all member PII. No encryption, integrity hash, or signature. Silent corruption and tampering are undetectable. | `BackupRestore.tsx:90` |
| **EXP-05** | No export/download is written to `audit_log`; the action vocabulary has no such verb. Bulk PII extraction is untraceable — a DPDP Act exposure. | `auditLog.ts:15` |
| **EXP-06** | `xlsx@0.18.5` (npm's frozen last release, predating the prototype-pollution and ReDoS fixes) parses untrusted user uploads in `UniversalImporter`. | `package.json:91` |
| **EXP-07** | Procurement posting-engine state (`financial_intents`, `posting_requests`, `posting_rule_results`) is unbackupable, destroying the `Payment → EngineVoucher → PostingRuleResult → jformId` SSOT trace. | `supabase-tables.sql:1553-1600` |

### P1 — Enterprise / statutory blocker, no immediate data loss

| ID | Gap | Evidence |
|---|---|---|
| **EXP-08** | Statutory files are self-authored approximations, not certified schemas. GSTR-1 emits `hash: 'hash'` where the checksum belongs. 26Q is not FVU. Form 16A is not TRACES. | `GstSummary.tsx:530`, `tds26q.ts:48` |
| **EXP-09** | No outbound interchange format (Tally XML, ERPNext, Odoo). The importer reads *from* Tally; nothing writes back. | repo-wide, zero hits |
| **EXP-10** | ~46 data-bearing modules have zero export, including the statutory registers Deposits, Fund Register, Reserve Fund, Worker Ledger, Farmer Settlement. | per-module matrix, §4 |
| **EXP-11** | All exports are client-side, synchronous, and unbounded — no pagination, streaming, chunking, or progress. Large societies will hang the tab. | `exportUtils.ts:17` |
| **EXP-12** | No scheduled or automated backup. Manual click only; "last backup" lives in `localStorage`. | `BackupRestore.tsx:100` |
| **EXP-13** | Restore performs no version-compatibility check, schema migration, dry-run diff, or conflict resolution. | `BackupRestore.tsx:117` |
| **EXP-14** | No server-side export, API endpoint, or webhook. No BI/ETL integration path. | `api/` = 1 unrelated function |
| **EXP-15** | Three collections (`recoverables`, `kachi_aarat_entries`, `p7_entries`) have **no DDL in the repo** *and* no backup — doubly unrecoverable. | `DataContext.tsx:593-595` |
| **EXP-16** | `UniversalImporter` writes opening balances to `localStorage` rather than Supabase — a RULE 1 divergence. | `UniversalImporter.tsx:429-444` |
| **EXP-17** | `UniversalImporter` has no transactional rollback; a mid-loop failure leaves a partial import. | `UniversalImporter.tsx:310-508` |
| **EXP-18** | No column selection, export profiles, or dedicated export date-range. | all call sites |

### P2 — Architecture, consistency, and coverage debt

| ID | Gap | Evidence |
|---|---|---|
| **EXP-19** | No export abstraction layer. 59 independent call sites; adding a format means touching all of them. | `exportUtils.ts` (68 lines) |
| **EXP-20** | ~17 pages inline `jsPDF`/`autoTable`, bypassing `pdf.ts` and re-implementing headers, fonts, and page numbers — so governance blocks (auditor's certificate, signatories) are inconsistently applied. | `AgingAnalysis`, `NabardReport`, +15 |
| **EXP-21** | `triggerDownload` is private; the anchor-click boilerplate is duplicated across 6+ sites. No JSON helper exists in `exportUtils`. | 6 hand-rolled sites |
| **EXP-22** | PDFs are English-only (`setupFont` always returns `helvetica`; `₹` rendered as `Rs.`), contradicting RULE 7 Hindi-first for the most user-facing artifact. Devanagari requires an HTML-print workaround. | `pdf.ts:14,23` |
| **EXP-23** | 9 PDF generators (`annualReview/p1Pdf.ts`…`p9Pdf.ts`) are unwired dead code. | no importers |
| **EXP-24** | 12 modules are PDF-only, offering no machine-readable export of the same data. | §4 |
| **EXP-25** | No ODS, XBRL, OFX, QIF, MT940, ISO 20022, SAF-T, or NACH/NEFT banking file support. | repo-wide, zero hits |
| **EXP-26** | Only 4 of 45 Excel exports use the multi-sheet capability that `downloadExcel` already provides. | `AuditSchedules`, `GstSummary`, `MultiSocietyConsolidation`, `NabardReport` |

---

## 11. Summary

**7 P0 · 11 P1 · 8 P2 — 26 gaps.**

The P0 cluster is not a set of independent defects; it is one architectural fact viewed from seven angles. **SahakarLekha treats export as a per-page presentation concern, not as a data-custody responsibility.** Every P0 follows from that: a backup written by a page has no reason to know about tables that page doesn't render; a download triggered by an anchor click has no reason to reach the audit log; a JSON blob assembled in a component has no reason to be hashed.

Two facts should govern how this backlog is read:

1. **The "Backup Now" button is actively dangerous.** It reports success, writes a file, records a timestamp, and produces something that will not restore the society. A user who trusts it and loses their Supabase project loses their books. Under RULE 1's own logic — *local state must never diverge silently from the source of truth* — a backup that silently omits 83% of the database is the same class of bug, one layer up.

2. **The lock-in is not strategic, it is accidental** — a by-product of never having built the exit. For a cooperative-sector product, where the books belong to the members and the registrar, that accident is a governance liability rather than a moat.

**No implementation is proposed.** Per the build-mode operating rule, this document ends here and awaits explicit approval before any remediation planning begins.
