-- 027 · platform_admin_mfa_verify — verify a TOTP code at login (audit H3, slice B: ENFORCE at login).
--
-- Mirror of app_verify_mfa but without the society_users join, gated on is_platform_admin(). Used by
-- the platform-admin login challenge: after signInWithPassword succeeds the admin holds a JWT, so
-- is_platform_admin() resolves during the 2FA step. Recovery codes (migration 026) are the fallback.
--
-- PRECONDITION: the admin must be ENROLLED (migration 025) and have SAVED recovery codes (026) before
-- the client starts enforcing this — otherwise a lost authenticator = lockout. Run once in the SQL editor.

create or replace function platform_admin_mfa_verify(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
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
$$;

revoke execute on function platform_admin_mfa_verify(text) from public, anon;
grant  execute on function platform_admin_mfa_verify(text) to authenticated;
