-- 085 undo · restores the pre-085 (= 084) definitions exactly, drops the session-binding objects.
-- Re-opens SEC-03 (2FA enforced only by the client) and removes the TOTP throttle.

begin;

CREATE OR REPLACE FUNCTION public.app_mfa_disable(p_email text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.app_mfa_enroll(p_email text, p_secret text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.app_mfa_gen_recovery(p_email text, p_code text)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.app_verify_mfa(p_email text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.app_verify_recovery(p_email text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.current_user_society_ids()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select su.society_id::text from public.society_users su
  where lower(su.email) = lower(auth.jwt() ->> 'email') and su.is_active;
$function$;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  claims jsonb;
  em text;
  r text;
  b text;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  begin
    em := lower(nullif(event #>> '{claims,email}', ''));
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
    null;   -- NEVER block token issuance â€” swallow any error and fall through
  end;
  return jsonb_set(event, '{claims}', claims);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_society_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select society_id::text from public.society_users
  where email = auth.jwt() ->> 'email'
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select role from public.society_users
  where email = auth.jwt() ->> 'email'
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select exists (
    select 1
    from platform_admins
    where lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
      and is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_society_admin(p_society_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.society_users su
    where lower(su.email) = lower(auth.jwt() ->> 'email')
      and su.society_id::text = p_society_id and su.role = 'admin' and su.is_active);
$function$;

CREATE OR REPLACE FUNCTION public.is_society_user_manager(p_society_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.society_users su
    where lower(su.email) = lower(auth.jwt() ->> 'email')
      and su.society_id::text = p_society_id
      and su.role in ('admin', 'secretary') and su.is_active);
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_mfa_disable(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare adm text; sec text;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  select secret into sec from user_mfa where email = adm limit 1;
  if sec is null then return false; end if;
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  delete from user_mfa where email = adm;
  update platform_admins set mfa_enabled = false where lower(email) = adm;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_mfa_enroll(p_secret text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_mfa_gen_recovery(p_code text)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare adm text; sec text; codes text[] := '{}'; c text; i int;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  select secret into sec from user_mfa where email = adm limit 1;
  if sec is null then return null; end if;
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return null;
  end if;
  delete from user_mfa_recovery where email = adm;
  for i in 1..8 loop
    c := substr(encode(gen_random_bytes(8), 'hex'), 1, 10);
    codes := array_append(codes, c);
    insert into user_mfa_recovery (email, code_hash)
      values (adm, encode(digest(c, 'sha256'), 'hex'));
  end loop;
  return codes;
end;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_mfa_verify(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare adm text; sec text;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  select secret into sec from user_mfa where email = adm limit 1;
  if sec is null then return false; end if;
  return app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1);
end;
$function$;

CREATE OR REPLACE FUNCTION public.platform_admin_verify_recovery(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare adm text; norm text; h text; rid bigint;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  norm := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(norm) < 8 then return false; end if;
  h := encode(digest(norm, 'sha256'), 'hex');
  select r.id into rid from user_mfa_recovery r
   where r.email = adm and r.used_at is null and r.code_hash = h
   limit 1;
  if rid is null then return false; end if;
  update user_mfa_recovery set used_at = now() where id = rid;
  return true;
end;
$function$;

drop policy if exists society_users_self_read on public.society_users;
drop function if exists public.platform_admin_identity();
drop function if exists public._mfa_note(text, boolean);
drop function if exists public._mfa_throttled(text);
drop function if exists public._mfa_mark_session(text);
drop function if exists public._mfa_enrolled(text);
drop function if exists public.jwt_mfa_pending();
drop table if exists public.mfa_failures;
drop table if exists public.mfa_verified_sessions;

delete from public.app_migrations where version = '085';

commit;
