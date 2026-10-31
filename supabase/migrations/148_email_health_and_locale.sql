-- 148 · Email health alert + per-user email language (2026-10-31, email follow-up).
--
-- WHY (health): on 30 Oct the cron secret was wrong and send-worker answered 401 every minute — silently; we only
--   noticed because we were watching. Nothing in the system said "email is broken". This adds one health check,
--   read by SuperAdmin → Emails, and an alert email to the platform admins (sent by the email-health function
--   straight through Resend, NOT through the outbox — if the outbox is what broke, an outbox alert would be stuck
--   in it too).
-- WHY (locale): trigger-made emails (role change, FY unlock, reminders, digest) always went out in Hindi; a user
--   can now choose English for every email.
--
-- WHAT:
--   • email_health() — internal. Outcome-based signals, no change to the deployed functions needed:
--       stalled  = pending rows due > 15 min ago (the worker is not draining);
--       stuck    = 'sending' rows whose lease expired > 10 min ago;
--       http_errors = pg_net responses in the last 6 h that are not 2xx / errored / timed out (every cron call to
--                     an Edge Function goes through pg_net — this is exactly the 30 Oct 401);
--       cron_failed = pg_cron runs that failed in the last 24 h;
--       missing_jobs = expected email cron jobs absent or inactive;
--       failed / bounced / complained in the last 24 h.
--     level = alert | warn | ok. A section that cannot be read (e.g. pg_net absent on a test DB) is reported null,
--     never an error.
--   • email_health_alerts — log of alerts sent (server only). claim_email_health_alert() — service role: returns
--     action 'alert' (level alert and none sent in 6 h), 'recovered' (back to ok after an alert), or 'none', plus
--     the active platform-admin recipients; it records the alert/recovery it hands out.
--   • admin_email_health() — platform admin: the health + the last alert, for the SuperAdmin card.
--   • email_preferences.locale (hi | en | null = not chosen). enqueue_notification now uses the recipient's chosen
--     language when there is one, else the caller's. my_email_preferences returns it; set_my_email_locale sets it.
-- The cron for email-health is NOT created here — see supabase/functions/email-health/README.md.
-- Additive. Undo: 148_email_health_and_locale_down.sql.

begin;

-- ── Language preference ───────────────────────────────────────────────────────
alter table public.email_preferences add column if not exists locale text check (locale in ('hi', 'en'));

create or replace function public.enqueue_notification(
  p_society_id      text,
  p_template_key    text,
  p_recipient       text,
  p_payload         jsonb,
  p_idempotency_key text,
  p_locale          text default 'hi',
  p_scheduled_at    timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_to     text := lower(trim(p_recipient));
  v_locale text;
begin
  -- The recipient's own choice wins; otherwise what the caller asked for; otherwise Hindi.
  select ep.locale into v_locale from public.email_preferences ep where ep.email = v_to;
  v_locale := coalesce(v_locale, p_locale, 'hi');
  insert into public.notification_outbox
    (society_id, template_key, locale, recipient, payload, idempotency_key, scheduled_at)
  values
    (p_society_id, p_template_key, v_locale, v_to,
     coalesce(p_payload, '{}'::jsonb), p_idempotency_key, coalesce(p_scheduled_at, now()))
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.notification_outbox where idempotency_key = p_idempotency_key;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.enqueue_notification(text, text, text, jsonb, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_notification(text, text, text, jsonb, text, text, timestamptz) to service_role;

create or replace function public.my_email_preferences()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('email', e.email, 'weekly_digest', coalesce(p.weekly_digest, true), 'locale', p.locale)
  from (select lower(trim(coalesce(auth.jwt() ->> 'email', ''))) as email) e
  left join public.email_preferences p on p.email = e.email
  where e.email <> '';
$$;
revoke execute on function public.my_email_preferences() from public, anon;
grant execute on function public.my_email_preferences() to authenticated;

create or replace function public.set_my_email_locale(p_locale text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if v_email = '' or public.jwt_mfa_pending() then return jsonb_build_object('status', 'not_signed_in'); end if;
  if p_locale is null or p_locale not in ('hi', 'en') then return jsonb_build_object('status', 'bad_locale'); end if;
  insert into public.email_preferences as ep (email, locale) values (v_email, p_locale)
  on conflict (email) do update set locale = excluded.locale, updated_at = now();
  return jsonb_build_object('status', 'saved', 'locale', p_locale);
end;
$$;
revoke execute on function public.set_my_email_locale(text) from public, anon;
grant execute on function public.set_my_email_locale(text) to authenticated;

-- ── Health ────────────────────────────────────────────────────────────────────
create table if not exists public.email_health_alerts (
  id          uuid primary key default gen_random_uuid(),
  level       text not null check (level in ('alert', 'warn')),
  summary     jsonb not null,
  sent_at     timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.email_health_alerts enable row level security;  -- no policies: server only

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

create or replace function public.admin_email_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return public.email_health() || jsonb_build_object('last_alert',
    (select jsonb_build_object('sent_at', a.sent_at, 'resolved_at', a.resolved_at)
       from public.email_health_alerts a order by a.sent_at desc limit 1));
end;
$$;
revoke execute on function public.admin_email_health() from public, anon;
grant execute on function public.admin_email_health() to authenticated;

insert into public.app_migrations (version, name) values ('148', 'email_health_and_locale')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: locale_col = 1 | alerts_tbl = 1 | fns = 6 | health_level = ok/warn/alert | mig = 1):
--   select (select count(*) from information_schema.columns where table_name = 'email_preferences' and column_name = 'locale') as locale_col,
--          (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'email_health_alerts') as alerts_tbl,
--          (select count(*) from pg_proc where proname in ('enqueue_notification', 'my_email_preferences', 'set_my_email_locale',
--             'email_health', 'claim_email_health_alert', 'admin_email_health')) as fns,
--          (public.email_health() ->> 'level') as health_level,
--          (select count(*) from public.app_migrations where version = '148') as mig;
