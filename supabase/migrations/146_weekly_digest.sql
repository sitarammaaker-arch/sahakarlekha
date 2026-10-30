-- 146 · Weekly digest email (2026-10-30, email slice 5).
--
-- The weekly-digest Edge Function (pg_cron, Monday 07:00 IST) sends each active admin one summary of the
-- society's week. COUNTS ONLY — no rupee amount, balance or total ever enters the payload.
--   • weekly_digest_counts(society, day)  internal (no client / service grant): the counts, computed here so the
--                                         caller cannot invent them:
--         pending_approval  vouchers with "approvalStatus" = 'pending'
--         vouchers_week     vouchers created in the 7 IST days before `day`
--         days_since_last   IST days since the newest voucher was created (null = none ever)
--         unverified_users  active staff logins whose address is not verified (they get no emails)
--       soft-deleted vouchers (coalesce("isDeleted", false)) are never counted. "createdAt" is a UTC
--       timestamp without time zone.
--   • weekly_digest_targets(day)          one row per society with an active admin: what the compliance engine
--                                         needs (state, TAN, GSTIN, employees, filed ids) + the counts.
--   • enqueue_weekly_digest(society, day, compliance_due)
--                                         recomputes the counts; a society with no voucher this week, nothing
--                                         pending and no compliance item due gets NO email. Otherwise one
--                                         'weekly_digest' row per active admin (society_users, lower(email)),
--                                         key weekly_digest:<society>:<email>:<ISO week of day>. claim_outbox
--                                         still sends only to verified addresses.
-- compliance_due (sourced, unfiled items due in the next 14 days) comes from the app's own engine in the Edge
-- Function (src/lib/complianceReminders.ts dueWithinCount); here it is only range-checked.
-- Both callable functions are service-role only. Additive. Undo: 146_weekly_digest_down.sql.

begin;

create or replace function public.weekly_digest_counts(p_society_id text, p_day date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select (p_day::timestamp at time zone 'Asia/Kolkata') as t_end,
           ((p_day - 7)::timestamp at time zone 'Asia/Kolkata') as t_start
  ), v as (
    select vo."approvalStatus" as st, (vo."createdAt" at time zone 'UTC') as created
      from public.vouchers vo
     where vo.society_id::text = p_society_id and not coalesce(vo."isDeleted", false)
  )
  select jsonb_build_object(
    'pending_approval', (select count(*) from v where v.st = 'pending'),
    'vouchers_week',    (select count(*) from v, win where v.created >= win.t_start and v.created < win.t_end),
    'days_since_last',  (select p_day - max((v.created at time zone 'Asia/Kolkata')::date) from v, win
                          where v.created < win.t_end),
    'unverified_users', (select count(distinct lower(su.email)) from public.society_users su
                          where su.society_id::text = p_society_id and su.is_active
                            and coalesce(trim(su.email), '') <> ''
                            and not exists (select 1 from public.email_verifications ev
                                             where ev.email = lower(trim(su.email)) and ev.verified_at is not null)));
$$;
revoke execute on function public.weekly_digest_counts(text, date) from public, anon, authenticated;

create or replace function public.weekly_digest_targets(p_day date)
returns table (
  society_id    text,
  state         text,
  tan           boolean,
  gstin         boolean,
  has_employees boolean,
  filed_ids     text[],
  counts        jsonb
)
language sql
stable
security definer
set search_path = public
as $$
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
$$;
revoke execute on function public.weekly_digest_targets(date) from public, anon, authenticated;
grant execute on function public.weekly_digest_targets(date) to service_role;

-- Returns the number of NEW outbox rows (0 = nothing to report, or already queued this ISO week).
create or replace function public.enqueue_weekly_digest(
  p_society_id     text,
  p_day            date,
  p_compliance_due integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c     jsonb;
  v_admin record;
  v_name  text;
  v_week  text;
  v_key   text;
  v_n     integer := 0;
begin
  if p_society_id is null or p_day is null or p_compliance_due is null or p_compliance_due not between 0 and 99 then
    raise exception 'enqueue_weekly_digest: bad arguments';
  end if;
  v_c := public.weekly_digest_counts(p_society_id, p_day);
  -- no activity and nothing due → no email
  if (v_c ->> 'vouchers_week')::integer = 0 and (v_c ->> 'pending_approval')::integer = 0 and p_compliance_due = 0 then
    return 0;
  end if;
  v_name := public.notify_society_name(p_society_id);
  v_week := to_char(p_day, 'IYYY-"W"IW');
  for v_admin in
    select distinct on (lower(su.email)) lower(su.email) as email, su.name
      from public.society_users su
     where su.society_id::text = p_society_id and su.role = 'admin' and su.is_active
       and coalesce(trim(su.email), '') <> ''
     order by lower(su.email), su.created_at
  loop
    v_key := 'weekly_digest:' || p_society_id || ':' || v_admin.email || ':' || v_week;
    continue when exists (select 1 from public.notification_outbox where idempotency_key = v_key);
    perform public.enqueue_notification(
      p_society_id, 'weekly_digest', v_admin.email,
      jsonb_build_object(
        'name', v_admin.name, 'society_name', v_name, 'week', v_week,
        'period_from', (p_day - 7)::text, 'period_to', (p_day - 1)::text,
        'pending_approval', (v_c ->> 'pending_approval')::integer,
        'vouchers_week', (v_c ->> 'vouchers_week')::integer,
        'days_since_last', (v_c -> 'days_since_last'),
        'compliance_due', p_compliance_due,
        'unverified_users', (v_c ->> 'unverified_users')::integer),
      v_key);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.enqueue_weekly_digest(text, date, integer) from public, anon, authenticated;
grant execute on function public.enqueue_weekly_digest(text, date, integer) to service_role;

insert into public.app_migrations (version, name) values ('146', 'weekly_digest')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: fns = 3 | client_exec = 0 | mig = 1):
--   select (select count(*) from pg_proc where proname in ('weekly_digest_counts', 'weekly_digest_targets', 'enqueue_weekly_digest')) as fns,
--          (select count(*) from pg_proc p where p.proname in ('weekly_digest_counts', 'weekly_digest_targets', 'enqueue_weekly_digest')
--             and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) as client_exec,
--          (select count(*) from public.app_migrations where version = '146') as mig;
