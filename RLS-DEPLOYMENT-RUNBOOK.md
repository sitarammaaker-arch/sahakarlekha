# RLS Tenant-Isolation Deployment Runbook (P1-SEC-1b / 007)

Production checklist for applying `supabase/migrations/007_rls_tenant_isolation.sql`.
**Do not apply to production until every staging step passes.** RLS enforcement
depends on the P1-SEC-1a precondition: every user authenticates via a Supabase
Auth JWT (a JWT-less caller resolves `get_current_society_id()` to NULL → denied).

Legend: 🟢 must pass · ⛔ stop-and-rollback trigger.

---

## Pre-conditions (verify once, before staging)
- [ ] P1-SEC-1a (`register_society`) applied and its signup checklist passed.
- [ ] Auth pre-flight (`supabase/diagnostics/rls-preflight-auth-check.sql`): query (1)
      `jwt_less_legacy = 0`, and live requests carry an `Authorization: Bearer` JWT.
- [ ] `scripts/test-rls-coverage.mjs` passes locally (static migration correctness).
- [ ] **W-1** — the JWT-less login fallback (path-3 `app_login`) now refuses to create a
      session with no JWT and shows "reset your password". Confirm on staging that a normal
      (Supabase Auth) login is unaffected; a legacy/JWT-less login is redirected to reset.
- [ ] **W-7** — reviewed `supabase/diagnostics/P1-SEC-1b-tenant-table-review.md`: all
      society_id tables are per-society; WORM tables have no client UPDATE/DELETE; no shared
      reference table is wrongly scoped.

---

## 1. Backup 🟢
- [ ] Take a full backup of the target project (Supabase dashboard → Database →
      Backups → **on-demand backup**), and note the timestamp/restore point.
- [ ] Confirm the scheduled backup + restore rehearsal (P1-OBS-4) is green — you
      must be able to restore if rollback is insufficient.
- [ ] Export the current policy state for diffing:
      `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' order by 1,2;`

## 2. Apply migration (STAGING first, then PROD) 🟢
- [ ] Open the SQL Editor on the target project.
- [ ] Run `supabase/migrations/007_rls_tenant_isolation.sql` (it is transactional —
      it commits only if the whole thing succeeds).
- [ ] No error returned.

## 3. Cross-tenant verification 🟢 ⛔
- [ ] **Automated live coverage (W-5):** `DATABASE_URL=postgres://… node scripts/test-rls-coverage.mjs`
      (needs the optional `pg` package: `npm i -D pg`). It asserts, against the live DB:
      every `society_id` table is RLS-enabled + scoped + non-permissive; WORM has 0 UPDATE/DELETE
      policies; 0 permissive policies remain. ⛔ on any failure. (Without `pg`, run the SQL the
      script prints — queries (a)/(b)/(c) — and confirm the expected results.)
- [ ] Run `node scripts/test-cross-tenant-isolation.mjs` with two staging test
      societies (A, B): all assertions pass — A cannot read/write B (and vice
      versa), each sees only its own, the foreign-write denial is a **42501 RLS**
      violation (positive control: own-write allowed), WORM update/delete affect 0 rows. ⛔ on any fail.

## 4. Registration smoke test 🟢
- [ ] Register a brand-new society end-to-end (via the app UI). Success screen shows.
- [ ] Log in as the new admin → real Bearer JWT present; society name renders.
- [ ] Confirm rows exist scoped to the new society (societies / society_settings /
      accounts / society_users). ⛔ if signup fails (the `register_society` RPC must
      bypass RLS — if it fails, RLS is mis-scoped or the RPC is not SECURITY DEFINER).

## 5. Voucher save test 🟢
- [ ] As an existing society admin, create a voucher (receipt/payment/journal).
- [ ] It saves with no destructive "cloud save failed" toast (RULE 1).
- [ ] Refresh (F5) → the voucher persists (it reached Supabase under RLS).
- [ ] Edit + soft-delete the voucher → both succeed within the tenant.
- [ ] Confirm a `voucher.posted` row appears in `ledger_events` for that society
      (T-06 shadow append still writes under the scoped INSERT policy).

## 6. Reports test 🟢
- [ ] Open Trial Balance, P&L / I&E, Balance Sheet, Receipts & Payments.
- [ ] Figures match the pre-migration values for the same society (RLS changes
      access, never data — reports must be identical). ⛔ on any figure change.
- [ ] Cross-check: the totals equal what the same society saw before 007.

## 7. Rollback procedure ⛔
Trigger if step 3–6 fails or an access regression appears in production.
1. [ ] 007 is DB-only (no app change ships with it), so leave the app as-is. (If
       P1-SEC-1a is separately implicated, revert its client change first.)
2. [ ] Run `supabase/migrations/007_rls_tenant_isolation_down.sql` in the SQL Editor.
       **Faithful restore (W-3):** it drops 007's tenant policies and re-creates
       EXACTLY the permissive policies 007 removed, from the `rls_policy_backup`
       snapshot — it does NOT blanket-open tables. Tables that were deny-all or
       scoped-only before 007 return to that state; 001's scoped policies remain;
       WORM stays append-only (its snapshot held no UPDATE/DELETE). RLS stays enabled.
3. [ ] Confirm the app is functional again (signup, voucher save, reports).
4. [ ] Sanity-check the restore matches the step-1 policy export
       (`select tablename, policyname, cmd, qual, with_check from pg_policies …`).
       If the snapshot is missing/incomplete, restore policies from that step-1 export
       (the authoritative pre-007 state).
5. [ ] If the down-migration is insufficient, restore from the step-1 database backup.
6. [ ] File an incident with the failing assertion + the `pg_policies` diff; do not
       re-attempt 007 until the root cause is fixed.

---

## Production promotion gate
Promote 007 to production **only** when, on staging: steps 1–6 all 🟢, the rollback
drill (7) was rehearsed successfully, and a soak period (recommend ≥ 24h with real
usage) showed no access regressions. Apply to production during a low-traffic
window with the on-demand backup taken immediately beforehand.
