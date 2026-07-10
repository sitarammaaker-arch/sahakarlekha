# Enterprise Data Portability & Backup Center — Architecture & Feature Blueprint

**Date:** 2026-07-10
**Status:** Design only. No code, no implementation, no phasing commitment.
**Predecessor:** [GAP-ANALYSIS-EXPORT-SYSTEM.md](GAP-ANALYSIS-EXPORT-SYSTEM.md) — 26 gaps (7 P0 / 11 P1 / 8 P2).
**Governs:** [CONSTITUTION.md](../../CONSTITUTION.md) Laws L1–L14 · [CLAUDE.md](../../CLAUDE.md) RULES 1–8 · [DELIVERY-FRAMEWORK.md](../../DELIVERY-FRAMEWORK.md) G0–G4.

---

## 0. The One Idea

The audit's root cause was stated as: *export is treated as a per-page presentation concern, not a data-custody responsibility.*

This blueprint inverts that. **Data custody becomes a first-class subsystem with one declarative source of truth — the Export Registry — from which all four Centers are derived.** Pages stop knowing how to export. They ask the Registry.

Everything below is a consequence of that single move.

```
                        ┌───────────────────────────┐
                        │     EXPORT REGISTRY       │  ← SSOT: every entity,
                        │  (declarative manifest)   │    column, format, scope,
                        └─────────────┬─────────────┘    capability, PII class
                                      │
        ┌──────────────┬──────────────┼──────────────┬──────────────┐
        │              │              │              │              │
   ┌────▼────┐   ┌─────▼────┐   ┌─────▼────┐   ┌─────▼─────┐  ┌─────▼─────┐
   │ EXPORT  │   │  BACKUP  │   │ RESTORE  │   │ MIGRATION │  │  EXPORT   │
   │ CENTER  │   │  CENTER  │   │  CENTER  │   │  CENTER   │  │    API    │
   └────┬────┘   └─────┬────┘   └─────┬────┘   └─────┬─────┘  └─────┬─────┘
        │              │              │              │              │
        └──────────────┴──────────────┼──────────────┴──────────────┘
                                      │
              ┌───────────────────────▼───────────────────────┐
              │  SHARED SPINE                                  │
              │  Job model · Integrity · Export History ·      │
              │  Audit · RBAC gate · FY-lock gate · Redaction  │
              └───────────────────────────────────────────────┘
```

---

## 1. Design Principles

| # | Principle | Consequence |
|---|---|---|
| P1 | **A backup that cannot restore is not a backup.** | Backup and Restore are designed as one round-trip contract, tested by round-trip, never shipped independently. |
| P2 | **Declare, don't call.** | Adding a module or a format edits the Registry, not 59 pages. |
| P3 | **Derived data is replayed, never restored.** | `voucher_entries` is rebuilt by the posting engine. Restoring rows directly would fabricate a ledger. |
| P4 | **The audit trail is evidence, not payload.** | `audit_log` is WORM. It is *exported* as a sidecar; it is **never written back**. Restoring it would forge history. |
| P5 | **Bytes never leave before the trail is written.** | Export audit is blocking and pre-delivery — the opposite of `logAudit`'s fire-and-forget contract. |
| P6 | **Integrity is verified on write and on read.** | Every artifact carries a hash; every restore verifies before it parses. |
| P7 | **Silence is the enemy.** | A partial backup, a skipped table, a dropped row must fail loudly. This is RULE 1's logic applied to custody. |
| P8 | **The exit is a feature.** | Migration Center exports *to competitors*. Lock-in by omission is a governance liability, not a moat. |

**Law mapping.** P1/P7 ← RULE 1 & L1 (no silent divergence). P3 ← RULE 2 (one formula). P4 ← L11/L12 (non-repudiation). Restore is a mutation → RULE 6 (FY-lock guard) applies. Cascades on merge-restore → RULE 3. Soft-deletes → RULE 5. All Hindi-first surfacing → RULE 7.

---

## 2. Where Things Run — The Honest Constraint

Today: **100% browser, 0 Edge Functions, `api/` holds one unrelated email function.**

A full-society ZIP backup, scheduled nightly, encrypted, hashed, and retained cannot be produced by a browser tab. This blueprint therefore introduces a server tier. **That is real new infrastructure and the single largest cost in this design.** It should be an explicit decision, not a side effect.

| Concern | Tier | Rationale |
|---|---|---|
| Per-page CSV / XLSX / PDF of on-screen data | **Client** (as today) | Small, interactive, already works. Keep it. |
| Full ZIP backup, all tables | **Server** (Edge Function) | Exceeds browser memory; needs service-role read across RLS. |
| Scheduled backup | **Server** (`pg_cron` → Edge Function) | Browsers are not always open. |
| Encryption / hashing | **Either** | WebCrypto client-side; Deno crypto server-side. Same algorithms. |
| Restore | **Server**, orchestrated | Transactional, needs posting-engine replay. |
| Large exports (>50k rows) | **Server**, async job | Streamed, cursor-paginated. |
| Migration transforms | **Client** for inbound preview; **Server** for outbound bundles | Reuses `UniversalImporter`'s validated-preview UX. |

**Fallback if the server tier is deferred:** a client-only "Full Export" that streams table-by-table into a ZIP via a streaming writer, capped and explicitly labelled *Export, not Backup*, with scheduling and encryption disabled. This is a degraded mode, and the UI must say so — never present a capped client export as a backup (P7).

---

## 3. The Export Registry — Single Source of Truth

One declarative module. Every persisted collection in the system appears here **exactly once**. Nothing else in the codebase decides what is exportable.

### 3.1 Entity descriptor — fields

| Field | Purpose |
|---|---|
| `key` | Stable identifier, e.g. `voucher`, `housing_flat`. Never renamed. |
| `table` | Supabase table name. |
| `domain` | `core` \| `member` \| `inventory` \| `trade` \| `lending` \| `payroll` \| `procurement` \| `dairy` \| `housing` \| `marketing` \| `consumer` \| `compliance` \| `governance` \| `system` |
| `label` / `labelHi` | Hindi-first display (RULE 7). |
| `capability` | Reuses `Capability` from `navigation/capabilities.ts`. Absent capability ⇒ entity hidden, not empty. |
| `minRole` | `admin` \| `accountant` \| `viewer`. Governs who may export it. |
| `columns[]` | Ordered column descriptors (below). Drives CSV/XLSX headers and column-selection UI. |
| `scope` | `society` \| `global`. Global tables (`hsn_master`) are excluded from society backups. |
| `nature` | `master` \| `transaction` \| `derived` \| `evidence` \| `system` |
| `dependsOn[]` | Entity keys that must restore first. Forms the restore DAG. |
| `softDeleteField` | Usually `isDeleted`. Drives RULE 5 filtering and the "include deleted" toggle. |
| `formats[]` | Which of CSV / XLSX / PDF / JSON this entity supports. |
| `pdfGenerator` | Optional key into a PDF generator map, for entities with a statutory print form. |
| `backupPolicy` | `full` \| `sidecar` \| `replay` \| `exclude` (see §3.3) |

### 3.2 Column descriptor — fields

`key` · `header` · `headerHi` · `type` (`string`\|`number`\|`currency`\|`date`\|`boolean`\|`enum`\|`json`) · `piiClass` (`none`\|`contact`\|`identity`\|`financial`) · `defaultVisible` · `redactable`

`piiClass` is the hook for a **Redacted Export** mode (share with a federation or an external auditor without leaking member phone/PAN/Aadhaar). It reuses the `PII_KEYS` concept already in `auditLog.ts`, promoted from a private set to a typed column property.

### 3.3 `backupPolicy` — the four custody classes

This is the design's most important classification. Each of the ~93 collections gets exactly one.

| Policy | Meaning | Restore behaviour | Examples |
|---|---|---|---|
| **`full`** | Authoritative rows. Export verbatim, restore verbatim. | Insert. | `vouchers`, `members`, `accounts`, `sales`, `purchases`, `loans`, `assets`, all domain tables |
| **`replay`** | Derived from `full` data by a deterministic engine. Exporting is optional (as a checksum); restoring rows is **forbidden**. | Regenerate by re-running the engine, then assert equality against the exported copy. | `voucher_entries`, `procurement_posting_rule_results` |
| **`sidecar`** | Immutable evidence. Export for legal custody. Never restore. | Skip. Emit one `restore` event instead. | `audit_log`, `guide_certificates` |
| **`exclude`** | Secrets, infra, or cross-tenant. Never leaves. | N/A | `user_mfa`, `user_mfa_recovery`, `platform_admins`, `society_users` credentials |

**Why `replay` matters.** Restoring `voucher_entries` rows directly, then later recomputing them, is exactly the RULE 2 failure mode — two sources for one number. Replaying the posting engine and *asserting the result matches the exported copy* turns the backup into a **conformance test of the engine itself**. If replay diverges, the restore halts and reports which vouchers disagree. That is a stronger guarantee than any competitor in the comparison set offers.

### 3.4 Schema-drift detector

The Registry knows the full table list. A build-time check (a sibling of the existing `scripts/test-*.mjs` mirror pattern) diffs Registry keys against `supabase-tables.sql`. Any table present in one and absent in the other **fails the build**.

This alone closes gap EXP-15 permanently: `recoverables`, `kachi_aarat_entries`, and `p7_entries` — which today exist in code with no DDL and no backup — become impossible to reintroduce.

---

## 4. Export Center

**Route:** `/data/export` · **Purpose:** ad-hoc, selective, human-driven extraction.

### 4.1 Surfaces

**A. Global Export Center.** Entity picker grouped by domain, honouring capabilities (a dairy society never sees housing entities). Per entity: format, column selection, date range, include-soft-deleted toggle, redaction toggle.

**B. In-page Export button.** Every module keeps its button. It now delegates: *"export entity `X` with the current filter state"*. This preserves the 59 existing call sites' UX while deleting their bespoke logic. Modules with no export today (the ~46 from the audit) gain one for free, because they are in the Registry.

**C. Report Export.** Statement-shaped outputs (Trial Balance, Balance Sheet, I&E) remain PDF-first via `pdf.ts`, but gain CSV/XLSX from the same computed rows — closing gap EXP-24.

### 4.2 Format behaviour

| Format | Contract |
|---|---|
| **CSV** | UTF-8 BOM (as today). One entity per file. RFC 4180 quoting. |
| **XLSX** | Multi-sheet by default — one sheet per selected entity, plus a `README` sheet carrying society name, FY, generated-at, filter state, and row counts. Promotes the multi-sheet capability that only 4 of 45 call sites currently use (EXP-26). |
| **PDF** | Presentation artifact only. Never a data-interchange format. Gains a **Devanagari-capable font** so RULE 7 finally holds in print, retiring the `window.print` workaround (EXP-22). |
| **JSON** | Machine-readable, schema-versioned, one envelope per entity. This is the format the API tier will serve. |

### 4.3 Export modes

- **Standard** — visible columns, active rows.
- **Full** — all columns, includes soft-deleted with an `is_deleted` column (auditors need cancelled vouchers).
- **Redacted** — all `piiClass ≠ none` columns masked. For federation/registrar sharing.
- **Statutory** — a named, versioned column set frozen to a register's legal format (Form-1, Share Register, Nomination Register).

### 4.4 Guardrails

Row-count preflight. Above a threshold, the client refuses to generate inline and offers a **server job** instead (async, notified, downloadable from Export History). Below it, generate client-side as today. This closes EXP-11 without regressing the fast path.

---

## 5. Backup Center

**Route:** `/data/backup` · **Purpose:** complete, restorable, tamper-evident custody of a society.

### 5.1 The artifact — `.slbak` (a ZIP container)

```
society-<slug>-FY2025-26-20260710T0300Z.slbak
├── manifest.json              ← the spine; hashed, optionally signed
├── data/
│   ├── accounts.ndjson        ← one JSON object per line, streamable
│   ├── members.ndjson
│   ├── vouchers.ndjson
│   ├── … one file per `full` entity (≈80 files)
├── evidence/
│   └── audit_log.ndjson       ← `sidecar` policy; read-only forever
├── derived/
│   └── voucher_entries.ndjson ← `replay` policy; kept only as a replay checksum
├── attachments/               ← future: documents, images (out of scope v1)
└── SIGNATURE                  ← detached signature over manifest.json (optional)
```

**Why NDJSON, not one JSON blob.** Streamable in and out; a corrupt line loses one row, not the file; row counts are verifiable without a full parse; and it is trivially convertible to CSV by the Migration Center.

### 5.2 `manifest.json` — fields

| Field | Purpose |
|---|---|
| `formatVersion` | Envelope version. Independent of app version. |
| `appVersion`, `schemaVersion` | Provenance; drives migration on restore. |
| `societyId`, `societyName`, `registrationNo`, `financialYear` | Identity binding. Restore refuses a mismatch unless explicitly overridden. |
| `createdAt`, `createdBy` (name/email/role) | Custody chain. |
| `trigger` | `manual` \| `scheduled` \| `pre-restore` \| `pre-migration` |
| `encryption` | `none` \| `{ algo, kdf, iterations, salt, iv }`. Never the key. |
| `entities[]` | Per entity: `key`, `table`, `policy`, `rowCount`, `bytes`, `sha256`, `columns[]` |
| `registryFingerprint` | Hash of the Registry definition used. Detects "this backup was made by a build that knew different tables." |
| `totals` | Row count, byte count, entity count. |
| `manifestHash` | SHA-256 over the canonicalized manifest minus this field. |

**The `registryFingerprint` is the anti-EXP-02 device.** A backup written by a build that knew 93 tables cannot be silently restored by a build that knows 80 — the mismatch is detected and surfaced, listing exactly which entities the current build cannot place.

### 5.3 Integrity verification

Three independent layers:

1. **Per-file** — SHA-256 of each `.ndjson`, recorded in the manifest.
2. **Manifest** — SHA-256 over the manifest itself, so entity hashes cannot be edited.
3. **Signature (optional)** — detached Ed25519 signature over `manifestHash`, using a per-society key held server-side. Proves *SahakarLekha produced this file*, which matters when a backup is submitted as audit evidence.

`.slbak` files carry a **Verify** action that runs 1–3 without restoring anything. A registrar or auditor can validate a file they were handed. Precedent exists — `lib/procurement/documents.ts` already carries a `hash` field "for tamper-evidence"; this generalizes it.

### 5.4 Password-protected backups

- **Algorithm:** AES-256-GCM over the ZIP bytes. **Not** ZIP's native ZipCrypto or AES-ZIP, both of which are weak or poorly supported.
- **Key derivation:** PBKDF2-SHA256 with a high iteration count (or Argon2id if the runtime allows), per-file random salt.
- **AEAD:** GCM authenticates the ciphertext, so tampering is detected before decryption yields anything.
- **The manifest header stays cleartext** (format version, society name, created-at, encryption params) so a user can *identify* a backup without decrypting it. Row counts and hashes live in the encrypted body.

**The hard truth, stated in the UI, in Hindi, before the first encrypted backup:**

> पासवर्ड खो गया तो यह बैकअप हमेशा के लिए बेकार है। SahakarLekha के पास कोई master key नहीं है। कोई recovery नहीं।

This is a **product decision, not a technical one**, and it needs an explicit call:

- **Option A — No escrow (recommended).** True zero-knowledge. Lost password = lost backup. Honest, defensible, and correct for books the members own.
- **Option B — Escrow.** SahakarLekha can recover. Convenient, but it means we can read every society's books, which undermines the entire integrity story.

Recommendation: **A**, with a mandatory typed confirmation and an offered *unencrypted* copy for on-premise storage.

### 5.5 Scheduled backups

| Aspect | Design |
|---|---|
| Trigger | `pg_cron` → Edge Function. Per-society schedule row. |
| Cadence | Off / Daily / Weekly / Monthly, with a time-of-day and IST anchoring. |
| Storage | Supabase Storage, private bucket, path-scoped by `society_id`, RLS-enforced. |
| Retention | GFS: keep last N daily, M weekly, K monthly. Configurable, with a hard floor. |
| Encryption | Scheduled backups **cannot** use a user password (nobody is present to type it). Options: (a) unencrypted at rest inside an already-encrypted bucket, or (b) a per-society key sealed server-side. Recommend (a) + bucket-level encryption; (b) reintroduces the escrow problem in §5.4. |
| Notification | On success: silent, timestamp updated. On **failure: loud** — in-app banner, email to admin. A silently failing backup is the exact bug this whole document exists to kill (P7). |
| Freshness | "Last successful backup" moves from `localStorage` to a `backup_runs` DB row (closes EXP-12). A staleness banner appears after a configurable threshold. |

### 5.6 Backup health surface

A dashboard card that answers, at a glance: *when did we last have a restorable copy?* Shows last success, last verify, entity coverage (`93/93 tables`), and the result of the most recent **automated restore rehearsal** (§6.5). A green tick here is the only honest claim that data is safe.

---

## 6. Restore Center

**Route:** `/data/restore` · **Purpose:** turn a `.slbak` back into a working society, or fail without touching anything.

### 6.1 Restore is a mutation

RULE 6 applies: **`society.fyLocked` blocks restore** with a destructive toast. RULE 5 applies: soft-deleted rows restore *as soft-deleted*, never resurrected. RULE 3 applies on merge: cascades and orphan-links are re-established, not left dangling.

### 6.2 The workflow — six gates, each abortable

```
 1. UPLOAD & IDENTIFY   → read cleartext manifest header. Show society, FY, created-at,
                          trigger, encryption status. Nothing parsed yet.
 2. DECRYPT             → password prompt if encrypted. GCM auth failure = stop, "file
                          tampered or wrong password". No partial read.
 3. VERIFY INTEGRITY    → per-file SHA-256, manifest hash, signature. Any mismatch = stop.
 4. COMPATIBILITY       → compare registryFingerprint / schemaVersion. Run forward
                          migrations if the backup is older. If newer than this build:
                          refuse. Never guess.
 5. DRY-RUN DIFF        → the heart of the design (§6.3). Read-only. Mandatory.
 6. COMMIT              → transactional, DAG-ordered, with replay + assertion (§6.4).
```

No step may be skipped. Step 5 cannot be bypassed even by an admin.

### 6.3 Dry-run diff — mandatory, read-only

Before a single row is written, the user sees, per entity, in Hindi:

| | Insert | Update | Conflict | Skip |
|---|---|---|---|---|
| सदस्य (Members) | 412 | 0 | 3 | 0 |
| वाउचर (Vouchers) | 8,214 | 0 | 0 | 0 |
| खाता शीर्षक (Accounts) | 0 | 0 | 0 | 87 |

**Conflicts** (same natural key, different content) are itemized with a before/after view and a per-conflict resolution: *keep existing* / *take from backup* / *abort*. This is what today's restore lacks entirely — it dedupes by name and silently drops (EXP-13).

### 6.4 The three modes

| Mode | Precondition | Behaviour |
|---|---|---|
| **Fresh** | Target society is empty. | Straight insert in `dependsOn` DAG order. The only mode that fully round-trips. |
| **Merge** | Target has data. | Natural-key matched. Conflicts surfaced in dry-run. Cascades re-linked (RULE 3). |
| **Replace** | Explicit, typed confirmation. | Snapshot current state to a `pre-restore` backup first (`trigger: 'pre-restore'`), *then* wipe and insert. **The safety net is not optional.** |

### 6.5 Commit sequence

1. Open transaction (or a saga with a compensating rollback if the Edge runtime forbids long transactions).
2. Insert `full` entities in DAG order.
3. **Replay** `derived` entities via the posting engine.
4. **Assert** replayed `voucher_entries` equal the exported copy. On divergence: **roll back**, and report the disagreeing voucher IDs. A backup that will not reproduce its own ledger is not restorable, and saying so is more valuable than restoring it wrong.
5. Skip `sidecar` (P4). Skip `exclude`.
6. Write **one** `audit_log` event: `action: 'restore'`, entityType `society`, with the manifest hash, entity counts, mode, and actor. This is how the WORM trail records that history was reloaded — without ever overwriting history.
7. Recompute aggregates and re-verify: Trial Balance balances, stock formula (RULE 2), share-capital reconciliation. Surface the result.

### 6.6 Restore rehearsal (the feature that makes P1 true)

A scheduled job that takes the latest backup, restores it into a **throwaway shadow society**, runs the assertions in step 7, and discards it. Result feeds the Backup Health card (§5.6).

This is the only mechanism that can honestly claim *"your backup works"* — because it was restored last night. Without it, every other guarantee in this document is theoretical. **It is the single highest-value item in this blueprint.**

---

## 7. Migration Center

**Route:** `/data/migration` · **Purpose:** get data in from anywhere; get data out to anywhere. P8.

### 7.1 Inbound — promote, don't rebuild

`UniversalImporter` is already good: validated preview, per-row Hindi errors, FY-window checks, FY-lock honoured, idempotent re-upload via `refType: 'bulk-import'`. It becomes the **Inbound engine**, generalized from 4 hardcoded entities to *any Registry entity*, and fixed on two counts the audit found:

- **Transactional commit** — a mid-loop failure currently leaves a partial import (EXP-17). Wrap in the same saga the Restore Center uses.
- **Opening balances to Supabase, not `localStorage`** (EXP-16). This is a live RULE 1 violation and should arguably be fixed independently of this design.

Adds: **interactive column mapping** (source header → Registry column), with a saved, reusable mapping profile per source system.

### 7.2 Inbound adapters

| Source | Shape |
|---|---|
| Tally | CSV/Excel day-book & masters export → mapping profile |
| ERPNext / Odoo | Standard CSV export → mapping profile |
| Excel / generic CSV | Free mapping |
| SahakarLekha `.slbak` | Delegates to Restore Center |

### 7.3 Outbound — the exit

This is the answer to the audit's lock-in finding. Bundles are generated from Registry data; nothing bespoke per page.

| Target | Artifact |
|---|---|
| **Tally** | Tally XML (`ENVELOPE` / `TALLYMESSAGE`) — masters + vouchers |
| **ERPNext** | Its Data Import CSV bundle (Chart of Accounts, Party, Journal Entry) |
| **Odoo** | Its import CSV bundle |
| **Generic** | Full CSV/XLSX bundle + a **published, versioned schema document** |

The schema document matters as much as the code: a documented format anyone can parse *is* portability, even before an adapter exists.

### 7.4 Statutory outbound — scoped out, deliberately

Certified files (NSDL FVU, GSTN offline JSON with real checksums, e-invoice IRN) require external utilities, GSP integration, and certification. They are **not** in this design. What *is* in scope: every such file must be **labelled as a draft** in the UI and in the payload, as `gstExport.ts` already does. The `hash: 'hash'` placeholder in GSTR-1 ([GstSummary.tsx:530](../../src/pages/GstSummary.tsx:530)) must either compute a real checksum or be removed — a fake checksum field is worse than none.

---

## 8. Shared Spine

### 8.1 Job model

Every operation — export, backup, restore, migration — is a **job**, whether it runs for 40ms in the browser or 4 minutes on the server. One state machine: `queued → running → verifying → succeeded | failed | cancelled`, with `progress`, `rowsProcessed`, `error`, `artifactUrl`, `expiresAt`.

This uniformity is what makes §9 (the API) a configuration change rather than a rewrite.

### 8.2 Export History

**Route:** `/data/history`. Every job, forever, per society.

Shows: who, what entities, which format, row count, mode (standard/full/redacted/statutory), filters applied, artifact hash, byte size, IP/device, outcome, and re-download (until `expiresAt`).

This is the compliance surface. Under DPDP, *"who took the member list, and when"* must be answerable. Today it is not (EXP-05).

### 8.3 Export audit — a different contract from `logAudit`

`logAudit` is explicitly non-blocking and swallows failures ([auditLog.ts:77](../../src/lib/auditLog.ts:77)) — correct for business writes, where a logging outage must never roll back a voucher.

**Export inverts this.** The trail is written *before* bytes are delivered, and a failure to write the trail **aborts the export**. Untraceable bulk PII extraction is precisely the thing being prevented; an untraced export is worse than a failed one.

Concretely: extend `AuditAction` with `'export'` and `'restore'`, and give the export path a **blocking** sibling of `logAudit` rather than reusing it. Same table, same redaction, opposite failure semantics. This nuance must be written down, or someone will "helpfully" reuse `logAudit` and silently reopen EXP-05.

### 8.4 Authorization

Reuses `Role` and `Capability` from `navigation/capabilities.ts` — no parallel system.

| Action | Requires |
|---|---|
| Export own-module data | `viewer` + module capability |
| Export with PII (unredacted) | `accountant` |
| Full ZIP backup | `admin` |
| Restore (Fresh/Merge) | `admin` + typed confirmation |
| Restore (Replace) | `admin` + typed society name + mandatory pre-restore backup |
| Schedule config | `admin` |
| View Export History | `admin` (own society only) |

Entity-level export is denied by default; the Registry grants it. An entity with no `minRole` is not exportable.

*(Note: the 3-role model here is `admin | accountant | viewer`. The 17-role assignment work tracked under ECR-06 will subsume this — the Registry should reference role **keys**, not literals, so it survives that migration.)*

---

## 9. API Export Readiness

**Not built now.** The goal is that building it later is a *configuration* change, not an architectural one. Three seams make that true:

1. **The Registry** already declares every entity, its columns, its capability, and its minimum role. That is an API surface specification.
2. **The Job model** already expresses async work with artifacts and expiry. That is a REST job resource.
3. **JSON export** already emits schema-versioned envelopes. That is the response body.

When the API is built, it needs only:

| Concern | Design intent |
|---|---|
| Auth | Scoped, revocable service tokens (per-society, per-entity, read-only). Never the user's JWT. |
| Endpoints | `GET /entities` (from Registry) · `GET /entities/{key}` (cursor-paginated) · `POST /exports` (create job) · `GET /exports/{id}` · `GET /exports/{id}/artifact` (short-lived signed URL) |
| Pagination | Keyset/cursor on `(created_at, id)`. Never `OFFSET` — it drifts under concurrent writes. |
| Rate limiting | Per token. Backups are expensive. |
| Webhooks | `backup.succeeded`, `backup.failed`, `export.ready`. |
| Audit | Identical to §8.3. An API export is an export. |

**Explicit non-goal:** a write API. Data-in stays behind the Migration Center's validated preview. An unguarded write API would bypass every RULE the Constitution encodes.

---

## 10. Data Model Additions

Described as field lists, not DDL.

| Table | Key fields | Notes |
|---|---|---|
| `export_jobs` | `id`, `society_id`, `kind` (export/backup/restore/migration), `status`, `trigger`, `entities[]`, `format`, `mode`, `filters`, `row_count`, `byte_size`, `artifact_path`, `artifact_sha256`, `expires_at`, `actor_*`, `error`, timestamps | The Export History + the API's job resource. |
| `backup_schedules` | `society_id`, `cadence`, `time_of_day`, `timezone`, `retention_daily/weekly/monthly`, `enabled`, `last_run_at`, `last_success_at` | One row per society. |
| `backup_runs` | `id`, `schedule_id`, `job_id`, `outcome`, `manifest_hash`, `entity_count`, `verified_at`, `rehearsal_outcome` | Replaces the `localStorage` timestamp (EXP-12). Feeds Backup Health. |
| `restore_runs` | `id`, `society_id`, `source_manifest_hash`, `mode`, `diff_summary`, `replay_assertion`, `outcome`, `pre_restore_job_id` | The restore's own trail; complements the single `audit_log` event. |
| `audit_log` | *(extend)* `action` enum gains `export`, `restore` | Still WORM. Still `sidecar`. |

RLS on all four: `society_id` scoped, mirroring existing policy shape. `export_jobs.artifact_path` points into a private Storage bucket; artifacts are served only via short-lived signed URLs.

---

## 11. Per-Module Export Coverage

**Target: 93/93 collections, zero exceptions.** Coverage is a Registry property, so "which modules export" stops being a question anyone can answer wrong.

By domain — `F` = full backup · `S` = sidecar · `R` = replay · `X` = exclude:

| Domain | Collections | CSV | XLSX | PDF | JSON | Backup |
|---|---|---|---|---|---|---|
| Core accounting (vouchers, accounts, day book, ledgers) | 6 | ✅ | ✅ | ✅ | ✅ | F |
| Derived ledger (`voucher_entries`) | 1 | ✅ | ✅ | — | ✅ | **R** |
| Members & share (members, share register, nomination, Form-1) | 4 | ✅ | ✅ | ✅ statutory | ✅ | F |
| Inventory (items, movements, valuation, godowns, branches) | 5 | ✅ | ✅ | ✅ | ✅ | F |
| Trade (sales, purchases, returns, suppliers, customers, HSN) | 8 | ✅ | ✅ | ✅ | ✅ | F |
| Lending & deposits (loans, KCC, deposit accts/txns, recoverables) | 6 | ✅ | ✅ | ✅ | ✅ | F |
| Payroll & labour (employees, salary, workers, advances, muster, PF/ESI, departments, work orders) | 10 | ✅ | ✅ | ✅ | ✅ | F |
| Procurement engine (farmers, lots, J-forms, intents, settlements, counters…) | 16 | ✅ | ✅ | ✅ | ✅ | F + **R** for `posting_rule_results` |
| Dairy (rate charts, milk entries, settlements, dispatches, inputs, distribution) | 6 | ✅ | ✅ | ✅ | ✅ | F |
| Housing (flats, bills, charge heads, funds, complaints, parking, transfers, insurance, AMC, docs, buildings) | 11 | ✅ | ✅ | ✅ | ✅ | F |
| Marketing masters (crops, varieties, seasons, agencies, centres, MSP, deductions, specs, bardana, transporters) | 10 | ✅ | ✅ | — | ✅ | F |
| Consumer (price lists, patronage, POs, sales/purchase returns) | 5 | ✅ | ✅ | ✅ | ✅ | F |
| Compliance & tax (GST, TDS entries/challans, filings, e-way bills, bank recon, budgets) | 9 | ✅ | ✅ | ✅ draft | ✅ | F |
| Governance (meetings, elections, audit objections, board) | 5 | ✅ | ✅ | ✅ statutory | ✅ | F |
| Evidence (`audit_log`, `guide_certificates`) | 2 | ✅ | — | — | ✅ | **S** |
| System (`user_mfa`, `platform_admins`, `society_users`) | 3 | — | — | — | — | **X** |
| Global (`hsn_master`) | 1 | ✅ | ✅ | — | ✅ | scope: global |

The `X` row is the only place data is deliberately withheld, and the reason is that it is either a secret or belongs to another tenant. Every other byte a society owns, a society can take.

---

## 12. Open Decisions

These require a product call before any planning proceeds.

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Build the server tier?** Edge Functions + Storage + `pg_cron` are new infrastructure. Without them: no scheduled backup, no large export, no restore rehearsal. | **Yes.** Without it this is a better export UI, not a backup system. |
| D2 | **Password escrow?** (§5.4) | **No escrow.** Zero-knowledge, with a blunt Hindi warning. |
| D3 | **Scheduled-backup encryption at rest?** Nobody can type a password at 3 AM. | Bucket-level encryption, no per-file password. Revisit if a customer demands it. |
| D4 | **`.slbak` or plain `.zip`?** | Custom extension. It signals "this is not a folder of CSVs" and prevents users hand-editing a hashed artifact. |
| D5 | **Retention floor?** How few backups may a society keep? | Hard floor of 7 daily + 4 weekly, not user-reducible. |
| D6 | **Restore rehearsal cadence** (§6.6) — nightly is expensive. | Weekly per society; nightly for paid tiers. |
| D7 | **Does the outbound Tally XML adapter ship at all?** It is the clearest anti-lock-in signal and the clearest revenue risk. | Ship it. The lock-in is accidental (audit §7); leaving it in place converts an accident into a policy. |

---

## 13. What This Blueprint Does Not Do

Stated plainly, so nobody infers coverage that isn't here:

- **No certified statutory files.** No FVU, no GSTN-validated JSON, no e-invoice IRN. Those need external certification and are out of scope. Drafts stay labelled as drafts.
- **No attachment/document backup.** `housing_documents` rows are backed up; the underlying files are not. Deferred to v2.
- **No point-in-time recovery.** Backups are snapshots. PITR is a Supabase-tier concern, not an application feature.
- **No write API.**
- **No cross-society consolidation export.** `MultiSocietyConsolidation` remains a report, not a portability surface.
- **No implementation, sequencing, estimate, or ECR.**

---

## 14. The Test That Decides Whether This Worked

One sentence, and it is not about formats:

> **Take last night's scheduled backup. Restore it into an empty society. Assert the Trial Balance balances, the stock formula reconciles, and the replayed `voucher_entries` match the exported copy — byte for byte.**

If that runs green, unattended, every week, then SahakarLekha has a backup system. If it does not, it has a download button — which is precisely what the audit found.

Everything else in this document exists to make that sentence executable.

---

**Design ends here.** Per the build-mode operating rule: no implementation, no ECR, no branch. Awaiting explicit approval and a decision on D1–D7 before any planning begins.
