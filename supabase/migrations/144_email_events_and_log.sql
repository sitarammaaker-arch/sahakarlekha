-- 144 · Email delivery events, suppression and the email log (2026-10-30, email slice 3).
--
-- WHAT:
--   • notification_outbox.delivery_status / delivery_event_at — what Resend reported AFTER accepting the email
--       (delivered / delayed / bounced / complained). status = 'sent' still only means "Resend accepted it".
--   • record_email_event(provider_id, type, recipients, detail) — service role only; called by the
--       resend-webhook Edge Function after it has verified the Svix signature. Updates the outbox row with that
--       provider id, and on a bounce or a spam complaint puts every recipient on email_suppression, so
--       claim_outbox never sends there again. Idempotent (Resend delivers events at least once).
--       Invoice emails (sent outside the outbox) match no row but still get their bounces suppressed.
--   • society_email_log(limit)  — society admin: their own society's emails (no payload: it can hold a token).
--   • admin_email_log(limit)    — platform admin: every society's emails + society name.
--   • admin_email_suppression() / admin_unsuppress_email(email) — platform admin: the list, and lifting one
--       entry after the address is fixed (e.g. a typo'd domain corrected).
--   All read/admin RPCs are SECURITY DEFINER and gated (is_society_admin / is_platform_admin); a non-admin gets
--   an error, never rows.
-- Additive. Undo: 144_email_events_and_log_down.sql.

begin;

alter table public.notification_outbox add column if not exists delivery_status text
  check (delivery_status in ('delivered', 'delayed', 'bounced', 'complained'));
alter table public.notification_outbox add column if not exists delivery_event_at timestamptz;
create index if not exists idx_outbox_provider on public.notification_outbox (provider_message_id)
  where provider_message_id is not null;

-- ── record_email_event ────────────────────────────────────────────────────────
create or replace function public.record_email_event(
  p_provider_id text,
  p_type        text,
  p_recipients  text[],
  p_detail      text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := case p_type
    when 'email.delivered'        then 'delivered'
    when 'email.delivery_delayed' then 'delayed'
    when 'email.bounced'          then 'bounced'
    when 'email.complained'       then 'complained'
  end;
  v_matched    integer := 0;
  v_suppressed integer := 0;
  v_email      text;
begin
  if v_status is null then return jsonb_build_object('status', 'ignored'); end if;

  if coalesce(p_provider_id, '') <> '' then
    -- A later "delivered" never overwrites a bounce/complaint already recorded.
    update public.notification_outbox
       set delivery_status = v_status, delivery_event_at = now(),
           last_error = case when v_status in ('bounced', 'complained') then left(coalesce(p_detail, v_status), 500) else last_error end
     where provider_message_id = p_provider_id
       and (delivery_status is null or delivery_status not in ('bounced', 'complained') or v_status in ('bounced', 'complained'));
    get diagnostics v_matched = row_count;
  end if;

  if v_status in ('bounced', 'complained') then
    foreach v_email in array coalesce(p_recipients, '{}'::text[]) loop
      v_email := lower(trim(v_email));
      continue when v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$';
      insert into public.email_suppression (email, reason, detail)
      values (v_email, case when v_status = 'bounced' then 'bounce' else 'complaint' end, left(p_detail, 500))
      on conflict (email) do nothing;
      if found then v_suppressed := v_suppressed + 1; end if;
    end loop;
  end if;

  return jsonb_build_object('status', 'recorded', 'matched', v_matched, 'suppressed', v_suppressed);
end;
$$;
revoke execute on function public.record_email_event(text, text, text[], text) from public, anon, authenticated;
grant execute on function public.record_email_event(text, text, text[], text) to service_role;

-- ── society_email_log ─────────────────────────────────────────────────────────
create or replace function public.society_email_log(p_limit integer default 50)
returns table (
  created_at timestamptz, template_key text, recipient text, status text, attempts integer,
  sent_at timestamptz, delivery_status text, last_error text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_society text := public.get_current_society_id();
begin
  if v_society is null or not public.is_society_admin(v_society) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select o.created_at, o.template_key, o.recipient, o.status, o.attempts, o.sent_at, o.delivery_status, o.last_error
      from public.notification_outbox o
     where o.society_id = v_society
     order by o.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke execute on function public.society_email_log(integer) from public, anon;
grant execute on function public.society_email_log(integer) to authenticated;

-- ── admin_email_log ───────────────────────────────────────────────────────────
create or replace function public.admin_email_log(p_limit integer default 200)
returns table (
  created_at timestamptz, society_id text, society_name text, template_key text, recipient text, status text,
  attempts integer, sent_at timestamptz, delivery_status text, last_error text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select o.created_at, o.society_id,
           (select s.name from public.society_settings s where s.society_id = o.society_id limit 1),
           o.template_key, o.recipient, o.status, o.attempts, o.sent_at, o.delivery_status, o.last_error
      from public.notification_outbox o
     order by o.created_at desc
     limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;
revoke execute on function public.admin_email_log(integer) from public, anon;
grant execute on function public.admin_email_log(integer) to authenticated;

-- ── admin_email_suppression / admin_unsuppress_email ──────────────────────────
create or replace function public.admin_email_suppression()
returns setof public.email_suppression
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.email_suppression order by created_at desc;
end;
$$;
revoke execute on function public.admin_email_suppression() from public, anon;
grant execute on function public.admin_email_suppression() to authenticated;

create or replace function public.admin_unsuppress_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.email_suppression where email = lower(trim(p_email));
  return found;
end;
$$;
revoke execute on function public.admin_unsuppress_email(text) from public, anon;
grant execute on function public.admin_unsuppress_email(text) to authenticated;

insert into public.app_migrations (version, name) values ('144', 'email_events_and_log')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: cols = 2 | fns = 5 | mig = 1):
--   select (select count(*) from information_schema.columns where table_name = 'notification_outbox'
--             and column_name in ('delivery_status', 'delivery_event_at')) as cols,
--          (select count(*) from pg_proc where proname in ('record_email_event', 'society_email_log', 'admin_email_log',
--             'admin_email_suppression', 'admin_unsuppress_email')) as fns,
--          (select count(*) from public.app_migrations where version = '144') as mig;
