-- 159 down · stops the hourly expiry job and drops refresh_subscription_status().
-- It does NOT move any subscription back: rows already in 'grace' / 'expired' stay there (re-activate a
-- society from SuperAdmin, or let it pay). The one-time period_end change is not reverted either — the old
-- date is in subscriptions.notes.
begin;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'subscription-expiry') then
      perform cron.unschedule('subscription-expiry');
    end if;
  end if;
end $cron$;

drop function if exists public.refresh_subscription_status();

delete from public.app_migrations where version = '159';

commit;

notify pgrst, 'reload schema';
