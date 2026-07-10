# Data Portability & Backup Center — Development Roadmap

**Date:** 2026-07-10
**Status:** Roadmap only. No code written. No branch cut. No ECR filed.
**Inputs:** [GAP-ANALYSIS-EXPORT-SYSTEM.md](GAP-ANALYSIS-EXPORT-SYSTEM.md) (26 gaps) · [DESIGN-DATA-PORTABILITY-CENTER.md](DESIGN-DATA-PORTABILITY-CENTER.md) (blueprint)
**Governs:** [DELIVERY-FRAMEWORK.md](../../DELIVERY-FRAMEWORK.md) G0–G4 · [CLAUDE.md](../../CLAUDE.md) RULES 1–8

---

## 0. Assumptions — Read First

The blueprint left seven decisions (D1–D7) open. This roadmap assumes the **recommended** answer to each. If any differs, the marked tasks change or vanish.

| Decision | Assumed | Tasks affected if reversed |
|---|---|---|
| D1 — build server tier (Edge Functions + Storage + `pg_cron`) | **DEFERRED (2026-07-10)** | See below |
| D2 — password escrow | **No escrow** | T-19 gains a key-management sub-task |
| D3 — scheduled-backup encryption | Bucket-level, no per-file password | T-22 |
| D4 — `.slbak` extension | Yes | T-17 |
| D5 — retention floor 7 daily + 4 weekly | Yes | T-22 |
| D6 — rehearsal cadence weekly | Yes | T-29 |
| D7 — ship outbound Tally XML | **Yes** | T-33 deleted |

**Nothing in Phase 1 or later should start before D1 is answered.** Phase 0 is independent of all seven.

---

## 0a. D1 — DEFERRED, and what that changes (decided 2026-07-10)

The server tier is not being built yet. **T-27 (Edge Function), T-28 (schedules + `pg_cron`)
and T-35 (restore rehearsal) are on hold.** Work continues with Phase 4 (Restore), which is
entirely client-side.

Why, in the order the reasons actually weigh:

1. **Restore is where the P0 closes.** T-33's commit saga and replay assertion are what turn
   a `.slbak` file into a backup. Today an archive is written, hashed and verified — and
   cannot be put back. That is the same lie T-01 removed from the UI, one layer down.
2. **The server tier buys scheduling, large exports and automated rehearsal.** Valuable, and
   none of them is the P0.
3. **Nothing about T-27 could be verified from the workspace.** There is no
   `supabase/config.toml`, no linked project, no `SUPABASE_ACCESS_TOKEN`, and no Storage
   bucket. Writing an Edge Function nobody can run, and calling the task done, is the kind
   of unverified claim this whole workstream exists to stop.

Two facts worth keeping for when D1 is revisited:

- The registry **can** be shared with Deno rather than forked. `tsconfig.app.json` already
  sets `allowImportingTsExtensions: true`, so explicit `.ts` specifiers are legal for both
  Vite and tsc; the `@/` alias needs a Deno import map. Roadmap acceptance "Registry is
  shared, not forked" is achievable — at the cost of touching the import specifiers in
  ~15 files under `src/lib/export/`.
- Until scheduling and rehearsal exist, **the UI must keep calling the archive an export,
  not a backup** (T-24b's amber warning). That constraint is now load-bearing rather than
  temporary.

---

## 1. Legend

**Priority** — P0 = data loss / compliance / security. P1 = enterprise or statutory blocker. P2 = debt.
**`[DI]`** — carries the DELIVERY-FRAMEWORK **data-integrity modifier**; most-enforced gates (G0–G4 all mandatory, RULE 1/2/3/5/6 review required).
**Gap** — the EXP-nn this closes, from the audit.
**Files** — hard cap of 5 per task, as required.

Every task below is independently shippable and independently revertible. No task leaves the tree in a state where a user can lose data that they could not lose before it.

---

# PHASE 0 — Stop The Bleeding

*No new infrastructure. No dependency on D1. Ship this phase first, regardless of what happens to the rest.*

The audit's finding was that the "Backup Now" button reports success and produces a file that cannot restore the society. **Until that is true, nothing else matters.** Phase 0 does not build the backup system — it stops the product from lying about having one.

---

### T-01 — Tell the truth about backup `[DI]` · **P0** · Gap EXP-01

Rename the "Backup" surface to "Export", remove the false success toast, and disable the restore path that silently drops 14 of 16 collections. A restore that recovers a chart of accounts and discards every voucher is worse than no restore button, because the user stops looking for their data.

| | |
|---|---|
| **Files** | `src/pages/BackupRestore.tsx`, `src/lib/navigation/*` (route label), `src/content/help/*` (one article) |
| **DB impact** | None |
| **Testing** | Manual: click Export → file downloads, toast says "Export", not "Backup". Restore card is visibly disabled with a Hindi explanation. Existing `.json` files still parse for preview. |
| **Acceptance** | 1. No UI string claims the JSON is a backup or is restorable. 2. Restore button disabled; tooltip in Hindi explains that vouchers are not restorable and full backup is coming. 3. `localStorage` "last backup" key no longer written. 4. Existing exported files remain readable. |
| **Notes** | Deliberately does **not** fix restore — that is T-24…T-28. This task makes the product honest in an afternoon. |

---

### T-02 — Blocking export audit `[DI]` · **P0** · Gap EXP-05

Add `export` and `restore` to the audit vocabulary, and add a **blocking** sibling to `logAudit`. `logAudit` is fire-and-forget by design ([auditLog.ts:77](../../src/lib/auditLog.ts:77)) — correct for business writes, wrong for exports, where an untraced download is worse than a failed one.

| | |
|---|---|
| **Files** | `src/lib/auditLog.ts`, `scripts/test-audit-log.mjs`, `supabase-tables.sql` (enum widen), `MIGRATIONS.sql` |
| **DB impact** | Widen `audit_log.action` CHECK/enum to include `export`, `restore`. Additive, backward-compatible. WORM policies unchanged. |
| **Testing** | Extend `test:audit`: (a) `buildAuditEvent` accepts the two new actions; (b) new `logExportAudit` **rejects** on insert failure rather than swallowing; (c) PII redaction still applied. |
| **Acceptance** | 1. `AuditAction` includes `export`, `restore`. 2. A blocking helper exists whose failure semantics are the *inverse* of `logAudit`, documented in a header comment so nobody reuses the wrong one. 3. `logAudit`'s non-blocking contract is unchanged. 4. Migration is idempotent (`if not exists`). |
| **Notes** | No caller yet. Wiring happens in T-10. Landing the contract first prevents the "helpfully reused `logAudit`" regression the blueprint warns about. |

---

### T-03 — `xlsx` supply chain · **P0** · Gap EXP-06

`xlsx@0.18.5` is npm's frozen last release, predating the prototype-pollution and ReDoS fixes. It parses **untrusted user uploads** in `UniversalImporter`.

| | |
|---|---|
| **Files** | `package.json`, `package-lock.json`, `src/lib/exportUtils.ts`, `src/pages/UniversalImporter.tsx` |
| **DB impact** | None |
| **Testing** | `npm run build` green. Round-trip: export XLSX → reopen in the importer → identical rows. Import a malformed/adversarial `.xlsx` → rejected, no crash. Hindi headers survive. |
| **Acceptance** | 1. Resolved version is patched (SheetJS CDN source, or a vetted alternative for the read path). 2. `downloadExcel` output opens cleanly in Excel and LibreOffice with Devanagari intact. 3. No new lockfile advisories. |
| **Notes** | Verify the CDN-sourced package works with the Vercel build before committing. This is the only task with a real chance of a nasty build surprise. |

---

### T-04 — Opening balances to Supabase `[DI]` · **P0** · Gap EXP-16

`UniversalImporter` writes opening balances to `localStorage` ([UniversalImporter.tsx:429](../../src/pages/UniversalImporter.tsx:429)). This is a live RULE 1 violation — local state diverging silently from cloud — and it predates this whole initiative.

| | |
|---|---|
| **Files** | `src/pages/UniversalImporter.tsx`, `src/contexts/DataContext.tsx`, `supabase-tables.sql`, `MIGRATIONS.sql` |
| **DB impact** | Opening balances persist to `accounts.openingBalance` / `openingBalanceType` (columns exist) via the two-step upsert pattern. Possible `opening_balances` staging table if per-FY history is wanted — **decide before starting**. |
| **Testing** | Import OB → hard-refresh (F5) → balances survive. Simulate a Supabase step-1 failure → local state rolls back **and** a destructive toast fires ≥10s (RULE 1). Trial Balance still balances after import. |
| **Acceptance** | 1. No OB path touches `localStorage`. 2. Two-step upsert: base columns first, extras second. 3. Step-1 failure rolls back optimistic state and shows a destructive Hindi toast. 4. FY-lock honoured (RULE 6). |
| **Notes** | Arguably should ship independently of this initiative. It is a standing data-loss bug. |

---

# PHASE 1 — The Registry Foundation

*Blocked on D1. Nothing user-visible ships in this phase; it is the spine everything else hangs from.*

---

### T-05 — Registry types & descriptor schema · **P0** · Gap EXP-19

The declarative SSOT. Types only — no entities populated, no consumers.

| | |
|---|---|
| **Files** | `src/lib/export/registry.types.ts`, `src/lib/export/index.ts`, `scripts/test-export-registry.mjs` |
| **DB impact** | None |
| **Testing** | New `test:export-registry` (mirror pattern, per `test-nav.mjs`): descriptor shape validates; `backupPolicy` is one of `full`/`replay`/`sidecar`/`exclude`; `dependsOn` references resolve; the DAG is acyclic. |
| **Acceptance** | 1. Entity + column descriptors match blueprint §3.1/§3.2. 2. `capability` and `minRole` reference the **existing** types from `navigation/capabilities.ts` — no parallel role system. 3. Role references are keys, not literals, so ECR-06's 17-role migration does not break this. 4. Cycle detection has a failing test. |

---

### T-06 — Populate: core + member domains · **P0**

| | |
|---|---|
| **Files** | `src/lib/export/entities/core.ts`, `src/lib/export/entities/member.ts`, `src/lib/export/registry.ts`, `scripts/test-export-registry.mjs` |
| **DB impact** | None |
| **Testing** | Every declared column exists on the live table (assert against `supabase-tables.sql`). `voucher_entries` is declared `replay`, never `full`. |
| **Acceptance** | 1. 11 collections declared (6 core + 4 member + `voucher_entries`). 2. `piiClass` set on every member column; `phone`, `pan`, `aadhaar` mapped to the existing `PII_KEYS` semantics. 3. `dependsOn` correct: vouchers→accounts, members→society. |

---

### T-07 … T-11 — Populate: remaining domains · **P0**

Five sibling tasks, identical shape, parallelizable. Each adds one file under `src/lib/export/entities/` plus the registry index and the test.

| Task | Domain | Collections |
|---|---|---|
| T-07 | inventory + trade | 13 |
| T-08 | lending, deposits, payroll, labour | 16 |
| T-09 | procurement (incl. `posting_rule_results` → `replay`) | 16 |
| T-10 | dairy, housing | 17 |
| T-11 | marketing, consumer, compliance, governance, evidence, system | 35 |

| | |
|---|---|
| **Files (each)** | 1 entities file, `src/lib/export/registry.ts`, `scripts/test-export-registry.mjs` (3 files) |
| **DB impact** | None |
| **Testing (each)** | Column-existence assertion. Policy assertions: `audit_log`/`guide_certificates` = `sidecar`; `user_mfa`/`user_mfa_recovery`/`platform_admins` = `exclude`; `hsn_master` scope = `global`. |
| **Acceptance (each)** | 1. Every table in the domain declared exactly once. 2. Capability gating matches `navigation/capabilities.ts`. 3. No `exclude` entity is reachable from any export UI path. |

---

### T-12 — Schema-drift detector `[DI]` · **P0** · Gap EXP-15

The check that makes 93/93 coverage permanent rather than a one-time achievement. Also creates the three missing tables.

| | |
|---|---|
| **Files** | `scripts/test-schema-drift.mjs`, `package.json`, `supabase-tables.sql`, `MIGRATIONS.sql` |
| **DB impact** | **Adds DDL for `recoverables`, `kachi_aarat_entries`, `p7_entries`** — read/written by `DataContext.tsx:593-595` today with no schema in the repo. Reverse-engineer columns from the write sites. Add RLS mirroring sibling tables. |
| **Testing** | `npm run test:schema-drift` fails when a table exists in SQL but not the Registry, and vice versa. Wire into `npm run build`. |
| **Acceptance** | 1. Registry keys ≡ `supabase-tables.sql` tables, modulo an explicit `KNOWN_EXCLUSIONS` list with a written reason per entry. 2. The three orphan tables have DDL + RLS. 3. Build fails on drift. 4. Duplicate `suppliers`/`customers` declarations in the SQL file are resolved. |
| **Notes** | The duplicate-table declarations the audit found are a latent footgun independent of exports. |

---

### T-13 — `exportUtils` consolidation · **P2** · Gaps EXP-21, EXP-26

| | |
|---|---|
| **Files** | `src/lib/exportUtils.ts`, `scripts/test-export-utils.mjs` |
| **DB impact** | None |
| **Testing** | CSV escaping (quotes, commas, newlines, Devanagari). BOM present. XLSX multi-sheet with a README sheet. JSON envelope carries `schemaVersion`. |
| **Acceptance** | 1. `triggerDownload` exported, not private. 2. `downloadJSON` helper exists; the 6 hand-rolled Blob sites can migrate to it. 3. `downloadExcel` gains an auto README sheet (society, FY, generated-at, filters, row counts). 4. No behaviour change to the 59 existing CSV callers. |

---

# PHASE 2 — Export Center

---

### T-14 — Registry-driven generator + audit wiring `[DI]` · **P0** · Gaps EXP-05, EXP-19

The first consumer of the Registry. Wires T-02's blocking audit helper.

| | |
|---|---|
| **Files** | `src/lib/export/generator.ts`, `src/lib/export/audit.ts`, `src/lib/exportUtils.ts`, `scripts/test-export-generator.mjs` |
| **DB impact** | Writes `audit_log` rows with `action: 'export'` |
| **Testing** | Given a registry entity + rows → correct CSV/XLSX/JSON. **Audit-write failure aborts the export and delivers no bytes.** Redacted mode masks every `piiClass ≠ none` column. Soft-deleted rows excluded unless `includeDeleted` (RULE 5). |
| **Acceptance** | 1. One code path produces all three tabular formats from a descriptor. 2. No artifact is delivered before the audit row commits. 3. `minRole` + `capability` enforced at generate time, not just in the UI. 4. Redacted mode has a test per PII class. |

---

### T-15 — `export_jobs` + Export History · **P0** · Gap EXP-05

| | |
|---|---|
| **Files** | `supabase-tables.sql`, `MIGRATIONS.sql`, `src/pages/ExportHistory.tsx`, `src/lib/export/jobs.ts`, `src/lib/navigation/*` |
| **DB impact** | **New `export_jobs`** (blueprint §10). RLS: `society_id` scoped, admin-read. Append-only in practice. |
| **Testing** | Every export creates a row. History lists who/what/when/format/rows/hash. Cross-society read denied by RLS (test with two societies). |
| **Acceptance** | 1. `/data/history` answers "who took the member list, and when." 2. Admin-only. 3. Artifact hash recorded. 4. RLS test proves cross-tenant isolation. |

---

### T-16 — Global Export Center UI · **P1**

| | |
|---|---|
| **Files** | `src/pages/ExportCenter.tsx`, `src/components/export/EntityPicker.tsx`, `src/components/export/ColumnPicker.tsx`, `src/lib/navigation/*`, `src/App.tsx` |
| **DB impact** | None |
| **Testing** | A dairy society sees no housing entities. A `viewer` cannot select unredacted PII columns. Date range + include-deleted toggles reach the generator. |
| **Acceptance** | 1. Entities grouped by domain, capability-filtered. 2. Column selection (EXP-18). 3. Modes: standard / full / redacted / statutory. 4. Hindi-first labels (RULE 7). |

---

### T-17 — Row-count preflight · **P1** · Gap EXP-11

| | |
|---|---|
| **Files** | `src/lib/export/preflight.ts`, `src/pages/ExportCenter.tsx`, `scripts/test-export-generator.mjs` |
| **DB impact** | Count queries only |
| **Testing** | Below threshold → inline generation. Above → refuses inline, offers a server job (stubbed until T-22). Threshold configurable and covered by a test. |
| **Acceptance** | 1. No unbounded in-memory materialization. 2. User sees estimated rows/size before generating. 3. Fast path unchanged for small exports. |

---

### T-18 … T-22 — Migrate in-page export buttons · **P1** · Gaps EXP-10, EXP-24

Five sibling tasks, ~12 pages each, **5 files per task**. Mechanical: delete bespoke `headers`/`rows` assembly, call the Registry.

| | |
|---|---|
| **Files (each)** | 5 page files |
| **DB impact** | None |
| **Testing (each)** | Byte-compare old vs new CSV output for each migrated page — **output must be identical** unless the audit flagged that page's columns as wrong. Snapshot test per page. |
| **Acceptance (each)** | 1. Zero bespoke export logic remains in the migrated pages. 2. Output unchanged (or the change is explicitly justified). 3. Pages with no export before now have one, from the Registry. |
| **Notes** | Sequence the ~46 export-less modules **first** — they are pure additions and cannot regress. The 59 existing call sites carry regression risk and go last. |

---

# PHASE 3 — Backup Center

*Every task here is `[DI]`. All blocked on D1.*

---

### T-23 — Manifest schema + integrity primitives `[DI]` · **P0** · Gap EXP-04

Pure library. No I/O. Fully unit-testable — build it first and trust nothing downstream that this does not verify.

| | |
|---|---|
| **Files** | `src/lib/backup/manifest.ts`, `src/lib/backup/integrity.ts`, `scripts/test-backup-manifest.mjs` |
| **DB impact** | None |
| **Testing** | Canonical serialization is stable across key order. SHA-256 per entity + manifest hash. A one-byte edit to any `.ndjson` is detected. `registryFingerprint` changes when the Registry changes. |
| **Acceptance** | 1. Manifest fields match blueprint §5.2. 2. `manifestHash` covers everything except itself. 3. Tamper detection has a failing-case test. 4. Zero dependencies on Supabase or the DOM. |

---

### T-24 — `.slbak` writer (client) `[DI]` · **P0** · Gaps EXP-01, EXP-02

| | |
|---|---|
| **Files** | `src/lib/backup/writer.ts`, `src/lib/backup/ndjson.ts`, `src/pages/BackupCenter.tsx`, `scripts/test-backup-writer.mjs` |
| **DB impact** | Reads all `full` + `sidecar` + `replay` entities |
| **Testing** | Produces a ZIP with `manifest.json`, `data/*.ndjson`, `evidence/`, `derived/`. Row counts in manifest match file line counts. `exclude` entities absent. Corrupt one line → verify fails. |
| **Acceptance** | 1. All 93 collections accounted for by policy — none silently missing (P7). 2. Streaming writer; no full-DB in-memory buffer. 3. `exclude` entities are provably absent. 4. Labelled **Export, not Backup** until T-27 lands scheduling — no scheduling, no "backup" claim. |

---

### T-25 — Verify action `[DI]` · **P0** · Gap EXP-04

| | |
|---|---|
| **Files** | `src/lib/backup/verify.ts`, `src/pages/BackupCenter.tsx`, `scripts/test-backup-writer.mjs` |
| **DB impact** | None |
| **Testing** | Verify a good file → green. Flip one byte in any `.ndjson` → red, names the file. Edit the manifest → red. Verify works with **no society loaded** (an auditor validating a handed-over file). |
| **Acceptance** | 1. Verify runs without restoring. 2. Reports per-entity hash status. 3. Works offline, unauthenticated. |

---

### T-26 — AES-256-GCM encryption `[DI]` · **P0** · Gap EXP-04 · *Assumes D2 = no escrow*

| | |
|---|---|
| **Files** | `src/lib/backup/crypto.ts`, `src/lib/backup/writer.ts`, `src/pages/BackupCenter.tsx`, `scripts/test-backup-crypto.mjs` |
| **DB impact** | None. **No key material is ever persisted.** |
| **Testing** | Round-trip encrypt→decrypt. Wrong password → GCM auth failure, no partial plaintext. Tampered ciphertext → auth failure. Cleartext manifest header still identifies the file without the password. |
| **Acceptance** | 1. AES-256-GCM over ZIP bytes; **not** ZipCrypto. 2. PBKDF2-SHA256 (or Argon2id), per-file random salt, high iteration count. 3. Header (format version, society, created-at, encryption params) readable without decrypting. 4. Mandatory typed Hindi confirmation: पासवर्ड खो गया तो बैकअप हमेशा के लिए बेकार है। 5. Unencrypted copy offered. |

---

### T-27 — Server backup function `[DI]` · **P0** · *D1*

**First Edge Function in the repo.** Expect infrastructure friction; budget for it.

| | |
|---|---|
| **Files** | `supabase/functions/backup/index.ts`, `supabase/functions/_shared/registry.ts`, `supabase-tables.sql`, `MIGRATIONS.sql` |
| **DB impact** | Service-role reads across RLS. **New private Storage bucket**, `society_id`-path-scoped, signed-URL access only. |
| **Testing** | Produces a byte-identical `.slbak` to the client writer for the same data. Handles a 100k-voucher society without OOM. Bucket RLS denies cross-society reads. |
| **Acceptance** | 1. Registry is shared, not forked, between client and Edge. 2. Streams to Storage; never buffers the whole DB. 3. Artifact registered in `export_jobs`. 4. Signed URLs expire. |

---

### T-28 — Schedules + `pg_cron` `[DI]` · **P0** · Gap EXP-12 · *D1, D3, D5*

| | |
|---|---|
| **Files** | `supabase-tables.sql`, `MIGRATIONS.sql`, `supabase/functions/backup/index.ts`, `src/pages/BackupCenter.tsx` |
| **DB impact** | **New `backup_schedules`, `backup_runs`.** `pg_cron` job invoking the Edge Function. GFS retention prune. |
| **Testing** | Cadence off/daily/weekly/monthly, IST-anchored. Retention prunes to floor but **never below 7 daily + 4 weekly**. A forced failure raises an in-app banner **and** emails the admin. |
| **Acceptance** | 1. `last_success_at` lives in `backup_runs`, **not `localStorage`**. 2. Failure is loud (P7); success is silent. 3. Retention floor not user-reducible. 4. Scheduled backups are unencrypted-at-app-layer inside an encrypted bucket (D3). |

---

### T-29 — Backup Health card · **P1**

| | |
|---|---|
| **Files** | `src/components/dashboard/BackupHealth.tsx`, `src/pages/Dashboard.tsx`, `src/lib/backup/health.ts` |
| **DB impact** | Reads `backup_runs` |
| **Testing** | Green only when last success is fresh **and** last rehearsal (T-36) passed. Staleness banner after threshold. Never green on missing data. |
| **Acceptance** | 1. Shows last success, last verify, entity coverage (`93/93`), last rehearsal outcome. 2. Defaults to red/unknown, never green, when any input is absent. |

---

# PHASE 4 — Restore Center

*Every task `[DI]`. This phase is where the audit's headline bug actually dies.*

---

### T-30 — Restore DAG resolver · **P0** · Gap EXP-03

| | |
|---|---|
| **Files** | `src/lib/restore/dag.ts`, `scripts/test-restore-dag.mjs`, `src/lib/export/registry.ts` |
| **DB impact** | None |
| **Testing** | Topological order from `dependsOn`. Cycle → hard error. `replay` and `sidecar` entities excluded from the insert order. |
| **Acceptance** | 1. Deterministic insert order. 2. `voucher_entries` **never** appears in the insert plan. 3. Pure, no I/O. |

---

### T-31 — Dry-run diff engine · **P0** · Gap EXP-13

Pure function: (backup entities, current DB snapshot) → per-entity insert/update/conflict/skip counts + itemized conflicts.

| | |
|---|---|
| **Files** | `src/lib/restore/diff.ts`, `scripts/test-restore-diff.mjs`, `src/lib/restore/naturalKeys.ts` |
| **DB impact** | Read-only |
| **Testing** | Fresh society → all insert. Identical data → all skip. Same natural key, different content → conflict, itemized with before/after. Soft-deleted rows restore **as** soft-deleted (RULE 5). |
| **Acceptance** | 1. Pure and unit-tested. 2. Natural key declared per entity in the Registry. 3. Conflicts carry before/after for the UI. 4. Zero writes. |

---

### T-32 — Restore Center gates 1–5 · **P0** · Gap EXP-13

Upload → identify → decrypt → verify → compatibility → dry-run. **No commit path in this task**, so it cannot lose data.

| | |
|---|---|
| **Files** | `src/pages/RestoreCenter.tsx`, `src/components/restore/DiffTable.tsx`, `src/lib/restore/compat.ts`, `src/lib/navigation/*`, `src/App.tsx` |
| **DB impact** | Read-only |
| **Testing** | Wrong password → stop. Tampered file → stop. `registryFingerprint` mismatch → names the unplaceable entities. Backup newer than build → refuse, never guess. Dry-run cannot be skipped by an admin. |
| **Acceptance** | 1. Six gates, each abortable, per blueprint §6.2. 2. Dry-run mandatory and unskippable. 3. Diff table in Hindi. 4. **No write path exists in this task.** |

---

### T-33 — Commit saga + replay assertion · **P0** · Gaps EXP-01, EXP-03

The task that makes the backup a backup. `voucher_entries` is **replayed** through the posting engine and asserted against the exported copy. Divergence rolls back and names the disagreeing vouchers.

| | |
|---|---|
| **Files** | `src/lib/restore/commit.ts`, `src/lib/restore/replay.ts`, `supabase/functions/restore/index.ts`, `scripts/test-restore-commit.mjs`, `src/pages/RestoreCenter.tsx` |
| **DB impact** | Writes every `full` entity. Regenerates `voucher_entries`. **Skips `sidecar` and `exclude`.** Writes one `audit_log` `restore` event. |
| **Testing** | **Round-trip: export a seeded society → restore into an empty one → Trial Balance balances, stock formula reconciles (RULE 2), replayed `voucher_entries` match byte-for-byte.** Induced replay divergence → rollback + voucher IDs reported. FY-lock blocks restore (RULE 6). Replace mode takes a `pre-restore` backup first. |
| **Acceptance** | 1. Modes Fresh / Merge / Replace per §6.4. 2. Replace **cannot** proceed without a successful pre-restore backup. 3. `audit_log` never receives backup rows — one `restore` event only (P4). 4. Failure rolls back completely; partial restore is impossible. 5. Post-restore assertions run and surface. |
| **Notes** | The single riskiest task in the roadmap. It should not start until T-23…T-25 and T-30…T-32 are green, and it deserves the most-enforced G4 gate. |

---

### T-34 — `restore_runs` trail · **P1**

| | |
|---|---|
| **Files** | `supabase-tables.sql`, `MIGRATIONS.sql`, `src/lib/restore/commit.ts`, `src/pages/ExportHistory.tsx` |
| **DB impact** | **New `restore_runs`**: source manifest hash, mode, diff summary, replay assertion result, outcome, `pre_restore_job_id`. RLS scoped. |
| **Testing** | Every restore attempt — including aborted ones — leaves a row. Replay assertion result recorded either way. |
| **Acceptance** | 1. Aborted restores are recorded, not just successful ones. 2. Links to the pre-restore backup job. |

---

### T-35 — Restore rehearsal `[DI]` · **P0** · *D1, D6* · **PARTIAL (2026-07-10)**

**The highest-value task in this roadmap.** It is the only mechanism that can honestly claim a backup works — because it was restored last night into a throwaway shadow society.

> **Status: assertion core + health card DONE and verified; server orchestration BLOCKED on D1.**
>
> What shipped (pure, tested, browser-verified):
> - `src/lib/backup/rehearsal.ts` — the equality assertions the whole rehearsal turns on:
>   a trial-balance signature (summed from `voucher_entries`, not a cached field — RULE 2),
>   the double-entry `balanced` invariant, and per-item stock by the canonical formula
>   (RULE 2, the ₹1,12,500 phantom). `compareRehearsal` reports every account/item that
>   differs. Pure — runs identically in an Edge Function, in a client-side rehearsal with no
>   shadow society, and in a test.
> - `src/lib/backup/health.ts` — the Backup Health card (acceptance 3). **Never green on
>   missing data**: green requires a recent backup, a verification, AND a fresh passing
>   rehearsal. A never-rehearsed backup is amber (unproven); a failed one is red. This is the
>   function that enforces "do not ship the word *backup* until a rehearsal is green".
>
> What is NOT built, and why it cannot be from this workspace:
> - `supabase/functions/rehearsal/index.ts` (the Edge Function), the shadow-society
>   create/destroy lifecycle, and the weekly `pg_cron` schedule. All three need the server
>   tier (**D1**), a linked Supabase project, a service-role key, and a deploy — none of
>   which exist here. Writing an Edge Function nobody can run and calling T-35 "green" would
>   be the exact unverified claim this workstream exists to prevent.
>
> **Update 2026-07-10 — a CLIENT-SIDE rehearsal now runs, no server needed.**
> The user chose the D1-free realization over deploying an Edge Function. `rehearsalRun.ts`
> runs the same proof entirely in the browser: verify the backup, replay its ledger in
> memory, read the live rows, replay theirs, and compare (`compareRehearsal`). If restoring
> the backup would reproduce today's trial balance and stock, it passes; a stale or
> incomplete backup fails and names the accounts/items that differ. It writes nothing, needs
> no service-role key, and ships with the normal frontend. Wired into Restore Center as a
> read-only "Rehearse this backup" action, with the health card driven by the result.
> Verified end-to-end in a real browser (pass → green, stale → red, truncated read → aborts).
>
> **This is now an on-demand rehearsal, not the weekly automated one.** A backup a user
> actually rehearses and passes IS proven for that moment. What is still missing (and still
> needs D1): the WEEKLY unattended run (`pg_cron`), the shadow-society isolation, and a
> persisted rehearsal outcome so the health card reflects the last run across sessions
> rather than only the just-run one. Until that persistence exists, treat a green health
> reading as "this backup, rehearsed just now" — not "backups are healthy in general".

| | |
|---|---|
| **Files** | `supabase/functions/rehearsal/index.ts`, `supabase-tables.sql`, `MIGRATIONS.sql`, `src/lib/backup/health.ts` |
| **DB impact** | Creates and **destroys** a shadow society per run. Writes `backup_runs.rehearsal_outcome`. |
| **Testing** | Restores the latest backup into a shadow society, asserts Trial Balance + stock + replay equality, then destroys it. Shadow society is never visible in any UI or any `society_id` listing. A rehearsal failure raises a loud alert. |
| **Acceptance** | 1. Weekly per society (D6). 2. Shadow society is provably isolated and provably destroyed, even on failure. 3. Result drives the Backup Health card. 4. Failure notifies the admin. |
| **Notes** | Without this, every guarantee in Phases 3–4 is theoretical. |

---

# PHASE 5 — Migration Center

---

### T-36 — Importer transactional commit `[DI]` · **P1** · Gap EXP-17

| | |
|---|---|
| **Files** | `src/pages/UniversalImporter.tsx`, `src/lib/restore/commit.ts` (reuse the saga), `scripts/test-import-commit.mjs` |
| **DB impact** | Import becomes all-or-nothing |
| **Testing** | Induced failure at row N → **zero** rows committed. Idempotent re-upload still deduped via `refType: 'bulk-import'`. FY-lock honoured. |
| **Acceptance** | 1. No partial imports. 2. Existing preview/validation UX unchanged. 3. Reuses T-33's saga rather than a second implementation. |

---

### T-37 — Generalize importer to Registry + column mapping · **P1**

| | |
|---|---|
| **Files** | `src/pages/UniversalImporter.tsx`, `src/components/import/ColumnMapper.tsx`, `src/lib/import/mapping.ts`, `supabase-tables.sql`, `MIGRATIONS.sql` |
| **DB impact** | New `import_mappings` (saved profile per source system) |
| **Testing** | Import any Registry entity, not just the hardcoded 4. Mapping profile saves and replays. Per-row Hindi validation preserved. |
| **Acceptance** | 1. Entity list comes from the Registry. 2. Interactive source-header → column mapping. 3. Reusable saved profiles. |

---

### T-38 — Outbound generic bundle + published schema · **P1** · Gap EXP-09

| | |
|---|---|
| **Files** | `src/lib/migration/outbound.ts`, `src/pages/MigrationCenter.tsx`, `docs/EXPORT-SCHEMA.md`, `src/lib/navigation/*` |
| **DB impact** | None |
| **Testing** | Full CSV/XLSX bundle from the Registry. The published schema doc matches the emitted columns — assert in a test, or it will rot. |
| **Acceptance** | 1. A documented, versioned schema anyone can parse. 2. Doc and emitted columns verified in CI. 3. The doc **is** the portability guarantee, even before adapters exist. |

---

### T-39 — Tally XML outbound · **P1** · Gap EXP-09 · *D7*

| | |
|---|---|
| **Files** | `src/lib/migration/tally.ts`, `src/pages/MigrationCenter.tsx`, `scripts/test-tally-xml.mjs` |
| **DB impact** | None |
| **Testing** | Generated `ENVELOPE`/`TALLYMESSAGE` imports into Tally without error (manual, once). Masters + vouchers round-trip. Devanagari names survive. |
| **Acceptance** | 1. Masters (accounts, parties) + vouchers emitted. 2. Validated against a real Tally import at least once before merge. 3. The exit exists. |
| **Notes** | The clearest anti-lock-in signal in the product. Also the one with an obvious commercial objection — worth a deliberate decision, not a quiet drop. |

---

# PHASE 6 — Debt & Polish

---

| Task | P | Gap | Scope | Files | DB | Acceptance |
|---|---|---|---|---|---|---|
| **T-40** — GSTR-1 checksum | **P1** | EXP-08 | Compute a real checksum or delete the field. A fake `hash: 'hash'` is worse than none. | `GstSummary.tsx`, `gstExport.ts`, `scripts/test-gst-export.mjs` | none | Field is real or absent. Draft labelling retained. |
| **T-41** — Devanagari PDF font | **P2** | EXP-22 | `setupFont` returns a real Devanagari font; `₹` renders. Retires the `window.print` workaround. | `pdf.ts`, `fontLoader.ts`, `lib/dairy/slip.ts`, `vite.config.ts` | none | Hindi PDFs render. Bundle growth measured and accepted. `Rs.` → `₹`. |
| **T-42…T-44** — Consolidate inline `jsPDF` | **P2** | EXP-20 | 3 tasks × ~6 pages. Move inline generators into `pdf.ts` so auditor's certificate + signature blocks apply uniformly. | 5 pages each | none | Visual diff per page. Governance blocks now present where they were missing. |
| **T-45** — Delete dead PDF generators | **P2** | EXP-23 | Remove unwired `annualReview/p1Pdf.ts`…`p9Pdf.ts`, or wire them. | 5 files | none | Zero unreferenced exports. `test:dist` green. |
| **T-46** — API seam | **P2** | EXP-14 | Normalize the job model so a future REST tier is configuration, not rewrite. **No endpoints shipped.** | `src/lib/export/jobs.ts`, `docs/EXPORT-API.md` | none | Job state machine matches blueprint §8.1. Cursor pagination designed. No write API. |

---

## 2. Sequencing & Dependencies

```
PHASE 0  T-01 ─ T-02 ─ T-03 ─ T-04        (independent; ship now, no D1 needed)
                 │
                 ▼
PHASE 1  T-05 ─→ T-06 ─→ T-07…T-11 (parallel)
                 │           │
                 └──→ T-12 ←─┘            (drift detector needs full registry)
                     T-13                  (independent)
                 │
                 ▼
PHASE 2  T-14 ─→ T-15 ─→ T-16 ─→ T-17
                              └─→ T-18…T-22 (parallel; export-less pages FIRST)
                 │
                 ▼
PHASE 3  T-23 ─→ T-24 ─→ T-25 ─→ T-26
                      └─→ T-27 ─→ T-28 ─→ T-29        [D1]
                 │
                 ▼
PHASE 4  T-30 ─→ T-31 ─→ T-32 ─→ T-33 ─→ T-34
                                      └─→ T-35        [D1, D6]  ◄── the proof
                 │
                 ▼
PHASE 5  T-36 ─→ T-37 ─→ T-38 ─→ T-39                 [D7]

PHASE 6  T-40…T-46  (any time after Phase 1)
```

**Critical path:** T-05 → T-06 → T-12 → T-14 → T-23 → T-24 → T-30 → T-31 → T-32 → **T-33** → **T-35**.

Everything else is parallelizable or deferrable. T-33 and T-35 are where the audit's P0 actually closes; the other 44 tasks exist to make those two safe.

---

## 3. Task Count by Priority

| Priority | Tasks | Notes |
|---|---|---|
| **P0** | 22 | 4 in Phase 0 (no infra), 18 gated on D1 |
| **P1** | 15 | |
| **P2** | 9 | |
| **Total** | **46** | Each ≤ 5 files |

`[DI]` data-integrity modifier: **19 tasks**. All of Phases 3 and 4, plus T-01, T-02, T-04, T-12, T-14, T-36.

---

## 4. Two Warnings

**On T-01.** It is tempting to skip — it builds nothing. It is the most important task in the roadmap by ratio of user harm prevented to effort spent. Today a user can click "Backup Now", see a success toast, lose their Supabase project, and discover the file recovers a chart of accounts and no transactions. Every day T-01 is not shipped is a day that can happen. Phases 1–6 take months; T-01 takes an afternoon and needs no decision from anyone.

**On T-33 and T-35.** A restore that *appears* to work is more dangerous than one that visibly fails, because it ends the search for the real data. T-33 must roll back completely on replay divergence — a partial restore that balances by coincidence is the worst outcome this system can produce. T-35 is what converts "we believe the backup works" into "the backup was restored last Tuesday and the Trial Balance balanced." Do not ship the word *backup* in the UI until T-35 is green.

---

**Roadmap ends here.** No code, no branch, no ECR. Awaiting approval and a decision on D1–D7 before T-01 begins.
