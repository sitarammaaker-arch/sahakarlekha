-- ============================================================================
--  SahakarLekha — Self-service password sync after an email reset
--  (app_set_my_password RPC)
-- ----------------------------------------------------------------------------
--  Why this exists:
--  When a user resets their password via the email link, the app calls
--  supabase.auth.updateUser({ password }) which changes ONLY the Supabase Auth
--  store (auth.users.encrypted_password — the JWT login path).
--
--  But this app ALSO logs users in via a fallback RPC, app_login(), which reads
--  the PLAIN-TEXT password from public.society_users. That column is NOT touched
--  by updateUser(), so after a reset the two stores DIVERGE:
--      - JWT login (signInWithPassword) accepts the NEW password.
--      - app_login() fallback still checks the OLD password.
--  A user whose JWT path is unavailable would then be locked out with their new
--  password — exactly the "local vs cloud diverge silently" class of bug this
--  project forbids.
--
--  This SECURITY DEFINER function fixes that: it writes the new password to BOTH
--  stores in one call. The caller's email is taken from auth.jwt() (the session
--  created when the user clicks the reset link), NEVER from a parameter, so a
--  user can only ever change THEIR OWN password. It is granted to the
--  'authenticated' role only — anon cannot call it at all.
--
--  Run in: Supabase Dashboard -> SQL Editor.
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.app_set_my_password(p_password text)
returns boolean                      -- true if a society_users row was synced
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_rows  int;
begin
  -- Authorization: identity comes from the JWT (the recovery session), never a
  -- parameter. So this can only ever change the CALLER's own password.
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  -- 1. Sync the app's RPC-login store (plain-text, read by app_login()).
  update public.society_users
     set password = p_password
   where lower(email) = v_email;
  get diagnostics v_rows = row_count;

  -- 2. Keep Supabase Auth (JWT login) in sync too. Idempotent: updateUser() on
  --    the client usually set this already; re-hashing the same password is safe
  --    and guarantees both stores agree even if the client path changes.
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where lower(email) = v_email;

  -- v_rows = 0 is normal for a platform admin (not in society_users); the auth.users
  -- update above still ran, so their JWT password is synced. Return whether the
  -- society_users store was touched so the client can note a true mismatch.
  return v_rows > 0;
end;
$fn$;

-- Only EXECUTE, and only for logged-in (recovery) sessions. anon cannot call it.
revoke all on function public.app_set_my_password(text) from public;
grant execute on function public.app_set_my_password(text) to authenticated;

-- ── MANUAL TEST (cannot self-test without a real JWT session) ───────────────
--  This function depends on auth.jwt(), so it must be exercised through a
--  logged-in/recovery session (i.e. via the app after clicking a reset link),
--  not from the SQL editor (where auth.jwt() is null and it raises
--  'Not authenticated'). After deploying, do a real reset and confirm BOTH:
--    select email, left(password, 4) as su_pw_prefix from public.society_users
--      where lower(email) = 'someuser@example.com';            -- new password
--    -- then log in with the new password (it should work on BOTH paths).
