# SahakarLekha — Sprint-1 Review + Sprint-2 Development Plan

**Nature:** Review of the committed Sprint-1 work (`feat/sprint1-rbac-foundation`, commit 757ec81) + the Sprint-2 plan. Planning artifact — no code changes here. **Prepared:** 2026-07-08.

---

## Part A — Sprint-1 Review

**Delivered:** SL-05 RBAC model foundation only — `src/lib/rbac.ts` (17 roles × 14 permissions, `can()`, legacy shim), `scripts/test-rbac.mjs` (144 assertions), `test:rbac` script. **Deferred:** SL-01 (audit log), SL-02 (overlay persistence), SL-03 (soft-delete parents).

**Quality checks (re-run at review):**
- `npm run test:rbac` → **144 pass / 0 fail.**
- `test:nav` → still green (no regression); **additive-only** confirmed (no route/UI/AuthContext/DataContext edits).
- `tsc --noEmit` → clean; `Record<Role, …>` **enforces all 17 roles at compile time**.
- `eslint src/lib/rbac.ts scripts/test-rbac.mjs` → **clean (exit 0)**.
- Matrix re-verified **row-by-row** against Blueprint 3.3 Table 2 — faithful transcription (✓/◐ → granted, ✗ → denied), all 17 rows correct.
- Unknown/invalid role → `can()` returns **false** (fail-closed) — safe default.

### Bugs
| # | Severity | Bug | Detail | Fix window |
|---|---|---|---|---|
| **B1** | **High (latent)** | **Scoped permissions (`◐`) collapse to `true`** | The blueprint marks several cells `◐ scoped` (e.g. `delete` for superAdmin/societyAdmin/secretary is "non-financial / soft only"). `can()` returns bare `true`, so `can('societyAdmin','delete')` = true. **Nothing calls `can()` yet, so it is inert today** — but if SL-06 consumes it naively it would authorize hard-delete of financial records, violating the soft-delete-only rule (CLAUDE.md RULE 3/5). Must be resolved **with** SL-06. | Sprint-2 (S2-4) |
| **B2** | Medium | **Test mirrors the matrix instead of importing it** | `test-rbac.mjs` re-declares `PERMISSION_MATRIX` (the repo's `test-nav` convention). A future edit to `src/lib/rbac.ts` could pass tests while the mirror drifts. | Sprint-2 (S2-4) |

*No functional/correctness bug affects current behaviour — the change is inert and additive.*

### Remaining issues (design gaps, not defects)
| # | Issue | Note |
|---|---|---|
| R1 | **`can()` is coarse — role × permission only** | Blueprint 3.3 envisions **role × permission × resource/module** + **tenant/branch scope**. Current signature can't distinguish "delete a draft voucher" vs "delete a member", and carries no tenant/branch. Extend in S2-4. |
| R2 | **Scope model absent** | `◐` (own-branch / with-approval / dual-control) is not represented; `can()` is boolean. Needed for delete/unlock/FY-close correctness. |
| R3 | **`can()` is dead code** | Nothing consumes it until SL-06 — expected (foundation-only), but means it is unexercised in the running app. |
| R4 | **Sprint-1 integrity substrate incomplete** | SL-01/02/03 (audit log, overlay persistence, soft-delete) — the actual foundation the transformation depends on — remain open and are the top of Sprint-2. |
| R5 | **Super-admin cross-tenant not modelled** | `can()` has no tenant dimension; the only cross-tenant role (superAdmin) needs an explicit scope flag. |

---

## Part B — Sprint-2 Development Plan

**Theme:** *Complete the integrity substrate + begin RBAC enforcement.* Re-prioritised because Sprint-1 shipped only SL-05: the deferred P0 substrate (SL-01/02/03) now leads Sprint-2, ahead of MFA/session (which move to Sprint-3). Every migration is user-run (CLAUDE.md); all client code degrades gracefully pre-migration; RULE-1 rollback + RULE-8 encoding respected throughout.

**Stories:** S2-1 SL-01 · S2-2 SL-02 · S2-3 SL-03 · S2-4 SL-06 (+ B1/B2/R1/R2 fixes) · S2-5 SL-07. (SL-08 MFA, SL-09 session → Sprint-3.)

### S2-1 — Append-only audit log (SL-01) · P0 · L · Risk High
**Approach.** New `audit_log` table (INSERT-only RLS, no UPDATE/DELETE = WORM): `id, society_id, actor_email, actor_role, entity_type, entity_id, action, before jsonb, after jsonb, reason, source, created_at`. A `src/lib/auditLog.ts` helper `logAudit(event)` (buffered, retrying, non-blocking) called from the write layer in `DataContext` — the `persistVoucher` path and every `add*/update*/cancel*/approve*/reject*/delete*`. Replaces the scattered `console.info('[AUDIT-DELETE]')` lines.
**Sub-tasks.** schema+WORM RLS · `logAudit` + before/after diff · wire voucher CRUD/approve/reject · wire member/purchase/asset/objection mutations · buffered retry + visible-on-persistent-failure · admin/auditor read view · retention (≥10 yr) + PII redaction.
**AC.** One immutable event per mutation/approval with actor/time/before/after/reason; DB rejects UPDATE/DELETE; log failure never blocks or rolls back the business write; auditor/admin-only read.
**Depends on:** —. **Cx:** L.

### S2-2 — Guarantee overlay persistence (SL-02) · P0 · M · Risk Med
**Approach.** Split `persistVoucher`'s step-2 "extras" into **audit-critical** (`editHistory`, `approvalStatus/approvedBy/approvedAt/approvalRemarks`) vs **cosmetic**. Move audit-critical fields to **base columns** (migration) so they ride step-1's verified upsert; keep two-step tolerance for cosmetic only. Pre-migration, a critical-field failure becomes a **RULE-1 rollback + destructive toast** (not a mild "saved partially"). Apply the same split to `syncStockItemExtras` (`valuationMethod`).
**Sub-tasks.** migration (base columns) · bucket-split in `persistVoucher` · critical-field hard-fail path · stock-item extras split · regression: cosmetic tolerance retained.
**AC.** `editHistory`/approval persist atomically post-migration; pre-migration critical failure rolls back visibly; cosmetic overlays keep graceful degradation.
**Depends on:** S2-1 (the audit event carries the diff as a second safety net). **Cx:** M.

### S2-3 — Soft-delete all parent records (SL-03) · P0 · M · Risk Med
**Approach.** Add `isDeleted` (+ audit columns) to `members/purchases/assets/audit_objections` (migration). Convert `deleteMember`/`deletePurchase`/`deleteAsset`/`deleteAuditObjection` to set `isDeleted` (RULE-1 rollback) — keep the existing dependent cascades. **Read-path sweep:** every consumer must filter `isDeleted` (member lists, `getMemberLedger`, purchase/stock/`getTradingAccount`, `assets`/`postDepreciation`, `auditObjections` on Dashboard + VoucherApproval counts) — mirror the proven `activeVouchers = filter(!isDeleted)` pattern. Route deletions through `logAudit` (S2-1). Admin-only restore.
**Sub-tasks.** migration · convert 4 delete fns · grep-driven read-path sweep + PR checklist · restore fn · regression (cascades fire; ghost-record leak test).
**AC.** No parent row ever removed from DB; deleted records vanish from all lists/reports/counts; cascades unchanged; restore works; every delete/restore logged.
**Depends on:** S2-1. **Cx:** M.

### S2-4 — Route authorization + `can()` hardening (SL-06 + B1/B2/R1/R2) · P0 · L · Risk High
**Approach.** (1) **Fix B1/R2:** extend the model so `◐ scoped` is explicit — represent grants as `'full' | 'scoped' | 'none'` (or a parallel scope map), and make `can(role, permission, resource?, scope?)` **deny financial-record delete** even where `delete` is granted (hard rule). (2) **Fix R1:** add a **resource/module + tenant/branch** dimension to `can()`. (3) **Fix B2:** make `test-rbac.mjs` import the matrix (JSON or generated) so it can't drift — or add a checksum guard. (4) **SL-06 proper:** consume `can()` in the route guard (`CapabilityGuard`/`ProtectedRoute`) — **deny-by-default**, every route mapped to a required (permission, resource); non-catalog routes denied; keep parity with the legacy shim behind a feature flag; RLS parity note for SL-07.
**Sub-tasks.** scope-aware model + `can()` v2 · financial-delete hard-deny · resource/tenant/branch params · test de-drift · route→permission map · deny-by-default guard + feature flag · legacy-parity + RLS parity tests.
**AC.** Every route role+permission gated; non-catalog denied; scoped delete never authorizes financial hard-delete; test cannot pass on a drifted matrix; legacy behaviour preserved behind flag.
**Depends on:** SL-05 (done). **Cx:** L.

### S2-5 — Segregation of duties + export gating (SL-07) · P1 · M · Risk Med
**Approach.** Enforce entry ≠ approval ≠ audit ≠ config using `can()` (e.g. a user who created a voucher cannot approve it); gate **export/print** by the `export`/`print` permission and **log every export** to the audit log (S2-1). 
**Sub-tasks.** SoD rule checks at approve/config actions · export/print permission gate on report pages · export event → `logAudit` · tests.
**AC.** Creator cannot approve own entry; unpermitted roles cannot export/print financials; every export logged.
**Depends on:** S2-1 (log), S2-4 (`can()` in guards). **Cx:** M.

### Sequencing (Sprint-2)
1. **S2-1 (audit log)** first — S2-2/S2-3/S2-5 all emit/rely on it.
2. **S2-2 + S2-3 in parallel** (both touch `DataContext` + share the migration).
3. **S2-4** (RBAC enforcement + `can()` hardening) — independent of S2-1/2/3; start in parallel, but its financial-delete hard-deny should land **before** S2-3's soft-delete is wired to any `can()` check.
4. **S2-5** last (needs S2-1 + S2-4).
**One consolidated migration** (audit_log + audit-critical base columns + `isDeleted` on 4 tables) — communicate to the user once.

### Definition of Done (Sprint-2)
All ACs met + tests green (`test:rbac` de-drifted, new tests for log/soft-delete) · one documented migration; graceful pre-migration degradation · **no hard-delete of any parent remains (grep-verified)** · no audit-critical field can be silently lost · scoped delete cannot hard-delete financial records · `/code-review` ≥ high clean · verify skill on the changed save/delete/approve/route flows · RULE-8 encoding on edited Hindi files.

### Out of scope (Sprint-2)
MFA (SL-08), session hardening + auth consolidation (SL-09) → Sprint-3. Approval-gates-posting + workflow (SL-10/11/12/13) → Sprint-3. Any P2/P3 breadth.

### Risks
| Risk | Mitigation |
|---|---|
| Audit-log wiring touches many `DataContext` sites | Single choke-point in the write layer where possible; per-function checklist; verify skill |
| Soft-delete read-path leak (ghost records) | Grep-driven consumer sweep + explicit leak test per entity |
| `can()` v2 breaks legacy access | Feature flag + legacy-parity test; RLS parity before enforcing |
| Migration lag (user hasn't run SQL) | Critical fields hard-fail (rollback) rather than silent-save; helpers no-op gracefully |
| B1 financial-delete over-authorization | Hard-deny financial-record delete in `can()` regardless of matrix grant |

*End of Sprint-1 Review + Sprint-2 Plan — planning artifact; no code, no changes. STOP.*
