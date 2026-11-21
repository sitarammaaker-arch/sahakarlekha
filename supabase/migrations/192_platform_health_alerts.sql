-- 192 · OPS-03 (product audit 2026-11-17) — platform alerts: app errors, backup staleness, site down; no more false alarms.
--
-- WHY: errors went to error_log (285 rows in 30 days) and nothing alerted. The one alert path that existed — 148's
--   email-health, every 30 min, straight through Resend to the platform admins — watched ONLY the email system. And
--   it had been firing a false ALERT every 6 hours since 2026-11-20: pg_net's 5-second timeout on long cron calls
--   (backup, rehearsal) was counted as an HTTP failure, although those functions keep running and finish (backup
--   staleness has its own alarm). On 2026-11-21 the whole site was down for hours (Vercel 402) and nothing said so.
--
-- WHAT (same function names and the same alert/recovered/6-hour cadence, so the deployed pieces keep working):
--   • email_health() gains:
--       http_timeouts_6h      — pg_net timeouts, reported but NOT alerting (the false alarm);
--       http_errors_6h        — now real failures only (non-2xx, or an error message that is not a timeout);
--       app_errors_1h / app_errors_24h — all error_log rows;
--       app_spike_1h          — browser-side errors (error-boundary, window.error, chunk-load, unhandledrejection)
--                               in the last hour; ALERT at 50 or more (the busiest hour in the last 7 days was 40);
--       integrity_errors_6h   — every OTHER error_log source in the last 6 hours (save / post / cascade / backup
--                               failures written by the app or the server) — ALERT on any;
--       integrity_top         — the top sources with a sample message, for the email;
--       backup_stale_24h      — 'backup-stale' rows (174's daily staleness check) — ALERT on any.
--   • claim_email_health_alert(p_site jsonb default null) — the email-health function now probes the live site and
--     passes { ok, status, url, error }; ok = false → ALERT 'site_down'. Called without an argument (the function
--     deployed before 192) it behaves exactly as before.
--   • admin_email_health() unchanged — it reads email_health(), so the SuperAdmin card shows the new signals.
-- Additive. Undo: 192_platform_health_alerts_down.sql (restores 148's two functions).
begin;

create or replace function public.email_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stalled    integer;
  v_stuck      integer;
  v_failed     integer;
  v_bounced    integer;
  v_complained integer;
  v_http       integer;
  v_http_to    integer;
  v_http_last  text;
  v_cron_fail  integer;
  v_missing    text[];
  v_err_1h     integer;
  v_err_24h    integer;
  v_spike      integer;
  v_integrity  integer;
  v_top        jsonb;
  v_backup     integer;
  v_level      text;
  c_noise      constant text[] := array['error-boundary', 'window.error', 'chunk-load', 'unhandledrejection'];
begin
  select count(*) filter (where status = 'pending' and scheduled_at < now() - interval '15 minutes'),
         count(*) filter (where status = 'sending' and locked_until < now() - interval '10 minutes'),
         count(*) filter (where status = 'failed' and created_at > now() - interval '24 hours'),
         count(*) filter (where delivery_status = 'bounced' and delivery_event_at > now() - interval '24 hours'),
         count(*) filter (where delivery_status = 'complained' and delivery_event_at > now() - interval '24 hours')
    into v_stalled, v_stuck, v_failed, v_bounced, v_complained
    from public.notification_outbox;

  begin
    -- A timeout is pg_net giving up after 5 s while the Edge Function keeps running (backup, rehearsal): counted
    -- apart and NOT an alert. A real failure is a non-2xx answer or an error that is not a timeout.
    select count(*) filter (where not coalesce(timed_out, false)
                              and (coalesce(status_code, 0) not between 200 and 299 or error_msg is not null)
                              and coalesce(error_msg, '') not ilike 'timeout%'),
           count(*) filter (where coalesce(timed_out, false) or coalesce(error_msg, '') ilike 'timeout%'),
           (array_agg(coalesce(status_code::text, '-') || ' ' || left(coalesce(error_msg, content::text, ''), 120)
                      order by created desc)
              filter (where not coalesce(timed_out, false)
                        and (coalesce(status_code, 0) not between 200 and 299 or error_msg is not null)
                        and coalesce(error_msg, '') not ilike 'timeout%'))[1]
      into v_http, v_http_to, v_http_last
      from net._http_response
     where created > now() - interval '6 hours';
  exception when others then
    v_http := null; v_http_to := null; v_http_last := null;
  end;

  begin
    select count(*) into v_cron_fail
      from cron.job_run_details where status = 'failed' and start_time > now() - interval '24 hours';
    select coalesce(array_agg(j.name order by j.name), '{}') into v_missing
      from unnest(array['outbox-send-worker', 'compliance-reminders-daily', 'weekly-digest-monday']) as j(name)
     where not exists (select 1 from cron.job c where c.jobname = j.name and c.active);
  exception when others then
    v_cron_fail := null; v_missing := null;
  end;

  begin
    select count(*) filter (where created_at > now() - interval '1 hour'),
           count(*) filter (where created_at > now() - interval '24 hours'),
           count(*) filter (where created_at > now() - interval '1 hour' and source = any (c_noise)),
           count(*) filter (where created_at > now() - interval '6 hours' and not (source = any (c_noise))),
           count(*) filter (where created_at > now() - interval '24 hours' and source = 'backup-stale')
      into v_err_1h, v_err_24h, v_spike, v_integrity, v_backup
      from public.error_log
     where created_at > now() - interval '24 hours';
    select coalesce(jsonb_agg(jsonb_build_object('source', t.source, 'n', t.n, 'sample', t.sample) order by t.n desc), '[]'::jsonb)
      into v_top
      from (select source, count(*) as n, left((array_agg(message order by created_at desc))[1], 140) as sample
              from public.error_log
             where created_at > now() - interval '6 hours' and not (source = any (c_noise))
             group by source order by count(*) desc limit 5) t;
  exception when others then
    v_err_1h := null; v_err_24h := null; v_spike := null; v_integrity := null; v_top := null; v_backup := null;
  end;

  v_level := case
    when v_stalled > 0 or v_stuck > 0 or coalesce(v_http, 0) > 0 or coalesce(v_cron_fail, 0) > 0
      or coalesce(cardinality(v_missing), 0) > 0 or v_complained > 0
      or coalesce(v_spike, 0) >= 50 or coalesce(v_integrity, 0) > 0 or coalesce(v_backup, 0) > 0 then 'alert'
    when v_failed > 0 or v_bounced > 0 then 'warn'
    else 'ok' end;

  return jsonb_build_object(
    'level', v_level, 'checked_at', now(),
    'stalled', v_stalled, 'stuck', v_stuck,
    'failed_24h', v_failed, 'bounced_24h', v_bounced, 'complained_24h', v_complained,
    'http_errors_6h', v_http, 'http_timeouts_6h', v_http_to, 'http_last_error', v_http_last,
    'cron_failed_24h', v_cron_fail, 'missing_jobs', to_jsonb(v_missing),
    'app_errors_1h', v_err_1h, 'app_errors_24h', v_err_24h, 'app_spike_1h', v_spike,
    'integrity_errors_6h', v_integrity, 'integrity_top', v_top, 'backup_stale_24h', v_backup);
end;
$$;
revoke execute on function public.email_health() from public, anon, authenticated;

-- The zero-argument version (148) is replaced by one with an optional site probe; supabase-js .rpc() with no
-- arguments resolves to it, so the email-health function deployed before 192 keeps working.
drop function if exists public.claim_email_health_alert();

create or replace function public.claim_email_health_alert(p_site jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h      jsonb := public.email_health();
  v_open   public.email_health_alerts%rowtype;
  v_action text := 'none';
  v_to     text[];
begin
  if p_site is not null then
    v_h := v_h || jsonb_build_object('site', p_site);
    if coalesce((p_site ->> 'ok')::boolean, true) = false then
      v_h := jsonb_set(v_h, '{level}', '"alert"');
    end if;
  end if;

  select * into v_open from public.email_health_alerts
   where resolved_at is null order by sent_at desc limit 1 for update;

  if v_h ->> 'level' = 'alert' then
    if v_open.id is null or v_open.sent_at < now() - interval '6 hours' then
      insert into public.email_health_alerts (level, summary) values ('alert', v_h);
      v_action := 'alert';
    end if;
  elsif v_h ->> 'level' = 'ok' and v_open.id is not null then
    update public.email_health_alerts set resolved_at = now() where resolved_at is null;
    v_action := 'recovered';
  end if;

  select coalesce(array_agg(distinct lower(email)), '{}') into v_to
    from public.platform_admins where is_active and coalesce(trim(email), '') <> '';
  return jsonb_build_object('action', v_action, 'health', v_h, 'recipients', to_jsonb(v_to));
end;
$$;
revoke execute on function public.claim_email_health_alert(jsonb) from public, anon, authenticated;
grant execute on function public.claim_email_health_alert(jsonb) to service_role;

insert into public.app_migrations (version, name) values ('192', 'platform_health_alerts')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: fns = 2 | has_new = true | mig = 1):
--   select (select count(*) from pg_proc where proname in ('email_health', 'claim_email_health_alert')) as fns,
--          (public.email_health() ? 'integrity_errors_6h') as has_new,
--          (select count(*) from public.app_migrations where version = '192') as mig;
