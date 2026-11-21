-- Undo 192 · restores 148's email_health() and the zero-argument claim_email_health_alert().
-- (The email-health function deployed with 192 passes p_site; after this undo, redeploy the 148 version of it.)
begin;

drop function if exists public.claim_email_health_alert(jsonb);

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
  v_http_last  text;
  v_cron_fail  integer;
  v_missing    text[];
  v_level      text;
begin
  select count(*) filter (where status = 'pending' and scheduled_at < now() - interval '15 minutes'),
         count(*) filter (where status = 'sending' and locked_until < now() - interval '10 minutes'),
         count(*) filter (where status = 'failed' and created_at > now() - interval '24 hours'),
         count(*) filter (where delivery_status = 'bounced' and delivery_event_at > now() - interval '24 hours'),
         count(*) filter (where delivery_status = 'complained' and delivery_event_at > now() - interval '24 hours')
    into v_stalled, v_stuck, v_failed, v_bounced, v_complained
    from public.notification_outbox;

  begin
    select count(*),
           (array_agg(coalesce(status_code::text, '-') || ' ' || left(coalesce(error_msg, content::text, ''), 120)
                      order by created desc))[1]
      into v_http, v_http_last
      from net._http_response
     where created > now() - interval '6 hours'
       and (coalesce(status_code, 0) not between 200 and 299 or error_msg is not null or coalesce(timed_out, false));
  exception when others then
    v_http := null; v_http_last := null;
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

  v_level := case
    when v_stalled > 0 or v_stuck > 0 or coalesce(v_http, 0) > 0 or coalesce(v_cron_fail, 0) > 0
      or coalesce(cardinality(v_missing), 0) > 0 or v_complained > 0 then 'alert'
    when v_failed > 0 or v_bounced > 0 then 'warn'
    else 'ok' end;

  return jsonb_build_object(
    'level', v_level, 'checked_at', now(),
    'stalled', v_stalled, 'stuck', v_stuck,
    'failed_24h', v_failed, 'bounced_24h', v_bounced, 'complained_24h', v_complained,
    'http_errors_6h', v_http, 'http_last_error', v_http_last,
    'cron_failed_24h', v_cron_fail, 'missing_jobs', to_jsonb(v_missing));
end;
$$;
revoke execute on function public.email_health() from public, anon, authenticated;

create or replace function public.claim_email_health_alert()
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
revoke execute on function public.claim_email_health_alert() from public, anon, authenticated;
grant execute on function public.claim_email_health_alert() to service_role;

delete from public.app_migrations where version = '192';

commit;

notify pgrst, 'reload schema';
