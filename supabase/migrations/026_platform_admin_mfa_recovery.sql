-- 026 · platform-admin MFA recovery codes (audit H3, slice C). The safety net that makes slice B
-- (enforcing 2FA at login) safe — if the admin loses their authenticator, a one-time recovery code
-- gets them in. The existing app_mfa_*_recovery RPCs join society_users, so these parallel RPCs reuse
-- the SAME user_mfa_recovery table but key off the caller's verified JWT email + is_platform_admin().
--
-- Run once in the Supabase SQL editor (after migration 025).

-- Generate 8 fresh codes after verifying a current TOTP. Plaintext returned ONCE; only hashes stored.
create or replace function platform_admin_mfa_gen_recovery(p_code text)
returns text[]
language plpgsql
security definer
set search_path = public, extensions
as $$
declare adm text; sec text; codes text[] := '{}'; c text; i int;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  select secret into sec from user_mfa where email = adm limit 1;
  if sec is null then return null; end if;   -- not enrolled
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
$$;

-- Verify + consume a recovery code (one-time) — used by slice B's login challenge. At that point the
-- admin already holds a JWT (signInWithPassword succeeded before the 2FA step), so is_platform_admin works.
create or replace function platform_admin_verify_recovery(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
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
$$;

revoke execute on function platform_admin_mfa_gen_recovery(text) from public, anon;
revoke execute on function platform_admin_verify_recovery(text)  from public, anon;
grant  execute on function platform_admin_mfa_gen_recovery(text) to authenticated;
grant  execute on function platform_admin_verify_recovery(text)  to authenticated;
