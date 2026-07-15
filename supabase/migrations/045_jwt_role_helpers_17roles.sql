-- 045 · ECR-06 17-role rollout S1 — teach jwt_can_write()/jwt_can_delete() the full role model.
--
-- WHY FIRST (runbook §3 S1): the auth hook passes any society_users.role string into the
-- user_role claim, but these two helpers (mig 029, backing the role-scoped RLS on
-- branches + 030 finance-group + 031 core financial tables) only knew 'admin'/'accountant'.
-- Assigning any NEW role before this runs would create a user whose every financial write
-- the server refuses. This migration is a pure SUPERSET of the current lists and no user
-- holds a new role yet, so shipping it now changes nothing observable — zero risk.
--
-- DERIVATION (locked by scripts/test-jwt-role-helpers.mjs against PERMISSION_MATRIX):
--   write  = roles granted UPDATE or APPROVE in src/lib/rbac.ts, minus superAdmin
--            (platform admin has no society JWT), plus the legacy strings.
--            APPROVE is included because approve/reject is implemented as an UPDATE on the
--            vouchers row — excluding boardMember/chairman would server-refuse their approvals.
--   delete = roles granted DELETE, minus superAdmin, plus legacy 'admin'.
--   Deliberately EXCLUDED from write: auditor / internalAuditor / externalCA (their scoped
--   CREATE targets audit tables, which are NOT under the 030/031 role-gated policies —
--   adding them here would only widen their raw-API surface on financial tables) and
--   readOnly/viewer (no writes at all).
--
-- Fail-open on a missing claim is unchanged: old sessions and the JWT-less platform-admin
-- path are never blocked. Reversible: 045_down restores the 029 bodies verbatim.

create or replace function public.jwt_can_write() returns boolean
language sql stable set search_path = public as $$
  select auth.jwt() ->> 'user_role' is null
      or auth.jwt() ->> 'user_role' in (
        -- legacy strings (existing users' claims carry these forever)
        'admin', 'accountant',
        -- matrix roles with UPDATE
        'societyAdmin', 'manager', 'cashier', 'storeKeeper', 'procurementOfficer',
        'salesOperator', 'secretary', 'employee', 'dataEntry',
        -- matrix roles with APPROVE only (approval = an UPDATE on the voucher row)
        'boardMember', 'chairman'
      );
$$;

create or replace function public.jwt_can_delete() returns boolean
language sql stable set search_path = public as $$
  select auth.jwt() ->> 'user_role' is null
      or auth.jwt() ->> 'user_role' in ('admin', 'societyAdmin', 'secretary');
$$;

grant execute on function public.jwt_can_write()  to authenticated, anon;
grant execute on function public.jwt_can_delete() to authenticated, anon;
