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

## Phase 2 status (branch feat/member-pii-phase2)
Implemented, **inert until Phase 1 SQL is applied** (the app detects the table at load; missing table = LEGACY mode, behaviour unchanged):
* `src/lib/memberIdentity.ts` (pure; role list mirrors the SQL gate) — `test:member-identity`.
* `DataContext`: load overlays `member_identity` (role-gated); every `members` upsert goes through `memberRow()` which strips aadhaar/pan in SPLIT mode; add/update persist PII to `member_identity` as step 2 of the two-step save, reverting + destructive toast on failure; roles that may not write PII get an explicit "not saved" toast — `test:member-identity-wiring` guards against bypassing `memberRow`.

### Phase 3 prerequisites (NOT done — do not blank `members.aadhaar/pan` until these are handled)
1. **Backup / restore:** `member_identity` is not in the export/backup registry, so a backup taken after Phase 3 would LOSE PII. Add it to the registry (+ regenerate the committed edge bundles, update count-pinning tests) and rehearse a restore round-trip.
2. **Member portal RPC 064** reads `v_member.aadhaar` from `members` for the masked value — must read `member_identity` first.
3. **Export Center `member` entity** reads `members.aadhaar/pan` — must source from `member_identity`.
4. **Restore commit** writes `members` rows from a backup (incl. PII) — decide whether restore should route PII to `member_identity`.
5. Re-run the staging rehearsal with the real app (not just SQL) after applying Phase 1 durably on staging.

## Phase 3 prerequisite #1 (backup / restore) — DONE in branch feat/member-identity-backup
* `member_identity` is now a registry entity (`backupPolicy: 'full'`, `optionalTable: true`, minRole admin, natural key `member_id`). Registry is 99 entities; count-pinned tests, schema-drift and `supabase-tables.sql` updated.
* **A missing table is tolerated only for `optionalTable` entities** (`source.ts` and the `scheduled-backup` Edge Function's own copy of the reader — guarded by `test:scheduled-backup-optional`). Any other read error still aborts the backup, so merge order vs migration 106 does not matter.
* Migration `supabase/migrations/106_member_identity.sql` (+ `_down`) promoted from the draft: same SQL as rehearsed on staging, plus the `app_migrations` row. **Hand-run; not applied anywhere.**
* Old archives (no `member_identity` file) restore fine: the diff treats an entity absent from the archive as "never carried", not "none".
* **Deploy steps after merge:** (1) apply 106 on staging, verify, then prod; (2) redeploy the `scheduled-backup` Edge Function (it embeds the new registry via `backup-core.mjs`); (3) trigger one manual backup and confirm `member_identity` appears in the archive manifest.
* Still open before Phase 3: portal RPC 064, Export Center member entity, restore-commit PII routing.

## Phase 3 prerequisites #2 and #3 (branch feat/member-pii-phase3-prereqs)
* **#2 Portal RPC 064 — DONE:** migration `107_member_portal_identity.sql` (+ `_down`) re-issues `member_portal_snapshot()` from 070 changing ONLY the source of `aadhaarMasked` / `panMasked` (member_identity first, legacy `members` column as fallback). `test:member-portal-identity-107` proves the function equals 070 plus exactly those substitutions. Refuses to run before 106. Rehearsed on staging in a rolled-back transaction (legacy member, identity-only member, member with none, unauthenticated, anon cannot execute). **Hand-run, apply AFTER 106.**
* **#3 Export Center `member` entity — DONE:** `runEntityExport` overlays `member_identity` onto member rows (role-gated; missing table = untouched; real read failure aborts) — covered in `test:export-generator`.
* **#4 Restore-commit PII routing — NOT DONE, deliberately.** Restore writes `members` rows verbatim from the archive. After Phase 3, restoring an OLD archive (taken before 106) would put PAN/Aadhaar back into `members` columns (readable by every role). A correct fix has to decide, per destination database, whether `member_identity` exists and must be rehearsed with a real restore round-trip on staging (restore is the one path where a mistake leaves a society half-restored). Interim rule: **do not run Phase 3 (blanking) on a society until a post-106 backup exists, and restore only post-106 archives afterwards.**
* **Phase 3 itself** (blank `members.aadhaar/pan`) remains a separate, explicitly-approved step.
