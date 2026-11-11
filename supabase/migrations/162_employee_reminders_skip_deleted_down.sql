-- 162 down · the two functions exactly as they were before 162 (deleted employees counted again).
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
         exists (select 1 from public.employees e where e.society_id::text = soc.sid and e.status = 'active'),
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
         exists (select 1 from public.employees e where e.society_id::text = soc.sid and e.status = 'active'),
         coalesce((select array_agg(distinct cf."itemId") from public.compliance_filings cf
                    where cf.society_id::text = soc.sid and cf."itemId" is not null), '{}'::text[]),
         public.weekly_digest_counts(soc.sid, p_day)
    from soc
    left join lateral (select * from public.society_settings x where x.society_id::text = soc.sid limit 1) ss on true;
$function$;

revoke execute on function public.compliance_reminder_targets() from public, anon, authenticated;
grant execute on function public.compliance_reminder_targets() to service_role;
revoke execute on function public.weekly_digest_targets(date) from public, anon, authenticated;
grant execute on function public.weekly_digest_targets(date) to service_role;

delete from public.app_migrations where version = '162';

commit;
