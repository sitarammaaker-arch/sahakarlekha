-- 159 · A trial / paid period that has ended actually ends (2026-11-11).
--
-- WHY: nothing ever moved subscriptions.status off 'trialing' / 'active'. In production 5 of 11 trials
--   were past period_end and still fully working; the "30-day trial" on the pricing page was not true and
--   no society had a reason to buy. 'grace' and 'expired' existed in the CHECK (055) but had no writer.
-- RULE (mirrors src/lib/plans.ts effectiveStatus — scripts/test-subscription-expiry.mjs asserts the 7 days
--   equal GRACE_DAYS):
--     period_end is null, or plan = 'legacy'        → never touched (grandfathered societies stay as they are)
--     now() <  period_end                           → untouched (trialing / active)
--     period_end <= now() < period_end + 7 days     → 'grace'   (still writable; the app shows a red notice)
--     now() >= period_end + 7 days                  → 'expired' (new vouchers paused; reading, reports, export
--                                                                and buying a plan all keep working)
--   The function only ever moves a row FORWARD (trialing/active → grace → expired). Back to 'active' happens
--   only on payment (razorpay-webhook) or admin activation (058), which also set a new period_end.
-- WHAT:
--   • public.refresh_subscription_status() — applies the rule; returns how many rows changed. Service-role only.
--   • pg_cron 'subscription-expiry' — hourly at :05.
--   • ONE-TIME fairness step: a subscription ALREADY past period_end when this runs gets period_end = now(),
--     i.e. a full 7 days of notice from today instead of being cut off the moment this is deployed. The old
--     date is kept in notes.
-- The app derives the same status from period_end on its own, so the notice and the pause do not wait for the
--   job; the job makes the stored status true for the server-side readers (Member Portal gate, SuperAdmin).
-- Undo: 159_subscription_expiry_down.sql.

begin;

-- One-time: start the 7-day notice today for subscriptions that are already overdue.
update public.subscriptions
   set notes      = concat_ws(' | ', nullif(notes, ''), 'period ended ' || to_char(period_end at time zone 'Asia/Kolkata', 'YYYY-MM-DD') || '; 7-day notice started by migration 159'),
       period_end = now(),
       updated_at = now()
 where period_end is not null
   and period_end < now()
   and plan <> 'legacy'
   and status in ('trialing', 'active');

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
       and plan <> 'legacy'
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

-- Apply once now, then hourly.
select public.refresh_subscription_status();

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'subscription-expiry') then
      perform cron.unschedule('subscription-expiry');
    end if;
    perform cron.schedule('subscription-expiry', '5 * * * *', 'select public.refresh_subscription_status()');
  end if;
end $cron$;

insert into public.app_migrations (version, name) values ('159', 'subscription_expiry')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: fn = 1 | anon_exec = false | job = 1 | overdue_untouched = 0 | mig = 1):
--   select (select count(*) from pg_proc where proname = 'refresh_subscription_status') as fn,
--          has_function_privilege('anon', 'public.refresh_subscription_status()', 'execute') as anon_exec,
--          (select count(*) from cron.job where jobname = 'subscription-expiry' and active) as job,
--          (select count(*) from public.subscriptions where period_end is not null and period_end <= now()
--             and plan <> 'legacy' and status in ('trialing', 'active')) as overdue_untouched,
--          (select count(*) from public.app_migrations where version = '159') as mig;
--
-- WHO IS NOW IN NOTICE / PAUSED:
--   select society_id, plan, status, period_end, notes from public.subscriptions
--    where status in ('grace', 'expired') order by period_end;
