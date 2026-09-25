-- ============================================================
-- SahakarLekha — close the society_activities cross-tenant hole. Run in Supabase SQL Editor.
--
-- 035 shipped society_activities with the placeholder `allow_all` policy (USING true / WITH CHECK
-- true, no role ⇒ applies to anon too) "until T-11". Tenant isolation never followed, and the T-12
-- backfill has since filled the table — so anyone holding the public anon key could read, change or
-- delete ANY society's declared activities. (Found by the member-portal S1 pre-flight, 2026-09-25.)
--
-- This applies the same end-state 007 + 030/031 give every other tenant table:
--   SELECT  → own society only
--   INSERT  → own society + jwt_can_write()
--   UPDATE  → own society + jwt_can_write()
--   DELETE  → own society + jwt_can_delete()
-- The app only READS this table (DataContext load); backfills run as service_role (bypasses RLS).
-- The dropped policy is snapshotted into rls_policy_backup (007) for a faithful rollback.
-- ============================================================

begin;

do $$
declare pol record;
begin
  for pol in
    select policyname, cmd, qual, with_check from pg_policies
    where schemaname = 'public' and tablename = 'society_activities'
      and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
  loop
    insert into public.rls_policy_backup(table_name, policy_name, cmd, qual, with_check)
      values ('society_activities', pol.policyname, pol.cmd, pol.qual, pol.with_check);
    execute format('drop policy %I on public.society_activities', pol.policyname);
  end loop;
end $$;

alter table public.society_activities enable row level security;

drop policy if exists society_activities_tenant_select on public.society_activities;
drop policy if exists society_activities_tenant_insert on public.society_activities;
drop policy if exists society_activities_tenant_update on public.society_activities;
drop policy if exists society_activities_tenant_delete on public.society_activities;

create policy society_activities_tenant_select on public.society_activities
  for select using (society_id::text = get_current_society_id());
create policy society_activities_tenant_insert on public.society_activities
  for insert with check ((society_id::text = get_current_society_id()) and jwt_can_write());
create policy society_activities_tenant_update on public.society_activities
  for update using ((society_id::text = get_current_society_id()) and jwt_can_write())
  with check ((society_id::text = get_current_society_id()) and jwt_can_write());
create policy society_activities_tenant_delete on public.society_activities
  for delete using ((society_id::text = get_current_society_id()) and jwt_can_delete());

commit;

-- ── Verify (run after; expected: 4 rows, none with qual/with_check = 'true') ──
-- select policyname, cmd, qual, with_check from pg_policies
-- where schemaname = 'public' and tablename = 'society_activities' order by cmd;
