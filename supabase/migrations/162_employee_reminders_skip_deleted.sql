-- 162 · PF / ESI / 24Q reminders and the weekly digest no longer count DELETED employees (2026-11-11).
--
-- WHY: compliance_reminder_targets() (145) and weekly_digest_targets() (146) decide "this society has employees"
--   with exists(... e.status = 'active'). Deleting an employee only sets "isDeleted" = true (DataContext
--   deleteEmployee) and leaves status 'active', so a society that deleted its only employee kept getting EPF /
--   ESI / 24Q reminder emails the app itself does not show (the app's list already hides deleted employees).
-- WHAT: both functions = their LIVE production definitions (pg_get_functiondef, 2026-11-11) with ONE change in
--   that exists(): and not coalesce(e."isDeleted", false). CREATE OR REPLACE keeps their grants.
-- Undo: 162_employee_reminders_skip_deleted_down.sql (the definitions exactly as they were).

begin;

CREATE OR REPLACE FUNCTION public.compliance_reminder_targets()
 RETURNS TABLE(society_id text, society_name text, state text, tan boolean, gstin boolean, has_employees boolean, filed_ids text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with soc as (
    select distinct su.society_id::text as sid
      from public.society_users su
     where su.role = 'admin' and su.is_active and coalesce(trim(su.email), '') <> ''
  )
  select soc.sid,
         public.notify_society_name(soc.sid),
         coalesce(nullif(trim(ss.state), ''),
                  (select nullif(trim(s.state), '') from public.societies s where s.id::text = soc.sid limit 1)),
         coalesce(trim(ss.tan), '') <> '',
         coalesce(trim(ss.gstin), '') <> '',
         exists (select 1 from public.employees e where e.society_id::text = soc.sid and e.status = 'active' and not coalesce(e."isDeleted", false)),
         coalesce((select array_agg(distinct cf."itemId") from public.compliance_filings cf
                    where cf.society_id::text = soc.sid and cf."itemId" is not null), '{}'::text[])
    from soc
    left join lateral (select * from public.society_settings x where x.society_id::text = soc.sid limit 1) ss on true;
$function$;

CREATE OR REPLACE FUNCTION public.weekly_digest_targets(p_day date)
 RETURNS TABLE(society_id text, state text, tan boolean, gstin boolean, has_employees boolean, filed_ids text[], counts jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with soc as (
    select distinct su.society_id::text as sid
      from public.society_users su
     where su.role = 'admin' and su.is_active and coalesce(trim(su.email), '') <> ''
  )
  select soc.sid,
         coalesce(nullif(trim(ss.state), ''),
                  (select nullif(trim(s.state), '') from public.societies s where s.id::text = soc.sid limit 1)),
         coalesce(trim(ss.tan), '') <> '',
         coalesce(trim(ss.gstin), '') <> '',
         exists (select 1 from public.employees e where e.society_id::text = soc.sid and e.status = 'active' and not coalesce(e."isDeleted", false)),
         coalesce((select array_agg(distinct cf."itemId") from public.compliance_filings cf
                    where cf.society_id::text = soc.sid and cf."itemId" is not null), '{}'::text[]),
         public.weekly_digest_counts(soc.sid, p_day)
    from soc
    left join lateral (select * from public.society_settings x where x.society_id::text = soc.sid limit 1) ss on true;
$function$;

-- Same grants as 145 / 146 (CREATE OR REPLACE keeps them; restated so this file stands on its own).
revoke execute on function public.compliance_reminder_targets() from public, anon, authenticated;
grant execute on function public.compliance_reminder_targets() to service_role;
revoke execute on function public.weekly_digest_targets(date) from public, anon, authenticated;
grant execute on function public.weekly_digest_targets(date) to service_role;

insert into public.app_migrations (version, name) values ('162', 'employee_reminders_skip_deleted')
  on conflict (version) do nothing;

commit;

-- VERIFY (expect: both = true | mig = 1):
--   select (select bool_and(prosrc like '%isDeleted%') from pg_proc where proname in ('compliance_reminder_targets', 'weekly_digest_targets')) as both,
--          (select count(*) from public.app_migrations where version = '162') as mig;
