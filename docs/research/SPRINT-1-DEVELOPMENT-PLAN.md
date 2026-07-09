# SahakarLekha — Sprint 1 Development Plan

**Source:** Phase 5.1 Engineering Backlog. **Sprint theme:** *Integrity substrate + RBAC start.* **Nature:** development plan (design & task breakdown), not implementation. Grounded in the current codebase; every change respects CLAUDE.md RULES 1–8 and the Delivery Framework gates. **Prepared:** 2026-07-08.

**Stories in this sprint:** SL-01 (append-only audit log), SL-02 (guarantee overlay persistence), SL-03 (soft-delete parent records), SL-05 (RBAC model — foundation only). All four are P0.

---

## Implementation status (2026-07-08)

| Story | Status | Notes |
|---|---|---|
| **SL-05 — RBAC model foundation** | ✅ **Delivered** | `src/lib/rbac.ts` (17 roles × 14 permissions matrix from Blueprint 3.3, `can()`, legacy-role shim); `scripts/test-rbac.mjs` (`npm run test:rbac` → **144 assertions pass**). **Additive-only** — no route/UI/AuthContext change, so zero regression (`test:nav` still green; tsc clean). Ready for SL-06 to adopt `can()`. |
| SL-01 — Audit log | ⏸ **Deferred** | Requires the new `audit_log` table (migration) + `logAudit()` wired into ~10 call sites in the 5,124-line `DataContext.tsx`. Cannot be done within the 5-file / no-unrelated-changes budget without broad engine edits. |
| SL-02 — Overlay persistence | ⏸ **Deferred** | Edits the `persistVoucher` two-step (extras bucket split) + a migration — engine-touching; same budget constraint. |
| SL-03 — Soft-delete parents | ⏸ **Deferred** | Converts 4 `delete*` functions + a read-path sweep across many consumers + a migration — highest leak risk; needs its own focused change-set. |

**Rationale:** SL-05 is the only Sprint-1 story that is fully self-contained (new files, additive, unit-tested) and therefore safely shippable under the *max-5-files / no-unrelated-changes / financial-engine* constraints. SL-01/02/03 each require edits across `DataContext.tsx` plus a schema migration and are scheduled as their own commits (recommended order: SL-01 → SL-02 → SL-03, per §6 sequencing).

**Assumptions:** ~2-week sprint; the schema lives in `supabase-tables.sql` (+ `MIGRATIONS.sql`); the client engine is `src/contexts/DataContext.tsx`; auth is `src/contexts/AuthContext.tsx` + `src/lib/navigation`. Every migration is user-run in the Supabase SQL editor (per CLAUDE.md), so all client code must degrade gracefully until the migration is applied.

---

## 1. Sprint Goal
Lay the **integrity substrate** the rest of the transformation depends on: a system-wide append-only audit trail, guaranteed persistence of audit-critical overlay fields, and soft-delete of all parent records — plus the **RBAC data model** (roles + permission catalog + check function) that unblocks Sprint 2's route authorization. No user-visible workflow change beyond "deletes now archive instead of erase."

**Definition of sprint success:** (a) every create/update/delete/approve across the app writes an immutable audit event; (b) no audit-critical field is ever silently lost on save; (c) no parent record is ever hard-deleted; (d) a permission model + `can(user, action, resource)` function exists and is unit-tested, with the legacy 4-role behaviour preserved behind it.

---

## 2. Story SL-01 — Append-only (WORM) audit-log service · P0 · L · Risk: High

**Objective.** One immutable log capturing who/what/when/before/after/reason for every mutation, approval, and (later) export — replacing today's scattered `console.info('[AUDIT-DELETE]')` lines and the per-voucher `editHistory`.

**Current state.** No system-wide log. Evidence today: voucher `editHistory[]`, `deletedReason/deletedBy/deletedAt`, and console logs in `deleteMember/deletePurchase/deleteAsset/deleteAuditObjection`.

**Technical approach.**
- New `audit_log` table (append-only; no UPDATE/DELETE grants): `id, society_id, actor_email, actor_role, entity_type, entity_id, action, before jsonb, after jsonb, reason, source, created_at`. RLS: INSERT-only for authenticated; SELECT scoped to society admins/auditors; **no update/delete policy** (WORM).
- A single client helper `logAudit(event)` invoked from the write layer in `DataContext` (the `persistVoucher` path and each `add*/update*/delete*/approve*/reject*` function). Fire-and-forget with local buffering + retry so a log failure never blocks the business write, but a **persistent** failure surfaces a non-blocking warning.
- Standard event builder that diffs `before`/`after` for the changed entity.

**Sub-tasks.**
1. Schema + WORM RLS in `supabase-tables.sql`; note migration for the user to run.
2. `logAudit()` helper + event/diff builder (`src/lib/auditLog.ts`).
3. Wire into voucher add/update/cancel/approve/reject; member/purchase/asset/objection add/update/delete.
4. Buffered retry + failure surfacing (no business-write blocking).
5. Read API + a minimal admin/auditor view (list, filter by entity/actor/date).
6. Retention policy note (≥10 years) + PII redaction rules for `before/after`.

**Acceptance criteria.**
- Every create/update/delete/approve/reject writes exactly one audit event with actor, timestamp, before/after, reason.
- The table rejects UPDATE/DELETE at the DB (WORM verified).
- A log write failure does not roll back or block the business write; repeated failure raises a visible warning.
- Auditor/admin can list & filter events for their society; other roles cannot read.

**Test plan.** Unit: diff builder, event shape. Integration: each wired function emits one event; WORM rejection of UPDATE/DELETE; RLS scoping. Manual: perform a voucher edit → verify before/after.

**Risks.** Volume/perf (mitigate: async + batched). PII in `before/after` (mitigate: redaction of KYC fields). Migration-lag (mitigate: helper no-ops gracefully if table absent, logs to console fallback until migrated).

---

## 3. Story SL-02 — Guarantee overlay persistence · P0 · M · Risk: Med

**Objective.** Stop the silent loss of **audit-critical overlays** — `editHistory`, `approvalStatus/approvedBy/approvedAt/approvalRemarks` — which today ride the best-effort "step-2 extras patch" in `persistVoucher` and can fail with only a mild "saved partially" toast while the base row persists.

**Current state.** `persistVoucher` (DataContext ~L949–1040): step 1 upserts base columns + verifies the row; step 2 `.update()` patches extras (`lines, refType, approvalStatus, editHistory, costCentreId, …`) and is *allowed to fail* (schema-cache tolerance). Same pattern for stock-item extras (`salesAccountId/purchaseAccountId/valuationMethod`).

**Technical approach.**
- **Classify overlays into two tiers:** *audit-critical* (`editHistory`, approval fields) vs *cosmetic/derivable* (refType, costCentreId, routing hints). Keep the two-step tolerance only for the cosmetic tier.
- Ensure the audit-critical columns **exist as base columns** (migration in `supabase-tables.sql`) so they go in step 1's upsert, not the tolerant patch.
- For any environment where the migration is not yet applied, treat a step-2 failure on an audit-critical field as a **hard failure** (roll back + destructive toast, RULE 1) rather than a mild warning.
- Complement with SL-01: the audit event itself carries `approvalStatus`/edit diff, so the trail survives even a DB hiccup.

**Sub-tasks.**
1. Add audit-critical overlay columns as base columns (migration).
2. Split `persistVoucher` extras into critical vs cosmetic buckets; put critical in the base upsert.
3. Upgrade critical-field step-2 failure (pre-migration path) from warning → RULE-1 rollback.
4. Apply the same split to `syncStockItemExtras` for `valuationMethod` (audit-relevant for valuation basis).
5. Regression test the two-step still tolerates cosmetic-column absence.

**Acceptance criteria.**
- `editHistory` and approval fields persist atomically with the base voucher (post-migration) — never a "saved partially" outcome for them.
- Pre-migration, a critical-field save failure rolls back local state with a destructive toast (no silent divergence).
- Cosmetic overlays retain today's graceful degradation.

**Test plan.** Simulate schema-cache miss on a critical column → expect rollback, not partial-save. Verify approval + edit survive a normal save. Unit: bucket-split logic.

**Risks.** Migration coordination (the base-column move needs the user to run SQL) — mitigate with the pre-migration hard-fail path so integrity holds either way.

---

## 4. Story SL-03 — Soft-delete all parent records · P0 · M · Risk: Med

**Objective.** Members, purchases, assets, and audit objections must never be hard-deleted (statutory-record loss). Replace `supabase.…delete()` on the parent with an `isDeleted` archive, preserving the existing dependent cascades (which already soft-cancel linked vouchers per RULE 3).

**Current state.** Hard-delete sites: `deleteMember` (~L1780), `deletePurchase` (~L4198), `deleteAsset` (~L3175), `deleteAuditObjection` (~L1548). Each already cascades to dependents but then `.delete()`s the parent + logs to console. (Vouchers already soft-delete via `isDeleted`; TDS entries already have `isDeleted`.)

**Technical approach.**
- Add `isDeleted` (+ `deletedAt/deletedBy/deletedReason`) to `members`, `purchases`, `assets`, `audit_objections` (migration).
- Change the four `delete*` functions to set `isDeleted = true` (RULE-1 rollback on sync failure) and keep the existing dependent-cascade blocks unchanged.
- **Filter reads:** every consumer of these lists must exclude `isDeleted`. Audit the read paths — member lists, `getMemberLedger`, purchase registers, `getTradingAccount`/stock (purchases), `assets`/`postDepreciation`, `auditObjections` (Dashboard compliance, VoucherApproval counts). Mirror the established `activeVouchers = filter(!isDeleted)` pattern.
- Route the deletion through SL-01 (`logAudit`) instead of `console.info`.
- Provide a restore path (set `isDeleted = false`) — admin-only, logged.

**Sub-tasks.**
1. Migration: `isDeleted` + audit columns on the four tables.
2. Convert the four `delete*` functions to soft-delete + rollback + `logAudit`.
3. Sweep & fix all read paths to filter `isDeleted` (members, purchases, assets, objections) — including report getters and Dashboard.
4. Restore function (admin-only) + minimal UI affordance.
5. Regression: dependent cascades still fire; deleted parents vanish from every list/report but remain in the DB.

**Acceptance criteria.**
- No parent row is ever removed from the DB; deletion sets `isDeleted`.
- Deleted members/purchases/assets/objections disappear from all lists, ledgers, reports, and Dashboard counts.
- Existing dependent-cascade behaviour (linked voucher soft-cancel, stock reversal, dep-voucher cancel) is unchanged.
- Restore returns the record; every delete/restore is in the audit log.

**Test plan.** Delete a member with linked vouchers → member archived, vouchers soft-cancelled, Trial Balance unaffected, member absent from lists. Delete a purchase → stock reverses, movements handled, purchase archived. Restore → reappears. Verify no `activeVouchers`-style leak (deleted parent's data absent from all report getters).

**Risks.** Missed read path leaves a "ghost" archived record visible — mitigate with a systematic grep sweep of each entity's consumers and a checklist in the PR.

---

## 5. Story SL-05 — RBAC model (foundation only) · P0 · L · Risk: High

**Objective.** Define the 17-role × 14-permission model and a central `can(user, action, resource)` check — **without** yet re-gating every route (that is SL-06, Sprint 2). Preserve today's behaviour behind the new model so nothing breaks this sprint.

**Current state.** `AuthContext.UserRole = 'admin'|'accountant'|'viewer'|'auditor'`; `hasPermission` = admin-all, auditor≡viewer. `navigation` Role type is only 3 roles. Module catalog has sparse `requiredRoles`.

**Technical approach (foundation only).**
- Define the **17 roles** (Super Admin, Society Admin, Manager, Accountant, Cashier, Store-keeper, Procurement Officer, Sales Operator, Auditor, Internal Auditor, Board Member, Chairman, Secretary, Employee, Data-entry Operator, Read-only, External CA) and the **14 permission categories** (Create/Read/Update/Delete/Approve/Reject/Export/Print/Lock/Unlock/CloseFY/UserMgmt/Backup/Config) as typed enums + a **permission matrix** data structure (from RBAC blueprint 3.3).
- Implement `can(user, action, resource?, scope?)` reading the matrix, tenant/branch-scoped, with a **backward-compat mapping**: the four legacy roles map onto the new roles so current screens keep working (admin→Society Admin with full grant; accountant→Accountant; viewer→Read-only; auditor→Auditor read-only + time-boxed).
- Do **not** change route guards or UI yet — ship the model + function + unit tests + the legacy shim.

**Sub-tasks.**
1. Role + permission-category enums; permission-matrix data (`src/lib/rbac/`).
2. `can()` evaluator (matrix lookup + scope) + legacy-role→new-role mapping.
3. Unit tests for the matrix (representative allow/deny per role).
4. Wire `can()` alongside (not replacing) `hasPermission` — parity assertion that legacy behaviour is unchanged.
5. Design note for SL-06 (how routes/exports will consume `can()` next sprint).

**Acceptance criteria.**
- The 17×14 matrix and `can()` exist and are unit-tested.
- Legacy 4-role behaviour is provably unchanged (parity test) — this sprint is additive.
- No route/UI regression; `can()` is available for Sprint-2 adoption.

**Test plan.** Unit: `can()` returns the matrix's expected verdicts; legacy mapping parity (every current `hasPermission` outcome matches `can()` for the mapped role). No integration/route change this sprint.

**Risks.** Scope creep into route-gating (Sprint 2) — **explicitly out of scope**; enforce via the story boundary. Matrix disagreements — resolve against blueprint 3.3 as the SSOT.

---

## 6. Sequencing within Sprint 1
1. **SL-01 first** (audit-log table + `logAudit`) — SL-02 and SL-03 both emit audit events, so land the helper early (even as a console-fallback no-op if the migration lags).
2. **SL-02 and SL-03 in parallel** — both touch `DataContext` persistence but different functions; coordinate on the shared migration file.
3. **SL-05 independent** — no dependency on the others; can run in parallel from day 1 (separate `src/lib/rbac` area).

**Shared migration:** SL-01 (audit_log), SL-02 (audit-critical base columns), SL-03 (`isDeleted` on 4 tables) should be bundled into **one migration block** in `supabase-tables.sql` and communicated to the user once.

---

## 7. Definition of Done (sprint)
- All four stories' acceptance criteria met + unit/integration tests green.
- One consolidated migration documented; client code degrades gracefully pre-migration (RULE 8 encoding respected on any edited Hindi files).
- No hard-delete of any parent record remains in the codebase (grep-verified).
- No audit-critical field can be silently lost (SL-02 rollback path verified).
- Legacy access behaviour unchanged (SL-05 parity test).
- `/code-review` clean at ≥ high; verify skill run on the changed save/delete flows.

---

## 8. Out of Scope (Sprint 1)
- Route-level role gating, export gating, MFA, session hardening (Sprint 2, SL-06/07/08/09).
- Approval-gates-posting and workflow (Sprint 3).
- Any UI beyond the minimal audit-log viewer and the restore affordance.

## 9. Risks & Mitigations (sprint-level)
| Risk | Mitigation |
|---|---|
| Migration not yet run by user → columns absent | Every helper no-ops/degrades gracefully; critical fields hard-fail (rollback) rather than silently save |
| Missed read path after soft-delete → ghost records | Per-entity consumer grep sweep + PR checklist |
| SL-05 creeps into route-gating | Hard story boundary; parity test proves additive-only |
| Audit-log volume/perf | Async, batched, buffered writes; index on (society_id, entity_type, created_at) |
| Regression in DataContext persistence | Verify skill on add/update/delete/approve flows before merge |

*End of Sprint-1 Development Plan — planning artifact; no code, no changes. STOP.*
