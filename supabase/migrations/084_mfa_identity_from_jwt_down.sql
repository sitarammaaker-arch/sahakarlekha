-- 084 undo · restores the pre-084 app_mfa_* definitions and grants EXACTLY (prod catalog 2026-09-30).
-- WARNING: this re-opens SEC-01/SEC-02 (anon-callable, caller-supplied email). Use only to back out a broken 084.

CREATE OR REPLACE FUNCTION public.app_mfa_admin_reset(p_admin_email text, p_target_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare allowed boolean;
begin
  select exists(
    select 1
      from society_users a
      join society_users t on t.society_id = a.society_id
     where a.email = p_admin_email and a.role = 'admin' and a.is_active = true
       and t.email = p_target_email
  ) into allowed;
  if not allowed then return false; end if;
  delete from user_mfa where email = p_target_email;
  update society_users set mfa_enabled = false where email = p_target_email;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_mfa_disable(p_email text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare sec text;
begin
  select secret into sec from user_mfa where email = p_email limit 1;
  if sec is null then return false; end if;
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  delete from user_mfa where email = p_email;
  update society_users set mfa_enabled = false where email = p_email;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_mfa_enroll(p_email text, p_secret text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if not app_totp_matches(p_secret, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  insert into user_mfa (email, secret, enrolled_at) values (p_email, p_secret, now())
    on conflict (email) do update set secret = excluded.secret, enrolled_at = now();
  update society_users set mfa_enabled = true where email = p_email;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_mfa_gen_recovery(p_email text, p_code text)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare sec text; codes text[] := '{}'; c text; i int;
begin
  select m.secret into sec from user_mfa m join society_users u on u.email = m.email
    where m.email = p_email and u.is_active = true and u.mfa_enabled = true limit 1;
  if sec is null then return null; end if;
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return null;
  end if;
  delete from user_mfa_recovery where email = p_email;
  for i in 1..8 loop
    c := substr(encode(gen_random_bytes(8), 'hex'), 1, 10);
    codes := array_append(codes, c);
    insert into user_mfa_recovery (email, code_hash)
      values (p_email, encode(digest(c, 'sha256'), 'hex'));
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
declare sec text;
begin
  select m.secret into sec
    from user_mfa m join society_users u on u.email = m.email
   where m.email = p_email and u.is_active = true and u.mfa_enabled = true
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
declare norm text; h text; rid bigint;
begin
  norm := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  if length(norm) < 8 then return false; end if;
  h := encode(digest(norm, 'sha256'), 'hex');
  select r.id into rid from user_mfa_recovery r
    join society_users u on u.email = r.email
   where r.email = p_email and r.used_at is null and r.code_hash = h
     and u.is_active = true and u.mfa_enabled = true
   limit 1;
  if rid is null then return false; end if;
  update user_mfa_recovery set used_at = now() where id = rid;
  return true;
end;
$function$;

grant execute on function public.app_totp_matches(text, text, bigint, int) to public, anon, authenticated;
grant execute on function public.app_mfa_enroll(text, text, text)  to public, anon, authenticated;
grant execute on function public.app_verify_mfa(text, text)        to public, anon, authenticated;
grant execute on function public.app_mfa_disable(text, text)       to public, anon, authenticated;
grant execute on function public.app_mfa_admin_reset(text, text)   to public, anon, authenticated;
grant execute on function public.app_mfa_gen_recovery(text, text)  to public, anon, authenticated;
grant execute on function public.app_verify_recovery(text, text)   to public, anon, authenticated;
drop function if exists public._mfa_assert_self(text, text);
drop function if exists public._mfa_caller_email();
