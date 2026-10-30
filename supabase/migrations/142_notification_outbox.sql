-- 142 · Notification outbox + verified-email gate (2026-10-30, email slice 1).
--
-- WHY: email until now was one hand-built sender (the invoice email, migration 134). Every next email —
--   verification, invite, role change, FY unlock, compliance reminder — needs the same four things: send
--   exactly once, retry with backoff, never to a bounced/complaining address, and never to an address nobody
--   has proved they own. Prod check 2026-10-30: 15 of 41 active staff logins sit on made-up domains
--   (society.com, demo.com, housing.com …) that belong to real third parties, so an unverified send can put a
--   society's data in a stranger's inbox. Hence: no notification goes to an address until its owner clicks a
--   verification link (the verification email itself is the one exception).
--
-- WHAT (all server-only — RLS on, NO client policies; the client reaches it through three definer RPCs):
--   • notification_outbox — one row per message. Rows are written by enqueue_notification() (service role /
--       other definer functions, never the client), sent by the send-worker Edge Function (cron, every minute).
--       channel is 'email' today; the column is there so WhatsApp/SMS can use the same queue later.
--   • email_suppression   — addresses that bounced / complained (slice 3 webhook) or were blocked by hand.
--   • email_verifications — one row per lower-cased address: verified_at, or a pending sha-256 token hash.
--       Keyed by ADDRESS, not user: if an admin edits a user's email, the new address is simply unverified.
--   • enqueue_notification()          service role only. Idempotent on idempotency_key.
--   • claim_outbox(limit, daily_cap)  service role only. Marks suppressed/unverified rows, then leases up to
--       `limit` due rows (status 'sending', locked_until = now()+5 min) with FOR UPDATE SKIP LOCKED. A worker
--       that dies mid-send leaves the lease to expire and the row is claimed again; Resend's Idempotency-Key
--       (= idempotency_key) stops that second claim from sending twice. Never claims past `daily_cap` sends
--       per IST day (the Resend free tier is 100/day across ALL emails, invoices included).
--   • complete_outbox(...)            service role only. sent → strips any token from the payload;
--       retryable failure → back to pending at +1m / +5m / +30m / +2h; 5th failure or permanent → failed.
--   • request_email_verification()    authenticated. Caller's own JWT email only, must be an active staff
--       login; queues the verification email (48 h token, one request per 2 min).
--   • confirm_email_verification(tok) anon + authenticated (the link may open in another browser).
--   • my_email_verification()         authenticated. { email, verified_at, pending } for the caller.
--
-- Recipient is ALWAYS resolved server-side (JWT email / society_users), never taken from a client payload,
-- so the queue cannot be used as a relay. The cron job is NOT created here (it carries a secret) — see
-- supabase/functions/send-worker/README.md.
-- Additive. Undo: 142_notification_outbox_down.sql.

begin;

-- ── Outbox ────────────────────────────────────────────────────────────────────
create table if not exists public.notification_outbox (
  id                  uuid primary key default gen_random_uuid(),
  society_id          text,                         -- null = platform message (e.g. a verification email)
  channel             text not null default 'email' check (channel in ('email')),
  template_key        text not null check (template_key ~ '^[a-z][a-z0-9_]{1,60}$'),
  locale              text not null default 'hi' check (locale in ('hi', 'en')),
  recipient           text not null check (recipient = lower(recipient) and recipient ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  payload             jsonb not null default '{}'::jsonb,
  idempotency_key     text not null unique check (length(idempotency_key) between 1 and 256),
  status              text not null default 'pending'
                        check (status in ('pending', 'sending', 'sent', 'failed', 'suppressed', 'skipped')),
  attempts            integer not null default 0 check (attempts >= 0),
  scheduled_at        timestamptz not null default now(),
  locked_until        timestamptz,
  sent_at             timestamptz,
  provider_message_id text,
  last_error          text,
  created_at          timestamptz not null default now()
);
create index if not exists idx_outbox_due on public.notification_outbox (scheduled_at)
  where status in ('pending', 'sending');
create index if not exists idx_outbox_society on public.notification_outbox (society_id, created_at desc);
alter table public.notification_outbox enable row level security;  -- no policies: server only

-- ── Suppression ───────────────────────────────────────────────────────────────
create table if not exists public.email_suppression (
  email      text primary key check (email = lower(email)),
  reason     text not null check (reason in ('bounce', 'complaint', 'manual')),
  detail     text,
  created_at timestamptz not null default now()
);
alter table public.email_suppression enable row level security;  -- no policies: server only

-- ── Verification ──────────────────────────────────────────────────────────────
create table if not exists public.email_verifications (
  email            text primary key check (email = lower(email)),
  verified_at      timestamptz,
  token_hash       text unique,
  token_expires_at timestamptz,
  requested_at     timestamptz
);
alter table public.email_verifications enable row level security;  -- no policies: server only

-- ── enqueue_notification ──────────────────────────────────────────────────────
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
  v_id uuid;
begin
  insert into public.notification_outbox
    (society_id, template_key, locale, recipient, payload, idempotency_key, scheduled_at)
  values
    (p_society_id, p_template_key, coalesce(p_locale, 'hi'), lower(trim(p_recipient)),
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

-- ── claim_outbox ──────────────────────────────────────────────────────────────
create or replace function public.claim_outbox(p_limit integer default 20, p_daily_cap integer default 90)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_room      integer;
begin
  -- A reclaimed lease that has already used its 5 attempts is not tried a 6th time.
  update public.notification_outbox
     set status = 'failed', locked_until = null, last_error = coalesce(last_error, 'lease expired') || ' · gave up after 5 attempts'
   where status = 'sending' and locked_until < now() and attempts >= 5;

  -- Never send to a suppressed address.
  update public.notification_outbox o
     set status = 'suppressed', last_error = 'suppressed: ' || s.reason
    from public.email_suppression s
   where o.status = 'pending' and o.channel = 'email' and o.recipient = s.email;

  -- Never send to an unproved address — except the verification email that proves it.
  update public.notification_outbox o
     set status = 'skipped', last_error = 'unverified recipient'
   where o.status = 'pending' and o.channel = 'email' and o.template_key <> 'email_verify'
     and not exists (select 1 from public.email_verifications v
                      where v.email = o.recipient and v.verified_at is not null);

  select greatest(0, coalesce(p_daily_cap, 90) - count(*))::integer into v_room
    from public.notification_outbox
   where channel = 'email' and sent_at >= v_day_start;
  v_room := least(v_room, greatest(0, coalesce(p_limit, 20)));
  if v_room = 0 then return; end if;

  return query
  update public.notification_outbox o
     set status = 'sending', attempts = o.attempts + 1, locked_until = now() + interval '5 minutes'
   where o.id in (
     select id from public.notification_outbox
      where channel = 'email'
        and ((status = 'pending' and scheduled_at <= now())
          or (status = 'sending' and locked_until < now()))
      order by scheduled_at
      limit v_room
      for update skip locked)
  returning o.*;
end;
$$;
revoke execute on function public.claim_outbox(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_outbox(integer, integer) to service_role;

-- ── complete_outbox ───────────────────────────────────────────────────────────
create or replace function public.complete_outbox(
  p_id          uuid,
  p_ok          boolean,
  p_provider_id text default null,
  p_error       text default null,
  p_retryable   boolean default true
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notification_outbox%rowtype;
begin
  select * into v_row from public.notification_outbox where id = p_id for update;
  if not found then return 'unknown'; end if;
  if v_row.status <> 'sending' then return 'not_sending'; end if;

  if p_ok then
    update public.notification_outbox
       set status = 'sent', sent_at = now(), locked_until = null, provider_message_id = p_provider_id,
           last_error = null, payload = payload - 'token'
     where id = p_id;
    return 'sent';
  end if;

  if p_retryable and v_row.attempts < 5 then
    update public.notification_outbox
       set status = 'pending', locked_until = null, last_error = left(p_error, 500),
           scheduled_at = now() + case v_row.attempts when 1 then interval '1 minute'
                                                     when 2 then interval '5 minutes'
                                                     when 3 then interval '30 minutes'
                                                     else interval '2 hours' end
     where id = p_id;
    return 'retry';
  end if;

  update public.notification_outbox
     set status = 'failed', locked_until = null, last_error = left(p_error, 500)
   where id = p_id;
  return 'failed';
end;
$$;
revoke execute on function public.complete_outbox(uuid, boolean, text, text, boolean) from public, anon, authenticated;
grant execute on function public.complete_outbox(uuid, boolean, text, text, boolean) to service_role;

-- ── request_email_verification ────────────────────────────────────────────────
create or replace function public.request_email_verification(p_locale text default 'hi')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_user  record;
  v_ver   public.email_verifications%rowtype;
  v_token text;
begin
  if v_email = '' or public.jwt_mfa_pending() then return jsonb_build_object('status', 'not_signed_in'); end if;
  select su.name, su.society_id::text as society_id into v_user
    from public.society_users su
   where lower(su.email) = v_email and su.is_active
   limit 1;
  if not found then return jsonb_build_object('status', 'not_staff'); end if;

  select * into v_ver from public.email_verifications where email = v_email for update;
  if v_ver.verified_at is not null then return jsonb_build_object('status', 'already_verified'); end if;
  if v_ver.requested_at > now() - interval '2 minutes' then return jsonb_build_object('status', 'too_soon'); end if;
  if exists (select 1 from public.email_suppression where email = v_email) then
    return jsonb_build_object('status', 'suppressed');
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.email_verifications as v (email, token_hash, token_expires_at, requested_at)
  values (v_email, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '48 hours', now())
  on conflict (email) do update
    set token_hash = excluded.token_hash, token_expires_at = excluded.token_expires_at,
        requested_at = excluded.requested_at;

  perform public.enqueue_notification(
    v_user.society_id, 'email_verify', v_email,
    jsonb_build_object('token', v_token, 'name', v_user.name),
    'email_verify:' || v_email || ':' || extract(epoch from now())::bigint,
    case when p_locale = 'en' then 'en' else 'hi' end);
  return jsonb_build_object('status', 'queued');
end;
$$;
revoke execute on function public.request_email_verification(text) from public, anon;
grant execute on function public.request_email_verification(text) to authenticated;

-- ── confirm_email_verification ────────────────────────────────────────────────
-- anon-exec: confirm_email_verification — /verify-email is public (the link may open signed-out); it only
--   accepts a 48-hex (192-bit) single-use token and reveals nothing but valid/invalid.
create or replace function public.confirm_email_verification(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{48}$' then return jsonb_build_object('status', 'invalid'); end if;
  update public.email_verifications
     set verified_at = now(), token_hash = null, token_expires_at = null
   where token_hash = encode(digest(p_token, 'sha256'), 'hex') and token_expires_at > now()
  returning email into v_email;
  if v_email is null then return jsonb_build_object('status', 'invalid'); end if;
  return jsonb_build_object('status', 'verified');
end;
$$;
revoke execute on function public.confirm_email_verification(text) from public;
grant execute on function public.confirm_email_verification(text) to anon, authenticated;

-- ── my_email_verification ─────────────────────────────────────────────────────
create or replace function public.my_email_verification()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'email', e.email,
    'verified_at', v.verified_at,
    'pending', v.verified_at is null and v.token_expires_at > now())
  from (select lower(trim(coalesce(auth.jwt() ->> 'email', ''))) as email) e
  left join public.email_verifications v on v.email = e.email
  where e.email <> '';
$$;
revoke execute on function public.my_email_verification() from public, anon;
grant execute on function public.my_email_verification() to authenticated;

insert into public.app_migrations (version, name) values ('142', 'notification_outbox')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: tables = 3 | rls_on = 3 | client_policies = 0 | fns = 6 | mig = 1):
--   select (select count(*) from information_schema.tables where table_schema = 'public'
--             and table_name in ('notification_outbox', 'email_suppression', 'email_verifications')) as tables,
--          (select count(*) from pg_class where relname in ('notification_outbox', 'email_suppression', 'email_verifications')
--             and relrowsecurity) as rls_on,
--          (select count(*) from pg_policies where tablename in ('notification_outbox', 'email_suppression', 'email_verifications')) as client_policies,
--          (select count(*) from pg_proc where proname in ('enqueue_notification', 'claim_outbox', 'complete_outbox',
--             'request_email_verification', 'confirm_email_verification', 'my_email_verification')) as fns,
--          (select count(*) from public.app_migrations where version = '142') as mig;
