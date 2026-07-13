-- 029 down · restore branches mutation policies to tenant-only (drop the role predicate).
begin;
  drop policy if exists branches_tenant_insert on public.branches;
  create policy branches_tenant_insert on public.branches for insert
    with check (society_id = get_current_society_id());

  drop policy if exists branches_tenant_update on public.branches;
  create policy branches_tenant_update on public.branches for update
    using      (society_id = get_current_society_id())
    with check (society_id = get_current_society_id());

  drop policy if exists branches_tenant_delete on public.branches;
  create policy branches_tenant_delete on public.branches for delete
    using (society_id = get_current_society_id());
commit;
-- The jwt_can_write()/jwt_can_delete() helpers are left in place (harmless if unused). To remove:
-- drop function if exists public.jwt_can_write(); drop function if exists public.jwt_can_delete();
