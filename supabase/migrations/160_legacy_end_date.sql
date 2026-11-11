-- 160 · Grandfathered ('legacy') societies get an end date: 31-03-2027 (2026-11-11).
--
-- WHY: founder 2026-11-11 — the societies that were grandfathered free in migration 055 (and the ones
--   activated as legacy by hand) are free until 31 March 2027; then one week of notice; then new entries
--   pause like any other ended period. Until now 'legacy' meant "never expires".
-- WHAT:
--   • refresh_subscription_status() = 159's body WITHOUT the "plan <> 'legacy'" exclusion. The rule now
--     depends on period_end alone: a row with period_end = null is still indefinite, whatever its plan.
--     (Mirrors src/lib/plans.ts effectiveStatus — scripts/test-subscription-expiry.mjs.)
--   • DATA: every legacy row that has no end date gets period_end = 31-03-2027 23:59:59 IST.
--       free until        31 March 2027 (end of day, IST)
--       notice (grace)    1 – 7 April 2027
--       new entries pause from 8 April 2027
--     The plan stays 'legacy', so nothing else changes for these societies until then (unlimited users,
--     Member Portal, the report footer). A legacy row that ALREADY has an end date is left alone.
-- A society that buys a plan, or is re-activated from SuperAdmin, leaves this path (plan + period_end are
--   replaced). A society with NO subscriptions row is still treated as indefinite by the app.
-- Undo: 160_legacy_end_date_down.sql.

begin;

create or replace function public.refresh_subscription_status()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_changed integer;
begin
  with next as (
    select society_id,
           case when now() >= period_end + interval '7 days' then 'expired' else 'grace' end as new_status
      from public.subscriptions
     where period_end is not null
       and period_end <= now()
       and status <> 'expired'
  )
  update public.subscriptions s
     set status = n.new_status, updated_at = now()
    from next n
   where s.society_id = n.society_id
     and s.status is distinct from n.new_status;
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke execute on function public.refresh_subscription_status() from public, anon, authenticated;
grant execute on function public.refresh_subscription_status() to service_role;

update public.subscriptions
   set period_end = timestamptz '2027-03-31 23:59:59+05:30',
       notes      = concat_ws(' | ', nullif(notes, ''), 'founder 2026-11-11: free (legacy) until 31-03-2027, then 7 days notice (migration 160)'),
       updated_at = now()
 where plan = 'legacy'
   and period_end is null;

insert into public.app_migrations (version, name) values ('160', 'legacy_end_date')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: legacy_no_end = 0 | legacy_31mar = the number of legacy societies | guard_gone = true |
--         anon_exec = false | job = 1 | mig = 1):
--   select (select count(*) from public.subscriptions where plan = 'legacy' and period_end is null) as legacy_no_end,
--          (select count(*) from public.subscriptions where plan = 'legacy'
--             and (period_end at time zone 'Asia/Kolkata')::date = date '2027-03-31') as legacy_31mar,
--          (select prosrc not like '%legacy%' from pg_proc where proname = 'refresh_subscription_status') as guard_gone,
--          has_function_privilege('anon', 'public.refresh_subscription_status()', 'execute') as anon_exec,
--          (select count(*) from cron.job where jobname = 'subscription-expiry' and active) as job,
--          (select count(*) from public.app_migrations where version = '160') as mig;
