-- ============================================================================
--  ⚠️ RETIRED (P1-SEC-4, 2026-07-12) — DROPPED in migration 010_retire_app_login.
--  The client no longer calls app_login (PR #60) and every active user is on
--  Supabase Auth (jwt_less_legacy = 0). Kept here only as the source for the
--  010 rollback (010_retire_app_login_down.sql). Do NOT re-run in production.
-- ============================================================================
--  SahakarLekha — Secure server-side login (app_login RPC)
-- ----------------------------------------------------------------------------
--  Why this exists:
--  After society-scoped RLS is enabled, the public anon key can NO LONGER read
--  the society_users table directly (good — passwords stay private). But that
--  also breaks the app's legacy "plain-text password" login path, and some
--  users' Supabase Auth (JWT) login is unavailable (corrupted auth row, etc).
--
--  This SECURITY DEFINER function verifies the password SERVER-SIDE and returns
--  the user record ONLY on a correct password. Because it runs as the function
--  owner, it bypasses RLS internally — so it works even with strict RLS on, and
--  the anon role can call it WITHOUT being able to read society_users itself.
--
--  Run in: Supabase Dashboard -> SQL Editor.
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.app_login(p_email text, p_password text)
returns table (id text, name text, email text, role text, society_id text)
language sql
stable
security definer
set search_path = public, extensions
as $fn$
  select su.id::text, su.name, su.email, su.role, su.society_id::text
  from public.society_users su
  where lower(su.email) = lower(trim(p_email))
    and su.is_active
    and (
      su.password = p_password                                    -- current plain-text password
      or (su.password like '$2%' and su.password = crypt(p_password, su.password))  -- future bcrypt
    )
  limit 1;
$fn$;

-- Only allow EXECUTE (not table access). anon can log in; nobody can read the table.
revoke all on function public.app_login(text, text) from public;
grant execute on function public.app_login(text, text) to anon, authenticated;

-- Quick test (replace with a real email/password):
-- select * from public.app_login('mgrcmsrania@gmail.com', 'cms@125076');
