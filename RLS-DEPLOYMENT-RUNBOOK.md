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
Run the LIVE assertion SQL printed by `node scripts/test-rls-coverage.mjs`:
- [ ] (a) every `society_id` table: `rls_enabled = true`, `policies >= 1`,
      `has_permissive = false`. ⛔ if any row is permissive or has 0 policies.
- [ ] (b) `ledger_events` + `audit_log`: **0** UPDATE/DELETE policies.
- [ ] (c) no permissive policy remains anywhere: **0** rows.
- [ ] Run `node scripts/test-cross-tenant-isolation.mjs` with two staging test
      societies (A, B): all assertions pass — A cannot read/write B (and vice
      versa), each sees only its own, WORM update/delete affect 0 rows. ⛔ on any fail.

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
1. [ ] **Revert the client first if P1-SEC-1a is implicated** — otherwise leave the
       app as-is (007 is DB-only; no app change ships with it).
2. [ ] Run `supabase/migrations/007_rls_tenant_isolation_down.sql` in the SQL Editor.
       It restores permissive access on every `society_id` table (WORM stays
       append-only) and reverts `societies` to permissive select/update.
3. [ ] Re-run the cross-tenant script — it will now show access is open again
       (expected for the rolled-back state).
4. [ ] Confirm the app is fully functional (signup, voucher save, reports).
5. [ ] If the down-migration is insufficient, restore from the step-1 backup.
6. [ ] File an incident with the failing assertion + `pg_policies` diff; do not
       re-attempt 007 until the root cause is fixed.

---

## Production promotion gate
Promote 007 to production **only** when, on staging: steps 1–6 all 🟢, the rollback
drill (7) was rehearsed successfully, and a soak period (recommend ≥ 24h with real
usage) showed no access regressions. Apply to production during a low-traffic
window with the on-demand backup taken immediately beforehand.
