-- 025 · platform-admin TOTP MFA — enrolment (audit H3, slice A: enroll only, NOT enforced at login).
--
-- The existing MFA RPCs (app_mfa_*) join society_users, so they can't serve the platform admin (who
-- has no society_users row). These parallel RPCs reuse the SAME TOTP core (app_totp_matches) but key
-- off the caller's VERIFIED JWT email and the platform_admins.mfa_enabled flag instead. The secret is
-- stored in the same RLS-locked user_mfa table (email-keyed). is_platform_admin() gates every one.
--
-- SLICE A is safe/additive: login is NOT yet gated on this (that's slice B), so enrolling — or a bug
-- here — cannot lock the admin out. Run once in the Supabase SQL editor.

alter table platform_admins add column if not exists mfa_enabled boolean not null default false;

-- Enrol: verify the first code against the client-generated secret, then store it + set the flag.
create or replace function platform_admin_mfa_enroll(p_secret text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare adm text;
begin
  if not is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  adm := lower(nullif(auth.jwt() ->> 'email', ''));
  if not app_totp_matches(p_secret, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;  -- wrong / expired code
  end if;
  insert into user_mfa (email, secret, enrolled_at) values (adm, p_secret, now())
    on conflict (email) do update set secret = excluded.secret, enrolled_at = now();
  update platform_admins set mfa_enabled = true where lower(email) = adm;
  return true;
end;
$$;

-- Disable: verify a current code, then remove the secret + clear the flag.
create or replace function platform_admin_mfa_disable(p_code text)
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
  if not app_totp_matches(sec, p_code, floor(extract(epoch from now()))::bigint, 1) then
    return false;
  end if;
  delete from user_mfa where email = adm;
  update platform_admins set mfa_enabled = false where lower(email) = adm;
  return true;
end;
$$;

-- Status: is the calling platform admin enrolled? (non-sensitive; drives the dashboard card.)
create or replace function platform_admin_mfa_status()
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select coalesce((select mfa_enabled from platform_admins
    where lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))), false);
$$;

revoke execute on function platform_admin_mfa_enroll(text, text) from public, anon;
revoke execute on function platform_admin_mfa_disable(text)      from public, anon;
revoke execute on function platform_admin_mfa_status()           from public, anon;
grant  execute on function platform_admin_mfa_enroll(text, text) to authenticated;
grant  execute on function platform_admin_mfa_disable(text)      to authenticated;
grant  execute on function platform_admin_mfa_status()           to authenticated;
