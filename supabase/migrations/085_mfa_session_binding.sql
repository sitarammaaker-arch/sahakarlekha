-- 085 · bind TOTP to the session (Phase-2 A3 · SEC-03) + TOTP brute-force throttle (A4).
-- Requires 084. Deploy the client that refreshes the session after a 2FA code (AuthContext) FIRST.
--
-- THE GAP (A3): signInWithPassword mints a fully-privileged JWT BEFORE the 2FA challenge. The
-- challenge was enforced only by the React client, so anyone holding just the password could skip it
-- and call PostgREST / RPCs directly with that JWT.
--
-- THE FIX: the server knows which sessions passed 2FA, and the token says so.
--   · mfa_verified_sessions(session_id) — written by the verify / recovery / enrol RPCs on success,
--     keyed by the JWT's session_id claim (stable across refreshes of one login).
--   · custom_access_token_hook stamps `mfa_pending: true` into every token of an ENROLLED user whose
--     session is not verified. "Enrolled" = exactly what the client challenges on:
--     society_users.mfa_enabled (active row) OR platform_admins.mfa_enabled. If that check errors the
--     claim is set to true (fail CLOSED — matches the client's MFA policy, PR #205).
--   · jwt_mfa_pending() reads the claim (no table lookup — safe in per-row RLS). Every tenant /
--     privilege helper RLS and the SECURITY DEFINER RPCs derive from now also requires it false:
--     current_user_society_ids, get_current_society_id, get_current_user_role, is_society_admin,
--     is_society_user_manager, is_platform_admin. A pending token therefore sees NO society data and
--     has NO admin rights — through PostgREST and through every RPC built on those helpers.
--   · What a pending token can still do: read its own society_users row (new society_users_self_read
--     policy — login needs mfa_enabled), learn whether it is a platform admin
--     (platform_admin_identity(), used by login before the challenge), read platform_admin_mfa_status,
--     and call the verify / recovery RPCs.
--   · After a correct code the client calls supabase.auth.refreshSession(); the hook re-runs, sees the
--     verified session, and the new token has mfa_pending = false.
--   · Tokens minted before this migration carry no claim (= not pending) until their next refresh
--     (≤ 1 h). Only the platform admin is enrolled today (prod, 2026-09-30).
--
-- A4 THROTTLE: 5 wrong codes for one email within 15 minutes → every TOTP / recovery check for that
-- email returns false (without testing the code) until the window passes. A correct code clears the
-- counter. Applies to verify, recovery, disable and gen-recovery, for society users and the platform
-- admin. (Enrol verifies a code against a secret the caller chose — nothing to brute-force.)
--
-- Idempotent. Undo: 085_mfa_session_binding_down.sql.

-- ── tables (RLS on, no policies, no grants → RPC-only) ─────────────────────────────────────────────

begin;

create table if not exists public.mfa_verified_sessions (
  session_id  text primary key,
  email       text not null,
  verified_at timestamptz not null default now()
);
alter table public.mfa_verified_sessions enable row level security;
revoke all on public.mfa_verified_sessions from anon, authenticated;

create table if not exists public.mfa_failures (
  id     bigint generated always as identity primary key,
  email  text not null,
  at     timestamptz not null default now()
);
create index if not exists idx_mfa_failures_email_at on public.mfa_failures (email, at);
alter table public.mfa_failures enable row level security;
revoke all on public.mfa_failures from anon, authenticated;

-- ── claim reader + internals ───────────────────────────────────────────────────────────────────────
create or replace function public.jwt_mfa_pending()
returns boolean language sql stable
set search_path = '' as $fn$
  select coalesce((auth.jwt() ->> 'mfa_pending')::boolean, false);
$fn$;

-- Is this email enrolled in the sense the client challenges on?
create or replace function public._mfa_enrolled(p_email text)
returns boolean language sql stable security definer
set search_path = public as $fn$
  select exists (select 1 from public.society_users where lower(email) = p_email and is_active and mfa_enabled)
      or exists (select 1 from public.platform_admins where lower(email) = p_email and is_active and mfa_enabled);
$fn$;

-- Record that the CALLER's session passed 2FA; drop rows of sessions that no longer exist.
create or replace function public._mfa_mark_session(p_email text)
returns void language plpgsql security definer
set search_path = public as $fn$
declare sid text := nullif(auth.jwt() ->> 'session_id', '');
begin
  if sid is null then return; end if;   -- no session id → stays pending (fail closed)
  insert into public.mfa_verified_sessions (session_id, email, verified_at) values (sid, p_email, now())
    on conflict (session_id) do update set email = excluded.email, verified_at = now();
  if to_regclass('auth.sessions') is not null then
    execute 'delete from public.mfa_verified_sessions v
              where v.verified_at < now() - interval ''1 day''
                and not exists (select 1 from auth.sessions s where s.id::text = v.session_id)';
  end if;
end;
$fn$;

create or replace function public._mfa_throttled(p_email text)
returns boolean language sql stable security definer
set search_path = public as $fn$
  select count(*) >= 5 from public.mfa_failures where email = p_email and at > now() - interval '15 minutes';
$fn$;

create or replace function public._mfa_note(p_email text, p_ok boolean)
returns void language plpgsql security definer
set search_path = public as $fn$
begin
  if p_ok then
    delete from public.mfa_failures where email = p_email;
  else
    insert into public.mfa_failures (email) values (p_email);
    delete from public.mfa_failures where email = p_email and at < now() - interval '1 day';
  end if;
end;
$fn$;

-- Identity only (NOT privilege): is the caller's email an active platform admin? Pending tokens may
-- ask — login needs it before the challenge. Everything privileged uses is_platform_admin().
create or replace function public.platform_admin_identity()
returns boolean language sql stable security definer
set search_path = public, extensions as $fn$
  select exists (select 1 from platform_admins
    where lower(email) = lower(nullif(auth.jwt() ->> 'email', '')) and is_active = true);
$fn$;

-- ── the token hook ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer
set search_path = public as $fn$
declare
  claims jsonb;
  em text;
  r text;
  b text;
  pending boolean;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  em := lower(nullif(event #>> '{claims,email}', ''));
  begin
    if em is not null then
      select role, branch_id into r, b
        from public.society_users
       where lower(email) = em and is_active = true
       order by (role = 'admin') desc          -- prefer admin if a user has multiple rows
       limit 1;
      if r is not null then
        claims := jsonb_set(claims, '{user_role}', to_jsonb(r));
      end if;
      if nullif(b, '') is not null then
        claims := jsonb_set(claims, '{user_branch_id}', to_jsonb(b));
      end if;
    end if;
  exception when others then
    null;   -- role/branch claims are optional — never block token issuance for them
  end;
  -- 2FA state (085). Errors fail CLOSED: an unknown state is "pending", not "verified".
  begin
    pending := em is not null and public._mfa_enrolled(em)
      and not exists (select 1 from public.mfa_verified_sessions v
                       where v.session_id = nullif(event #>> '{claims,session_id}', '') and v.email = em);
  exception when others then
    pending := em is not null;
  end;
  claims := jsonb_set(claims, '{mfa_pending}', to_jsonb(coalesce(pending, true)));
  return jsonb_set(event, '{claims}', claims);
end;
$fn$;

-- ── helpers: a pending token gets no society and no privilege ──────────────────────────────────────
create or replace function public.current_user_society_ids()
returns setof text language sql stable security definer
set search_path = public as $fn$
  select su.society_id::text from public.society_users su
  where lower(su.email) = lower(auth.jwt() ->> 'email') and su.is_active
    and not public.jwt_mfa_pending();
$fn$;

create or replace function public.get_current_society_id()
returns text language sql stable security definer
set search_path = '' as $fn$
  select society_id::text from public.society_users
  where email = auth.jwt() ->> 'email' and not public.jwt_mfa_pending()
  limit 1;
$fn$;

create or replace function public.get_current_user_role()
returns text language sql stable security definer
set search_path = '' as $fn$
  select role from public.society_users
  where email = auth.jwt() ->> 'email' and not public.jwt_mfa_pending()
  limit 1;
$fn$;

create or replace function public.is_society_admin(p_society_id text)
returns boolean language sql stable security definer
set search_path = public as $fn$
  select not public.jwt_mfa_pending() and exists (select 1 from public.society_users su
    where lower(su.email) = lower(auth.jwt() ->> 'email')
      and su.society_id::text = p_society_id and su.role = 'admin' and su.is_active);
$fn$;

create or replace function public.is_society_user_manager(p_society_id text)
returns boolean language sql stable security definer
set search_path = public as $fn$
  select not public.jwt_mfa_pending() and exists (select 1 from public.society_users su
    where lower(su.email) = lower(auth.jwt() ->> 'email')
      and su.society_id::text = p_society_id
      and su.role in ('admin', 'secretary') and su.is_active);
$fn$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer
set search_path = public, extensions as $fn$
  select not public.jwt_mfa_pending() and exists (
    select 1
    from platform_admins
    where lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
      and is_active = true
  );
$fn$;

-- Login reads the caller's own row (mfa_enabled) with a pending token.
drop policy if exists society_users_self_read on public.society_users;
create policy society_users_self_read on public.society_users
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ── society-user MFA RPCs (084 bodies + session marking + throttle) ────────────────────────────────
create or replace function public.app_mfa_enroll(p_email text, p_secret text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email();
begin
  perform _mfa_assert_self(p_email, me);
  if not exists (select 1 from society_users where lower(email) = me and is_active = true) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- Re-enrolling an enrolled account needs a verified session (a pending one must pass 2FA first).
  if jwt_mfa_pending() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not app_totp_matches(p_secret, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  insert into user_mfa (email, secret, enrolled_at) values (me, p_secret, now())
    on conflict (email) do update set secret = excluded.secret, enrolled_at = now();
  update society_users set mfa_enabled = true where lower(email) = me;
  perform _mfa_mark_session(me);   -- this session just proved the code — don't lock it out
  return true;
end;
$fn$;

create or replace function public.app_verify_mfa(p_email text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email(); sec text; good boolean;
begin
  perform _mfa_assert_self(p_email, me);
  select m.secret into sec
    from user_mfa m join society_users u on lower(u.email) = m.email
   where m.email = me and u.is_active = true and u.mfa_enabled = true
   limit 1;
  if sec is null or _mfa_throttled(me) then return false; end if;
  good := app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
  perform _mfa_note(me, good);
  if good then perform _mfa_mark_session(me); end if;
  return good;
end;
$fn$;

create or replace function public.app_mfa_disable(p_email text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email(); sec text; good boolean;
begin
  perform _mfa_assert_self(p_email, me);
  select secret into sec from user_mfa where email = me limit 1;
  if sec is null or _mfa_throttled(me) then return false; end if;
  good := app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
  perform _mfa_note(me, good);
  if not good then return false; end if;
  delete from user_mfa where email = me;
  update society_users set mfa_enabled = false where lower(email) = me;
  return true;
end;
$fn$;

create or replace function public.app_mfa_gen_recovery(p_email text, p_code text)
returns text[] language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email(); sec text; codes text[] := '{}'; c text; i int; good boolean;
begin
  perform _mfa_assert_self(p_email, me);
  select m.secret into sec from user_mfa m join society_users u on lower(u.email) = m.email
    where m.email = me and u.is_active = true and u.mfa_enabled = true limit 1;
  if sec is null or _mfa_throttled(me) then return null; end if;
  good := app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
  perform _mfa_note(me, good);
  if not good then return null; end if;
  delete from user_mfa_recovery where email = me;
  for i in 1..8 loop
    c := substr(encode(gen_random_bytes(8), 'hex'), 1, 10);
    codes := array_append(codes, c);
    insert into user_mfa_recovery (email, code_hash)
      values (me, encode(digest(c, 'sha256'), 'hex'));
  end loop;
  return codes;
end;
$fn$;

create or replace function public.app_verify_recovery(p_email text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email(); norm text; h text; rid bigint;
begin
  perform _mfa_assert_self(p_email, me);
  if _mfa_throttled(me) then return false; end if;
  norm := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(norm) < 8 then perform _mfa_note(me, false); return false; end if;
  h := encode(digest(norm, 'sha256'), 'hex');
  select r.id into rid from user_mfa_recovery r
    join society_users u on lower(u.email) = r.email
   where r.email = me and r.used_at is null and r.code_hash = h
     and u.is_active = true and u.mfa_enabled = true
   limit 1;
  perform _mfa_note(me, rid is not null);
  if rid is null then return false; end if;
  update user_mfa_recovery set used_at = now() where id = rid;
  perform _mfa_mark_session(me);
  return true;
end;
$fn$;

-- ── platform-admin MFA RPCs ────────────────────────────────────────────────────────────────────────
-- verify / recovery run DURING the challenge (pending token) → identity check, not is_platform_admin().
create or replace function public.platform_admin_mfa_verify(p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare adm text; sec text; good boolean;
begin
  if not platform_admin_identity() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  select secret into sec from user_mfa where email = adm limit 1;
  if sec is null or _mfa_throttled(adm) then return false; end if;
  good := app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
  perform _mfa_note(adm, good);
  if good then perform _mfa_mark_session(adm); end if;
  return good;
end;
$fn$;

create or replace function public.platform_admin_verify_recovery(p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare adm text; norm text; h text; rid bigint;
begin
  if not platform_admin_identity() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  if _mfa_throttled(adm) then return false; end if;
  norm := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(norm) < 8 then perform _mfa_note(adm, false); return false; end if;
  h := encode(digest(norm, 'sha256'), 'hex');
  select r.id into rid from user_mfa_recovery r
   where r.email = adm and r.used_at is null and r.code_hash = h
   limit 1;
  perform _mfa_note(adm, rid is not null);
  if rid is null then return false; end if;
  update user_mfa_recovery set used_at = now() where id = rid;
  perform _mfa_mark_session(adm);
  return true;
end;
$fn$;

-- enrol / disable / gen-recovery stay behind is_platform_admin() (verified session only).
create or replace function public.platform_admin_mfa_enroll(p_secret text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare adm text;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  if not app_totp_matches(p_secret, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  insert into user_mfa (email, secret, enrolled_at) values (adm, p_secret, now())
    on conflict (email) do update set secret = excluded.secret, enrolled_at = now();
  update platform_admins set mfa_enabled = true where lower(email) = adm;
  perform _mfa_mark_session(adm);
  return true;
end;
$fn$;

create or replace function public.platform_admin_mfa_disable(p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare adm text; sec text; good boolean;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  select secret into sec from user_mfa where email = adm limit 1;
  if sec is null or _mfa_throttled(adm) then return false; end if;
  good := app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
  perform _mfa_note(adm, good);
  if not good then return false; end if;
  delete from user_mfa where email = adm;
  update platform_admins set mfa_enabled = false where lower(email) = adm;
  return true;
end;
$fn$;

create or replace function public.platform_admin_mfa_gen_recovery(p_code text)
returns text[] language plpgsql security definer
set search_path = public, extensions as $fn$
declare adm text; sec text; codes text[] := '{}'; c text; i int; good boolean;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  select secret into sec from user_mfa where email = adm limit 1;
  if sec is null or _mfa_throttled(adm) then return null; end if;
  good := app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
  perform _mfa_note(adm, good);
  if not good then return null; end if;
  delete from user_mfa_recovery where email = adm;
  for i in 1..8 loop
    c := substr(encode(gen_random_bytes(8), 'hex'), 1, 10);
    codes := array_append(codes, c);
    insert into user_mfa_recovery (email, code_hash)
      values (adm, encode(digest(c, 'sha256'), 'hex'));
  end loop;
  return codes;
end;
$fn$;

-- ── grants ─────────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public._mfa_enrolled(text)          from public, anon, authenticated;
revoke execute on function public._mfa_mark_session(text)      from public, anon, authenticated;
revoke execute on function public._mfa_throttled(text)         from public, anon, authenticated;
revoke execute on function public._mfa_note(text, boolean)     from public, anon, authenticated;
revoke execute on function public.platform_admin_identity()    from public, anon;
grant  execute on function public.platform_admin_identity()    to authenticated;
grant  execute on function public.jwt_mfa_pending()            to anon, authenticated;
-- The hook runs as supabase_auth_admin; it keeps its 028 grant (create or replace preserves ACLs).

insert into public.app_migrations (version, name) values ('085', 'mfa_session_binding')
  on conflict (version) do nothing;

commit;
