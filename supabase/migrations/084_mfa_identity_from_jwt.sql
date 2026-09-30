-- 084 · society-user MFA RPCs take identity from the verified JWT (Phase-2 A1/A2 · SEC-01/SEC-02).
--
-- Before: every app_mfa_* function trusted a caller-supplied email and was EXECUTE-able by anon /
-- PUBLIC. Anyone on the internet could
--   · app_mfa_enroll(<any email>, <own secret>, <own code>)  → overwrite a user's authenticator secret
--     (lock-out, or a second factor the attacker controls), and
--   · app_mfa_admin_reset(<any admin email>, <target>)       → wipe a user's 2FA by naming an admin.
--
-- After: the caller is lower(auth.jwt() ->> 'email'). There is no other identity input.
--   · No JWT email                     → raise 42501 (not authorized).
--   · p_email / p_admin_email given and ≠ the JWT email → raise 42501. The parameters are kept ONLY so
--     the deployed client (AuthContext passes user.email) keeps working — they are never trusted.
--   · Emails are compared case-insensitively (society_users has a mixed-case row; the JWT is lower).
--   · EXECUTE revoked from PUBLIC and anon; granted to authenticated. Every client call site already
--     holds a JWT: login path 1 (signInWithPassword) mints it BEFORE the 2FA challenge, and enrol /
--     disable / reset / recovery run inside a signed-in session.
--   · app_totp_matches is an internal helper (only SECURITY DEFINER functions owned by postgres call
--     it) — revoked from PUBLIC / anon / authenticated.
--
-- Signatures are unchanged, so no client deploy is needed first. Idempotent (create or replace).
-- Undo: 084_mfa_identity_from_jwt_down.sql.

-- The caller's verified email, or an error. Never trusts a parameter.
create or replace function public._mfa_caller_email()
returns text language plpgsql stable
set search_path = public, extensions as $fn$
declare me text := lower(nullif(auth.jwt() ->> 'email', ''));
begin
  if me is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return me;
end;
$fn$;

-- A legacy email argument may be passed, but it must be the caller's own.
create or replace function public._mfa_assert_self(p_claimed text, p_me text)
returns void language plpgsql immutable as $fn$
begin
  if p_claimed is not null and lower(p_claimed) <> p_me then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$fn$;

create or replace function public.app_mfa_enroll(p_email text, p_secret text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email();
begin
  perform _mfa_assert_self(p_email, me);
  -- Only an active society user enrols here (platform admins use platform_admin_mfa_enroll).
  if not exists (select 1 from society_users where lower(email) = me and is_active = true) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not app_totp_matches(p_secret, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  insert into user_mfa (email, secret, enrolled_at) values (me, p_secret, now())
    on conflict (email) do update set secret = excluded.secret, enrolled_at = now();
  update society_users set mfa_enabled = true where lower(email) = me;
  return true;
end;
$fn$;

create or replace function public.app_verify_mfa(p_email text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email(); sec text;
begin
  perform _mfa_assert_self(p_email, me);
  select m.secret into sec
    from user_mfa m join society_users u on lower(u.email) = m.email
   where m.email = me and u.is_active = true and u.mfa_enabled = true
   limit 1;
  if sec is null then return false; end if;
  return app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
end;
$fn$;

create or replace function public.app_mfa_disable(p_email text, p_code text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email(); sec text;
begin
  perform _mfa_assert_self(p_email, me);
  select secret into sec from user_mfa where email = me limit 1;
  if sec is null then return false; end if;
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  delete from user_mfa where email = me;
  update society_users set mfa_enabled = false where lower(email) = me;
  return true;
end;
$fn$;

-- Admin reset: the CALLER must be an active admin of the target's society. p_admin_email is legacy.
create or replace function public.app_mfa_admin_reset(p_admin_email text, p_target_email text)
returns boolean language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email(); target text := lower(nullif(p_target_email, '')); allowed boolean;
begin
  perform _mfa_assert_self(p_admin_email, me);
  if target is null then return false; end if;
  select exists(
    select 1
      from society_users a
      join society_users t on t.society_id = a.society_id
     where lower(a.email) = me and a.role = 'admin' and a.is_active = true
       and lower(t.email) = target
  ) into allowed;
  if not allowed then return false; end if;
  delete from user_mfa where email = target;
  delete from user_mfa_recovery where email = target;
  update society_users set mfa_enabled = false where lower(email) = target;
  return true;
end;
$fn$;

create or replace function public.app_mfa_gen_recovery(p_email text, p_code text)
returns text[] language plpgsql security definer
set search_path = public, extensions as $fn$
declare me text := _mfa_caller_email(); sec text; codes text[] := '{}'; c text; i int;
begin
  perform _mfa_assert_self(p_email, me);
  select m.secret into sec from user_mfa m join society_users u on lower(u.email) = m.email
    where m.email = me and u.is_active = true and u.mfa_enabled = true limit 1;
  if sec is null then return null; end if;
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return null;
  end if;
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
  norm := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(norm) < 8 then return false; end if;
  h := encode(digest(norm, 'sha256'), 'hex');
  select r.id into rid from user_mfa_recovery r
    join society_users u on lower(u.email) = r.email
   where r.email = me and r.used_at is null and r.code_hash = h
     and u.is_active = true and u.mfa_enabled = true
   limit 1;
  if rid is null then return false; end if;
  update user_mfa_recovery set used_at = now() where id = rid;
  return true;
end;
$fn$;

revoke execute on function public._mfa_caller_email()                    from public, anon, authenticated;
revoke execute on function public._mfa_assert_self(text, text)           from public, anon, authenticated;
revoke execute on function public.app_totp_matches(text, text, bigint, int) from public, anon, authenticated;
revoke execute on function public.app_mfa_enroll(text, text, text)       from public, anon;
revoke execute on function public.app_verify_mfa(text, text)             from public, anon;
revoke execute on function public.app_mfa_disable(text, text)            from public, anon;
revoke execute on function public.app_mfa_admin_reset(text, text)        from public, anon;
revoke execute on function public.app_mfa_gen_recovery(text, text)       from public, anon;
revoke execute on function public.app_verify_recovery(text, text)        from public, anon;
grant  execute on function public.app_mfa_enroll(text, text, text)       to authenticated;
grant  execute on function public.app_verify_mfa(text, text)             to authenticated;
grant  execute on function public.app_mfa_disable(text, text)            to authenticated;
grant  execute on function public.app_mfa_admin_reset(text, text)        to authenticated;
grant  execute on function public.app_mfa_gen_recovery(text, text)       to authenticated;
grant  execute on function public.app_verify_recovery(text, text)        to authenticated;
