-- 029 · role-scoped mutation RLS — helpers + first table (branches). Audit P0-3, Layer B / SB2.
--
-- SB1 (migration 028 + the enabled hook) put society_users.role into the JWT as `user_role`. Now the
-- mutation policies can enforce role server-side, so a viewer/auditor (or a client-bypass) can't write.
--
-- Two reusable predicates keep every table's policy identical + maintainable:
--   jwt_can_write()  → admin + accountant (both have create/update)
--   jwt_can_delete() → admin only (accountant has no delete — matches the client guardPermission)
-- BACKWARD-COMPATIBLE: a JWT with no user_role claim (issued before the hook, i.e. a user still on an
-- old session) passes both — so enabling this does NOT lock out anyone already logged in; enforcement
-- kicks in as their token refreshes / they re-login. Anon is blocked regardless by the tenant check.
--
-- This migration does ONE table (branches) so the pattern can be verified before rolling out further.
-- Run once in the SQL editor; then verify an admin can still add/edit/DELETE a branch in the app.

create or replace function public.jwt_can_write() returns boolean
language sql stable set search_path = public as $$
  select auth.jwt() ->> 'user_role' is null
      or auth.jwt() ->> 'user_role' in ('admin', 'accountant');
$$;

create or replace function public.jwt_can_delete() returns boolean
language sql stable set search_path = public as $$
  select auth.jwt() ->> 'user_role' is null
      or auth.jwt() ->> 'user_role' = 'admin';
$$;

grant execute on function public.jwt_can_write()  to authenticated, anon;
grant execute on function public.jwt_can_delete() to authenticated, anon;

-- branches: add the role predicate to INSERT/UPDATE/DELETE. SELECT stays tenant-only (all roles read).
begin;
  drop policy if exists branches_tenant_insert on public.branches;
  create policy branches_tenant_insert on public.branches for insert
    with check (society_id = get_current_society_id() and jwt_can_write());

  drop policy if exists branches_tenant_update on public.branches;
  create policy branches_tenant_update on public.branches for update
    using      (society_id = get_current_society_id() and jwt_can_write())
    with check (society_id = get_current_society_id() and jwt_can_write());

  drop policy if exists branches_tenant_delete on public.branches;
  create policy branches_tenant_delete on public.branches for delete
    using (society_id = get_current_society_id() and jwt_can_delete());
commit;
