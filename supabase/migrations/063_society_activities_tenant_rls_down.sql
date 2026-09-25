-- Rollback for 063_society_activities_tenant_rls.sql — restores the pre-063 state (the permissive
-- `allow_all` policy). NOTE: this REOPENS the cross-tenant hole; use only to undo a bad deploy.
begin;
drop policy if exists society_activities_tenant_select on public.society_activities;
drop policy if exists society_activities_tenant_insert on public.society_activities;
drop policy if exists society_activities_tenant_update on public.society_activities;
drop policy if exists society_activities_tenant_delete on public.society_activities;
drop policy if exists "allow_all" on public.society_activities;
create policy "allow_all" on public.society_activities for all using (true) with check (true);
delete from public.rls_policy_backup where table_name = 'society_activities' and policy_name = 'allow_all';
commit;
