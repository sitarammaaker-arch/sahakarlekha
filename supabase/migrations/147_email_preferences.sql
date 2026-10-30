-- 147 · Email preferences: weekly-digest opt-out + one-link unsubscribe (2026-10-30, email follow-up).
--
-- WHY: the weekly digest (146) is not essential mail. Without an opt-out the only way to stop it is the "spam"
--   button, and every spam complaint hurts the whole sahakarlekha.com sending reputation (the same domain carries
--   password resets and invoices). So an admin can now turn the digest off — in the app, or with one link from
--   the email itself without signing in.
--
-- WHAT (server-only table; the client reaches it through definer RPCs):
--   • email_preferences — one row per lower-cased address: weekly_digest (default on) and a random
--       unsubscribe_token (48 hex) used by the link in each digest email. Keyed by ADDRESS, like
--       email_verifications.
--   • email_unsubscribe_token(email)       internal: creates the row if missing, returns the token.
--   • enqueue_weekly_digest(...)            = 146's function, plus: skips admins who opted out, and adds
--       unsubscribe_token to the payload (the template turns it into the footer link + List-Unsubscribe header).
--   • unsubscribe_by_token(token)           anon + authenticated: the /email-unsubscribe page (a button, not an
--       automatic GET — mail scanners pre-open links). Reveals nothing but ok/invalid.
--   • my_email_preferences()                authenticated: { weekly_digest } for the caller's JWT email.
--   • set_my_weekly_digest(on)              authenticated: the caller's own address only.
-- Additive. Undo: 147_email_preferences_down.sql (restores 146's enqueue_weekly_digest).

begin;

create table if not exists public.email_preferences (
  email             text primary key check (email = lower(email)),
  weekly_digest     boolean not null default true,
  unsubscribe_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  updated_at        timestamptz not null default now()
);
alter table public.email_preferences enable row level security;  -- no policies: server only

-- ── email_unsubscribe_token (internal) ────────────────────────────────────────
create or replace function public.email_unsubscribe_token(p_email text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text;
begin
  insert into public.email_preferences (email) values (v_email) on conflict (email) do nothing;
  select unsubscribe_token into v_token from public.email_preferences where email = v_email;
  return v_token;
end;
$$;
revoke execute on function public.email_unsubscribe_token(text) from public, anon, authenticated;

-- ── enqueue_weekly_digest: 146 + opt-out + unsubscribe token ──────────────────
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
       and not exists (select 1 from public.email_preferences ep
                        where ep.email = lower(su.email) and not ep.weekly_digest)
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
        'unverified_users', (v_c ->> 'unverified_users')::integer,
        'unsubscribe_token', public.email_unsubscribe_token(v_admin.email)),
      v_key);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.enqueue_weekly_digest(text, date, integer) from public, anon, authenticated;
grant execute on function public.enqueue_weekly_digest(text, date, integer) to service_role;

-- ── unsubscribe_by_token ──────────────────────────────────────────────────────
-- anon-exec: unsubscribe_by_token — the link in a digest email opens /email-unsubscribe signed-out; it only
--   accepts a 48-hex (192-bit) token, can only turn the digest OFF, and reveals nothing but ok/invalid.
create or replace function public.unsubscribe_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{48}$' then return jsonb_build_object('status', 'invalid'); end if;
  update public.email_preferences set weekly_digest = false, updated_at = now() where unsubscribe_token = p_token;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  return jsonb_build_object('status', 'unsubscribed');
end;
$$;
revoke execute on function public.unsubscribe_by_token(text) from public;
grant execute on function public.unsubscribe_by_token(text) to anon, authenticated;

-- ── my_email_preferences / set_my_weekly_digest ───────────────────────────────
create or replace function public.my_email_preferences()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('email', e.email, 'weekly_digest', coalesce(p.weekly_digest, true))
  from (select lower(trim(coalesce(auth.jwt() ->> 'email', ''))) as email) e
  left join public.email_preferences p on p.email = e.email
  where e.email <> '';
$$;
revoke execute on function public.my_email_preferences() from public, anon;
grant execute on function public.my_email_preferences() to authenticated;

create or replace function public.set_my_weekly_digest(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if v_email = '' or public.jwt_mfa_pending() or p_on is null then
    return jsonb_build_object('status', 'not_signed_in');
  end if;
  insert into public.email_preferences as ep (email, weekly_digest) values (v_email, p_on)
  on conflict (email) do update set weekly_digest = excluded.weekly_digest, updated_at = now();
  return jsonb_build_object('status', 'saved', 'weekly_digest', p_on);
end;
$$;
revoke execute on function public.set_my_weekly_digest(boolean) from public, anon;
grant execute on function public.set_my_weekly_digest(boolean) to authenticated;

insert into public.app_migrations (version, name) values ('147', 'email_preferences')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: tbl = 1 | rls = 1 | policies = 0 | fns = 5 | mig = 1):
--   select (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'email_preferences') as tbl,
--          (select count(*) from pg_class where relname = 'email_preferences' and relrowsecurity) as rls,
--          (select count(*) from pg_policies where tablename = 'email_preferences') as policies,
--          (select count(*) from pg_proc where proname in ('email_unsubscribe_token', 'enqueue_weekly_digest',
--             'unsubscribe_by_token', 'my_email_preferences', 'set_my_weekly_digest')) as fns,
--          (select count(*) from public.app_migrations where version = '147') as mig;
