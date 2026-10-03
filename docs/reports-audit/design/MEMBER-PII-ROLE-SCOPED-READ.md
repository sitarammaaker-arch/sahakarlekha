# Design note — role-scoped read of member PII (audit D-S02 / D-S03)

Status: **DESIGN + DRAFT SQL ONLY. Nothing here has been run anywhere.** The SQL lives in this
folder, deliberately NOT under `supabase/migrations/`, so no tooling can apply it by accident.

## Problem (verified in code)
* `members` has `aadhaar` and `pan` columns (supabase-tables.sql:2589; PII classes in `src/lib/export/entities/member.ts`).
* Migration 031 splits `members` policies so INSERT/UPDATE/DELETE are role-scoped, but **SELECT is tenant-only**:
  every role in a society (incl. `viewer`, `auditor`, `boardMember`) can read every column through the API.
* #683 stopped the *Export Center* handing PAN/Aadhaar to viewer-rank roles, but that is a UI/client rule; a
  logged-in viewer can call PostgREST directly. RLS is the only real boundary.
* Row-level security cannot hide a column. Column `REVOKE` would break `select('*')` for every role (the app loads members with `*`).

## Options
| | Approach | Pros | Cons |
|---|---|---|---|
| **A (recommended)** | New table `member_identity(society_id, member_id, aadhaar, pan, …)` with role-scoped SELECT (admin/accountant/secretary/manager) and write policies; app loads it only for those roles and merges client-side; later blank the columns on `members` | Real boundary; rest of members data unchanged for all readers; phased and reversible | App changes in ~9–14 files, backup/restore/export registry, portal RPC 064 (reads `v_member.aadhaar`) |
| B | Role-scoped SELECT policy on whole `members` | Small SQL | Viewers/auditors/boardMembers lose the member list entirely — breaks Members page, search, reports. Unacceptable |
| C | `members_public` view without PII + revoke table SELECT | Clean | Every `from('members')` read/write path rewritten; highest blast radius |

## Phased plan for A (each phase independently shippable and reversible)
1. **Phase 1 — additive SQL (draft below).** Create `member_identity`, role-scoped RLS, backfill copy of aadhaar/pan. No app change; reads unchanged. Verify row counts equal `members` rows that have either value.
2. **Phase 2 — app.** Write path: save PII to `member_identity` (RULE 1 two-step pattern; base `members` upsert must still succeed); read path: fetch `member_identity` only when `can('viewPII')` (admin/accountant/secretary/manager), else leave fields empty and show masked. Update: export registry (`member` entity PII columns sourced from the new table), backup/restore (`backup-core` bundle + count-pinning tests — see memory "run full CI suite"), portal RPC 064 (masked Aadhaar from `member_identity`), KYC utils, Form 1, member application PDF.
3. **Phase 3 — blank the columns** on `members` (`update members set aadhaar=null, pan=null`) only after Phase 2 has been live and the backup/restore round-trip is rehearsed. Rollback = copy back from `member_identity`.

## Rollback
Phase 1: `drop table member_identity` (nothing depends on it yet). Phase 3: restore columns from `member_identity`.

## Open decisions for the founder
1. Which roles may read PII? Draft assumes admin, accountant, secretary, manager (same as `ROLE_RANK >= accountant`).
2. Do auditors / external CAs need PAN for 26Q/KYC checks? If yes, they need a read-only PII grant.
3. Staging environment to rehearse Phases 1–3 before prod (cross-tenant isolation test is also skipped today for lack of staging credentials).

## Prod pre-flight (read-only, 2026-10-03) — corrections to the first draft
Checked schema/policies/counts on prod (no PII values read):
* `members.id`, `members.society_id`, `aadhaar`, `pan` are all `text`; `member_identity` does not exist yet.
* Prod `members` policies are `members_tenant_*` (`society_id IN (SELECT current_user_society_ids())`) plus `members_branch_*`; the SELECT policy is tenant-only, confirming the exposure.
* **`jwt_can_write()` must NOT gate PII**: it admits cashier, storeKeeper, procurementOfficer, salesOperator, employee, dataEntry, boardMember, chairman, and returns TRUE when the role claim is NULL. The draft now uses a new explicit, fail-closed `jwt_can_read_pii()` (admin, societyAdmin, accountant, secretary, manager — decision #1).
* Only **2 of 507** members have Aadhaar/PAN filled, so the backfill and blast radius are tiny; Phase 2 is the real work.
* Side finding: `jwt_can_write()` / `jwt_can_delete()` are fail-open on a NULL role claim (already in memory m0-preflight). Not changed here; separate decision.

## Draft Phase-1 SQL
See `member_identity_phase1.draft.sql` (same folder).
