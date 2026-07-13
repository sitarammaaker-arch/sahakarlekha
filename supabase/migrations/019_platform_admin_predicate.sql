-- 019 · is_platform_admin() — a JWT-based super-admin predicate (audit P0-1 / P0-3, slice S2).
--
-- WHY: the client `checkSuperAdmin()` used to read `platform_admins` directly, but that table is
-- RLS-locked ("only accessible via service role / security definer functions"), so an authenticated
-- admin's direct read returns NULL — path-1 (real JWT) super-admin login silently fell through to the
-- insecure JWT-less `verify_platform_admin` fallback. This SECURITY DEFINER function checks the table
-- authoritatively, regardless of RLS, and keyed on the CALLER'S verified JWT email (not a client-passed
-- value, so it cannot be spoofed). The SAME predicate will gate the three cross-tenant super-admin RPCs
-- in slice S3 — one source of truth for "is this caller a platform admin".
--
-- Callers always hold a JWT (checkSuperAdmin runs only after signInWithPassword / on a restored
-- session), so EXECUTE is granted to `authenticated` only — never anon/public.
--
-- Run once in the Supabase SQL editor after deploying the S2 client change (safe to run before, too —
-- it only ADDS a function; nothing calls it until the new client ships).

create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select exists (
    select 1
    from platform_admins
    where lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
      and is_active = true
  );
$$;

revoke execute on function is_platform_admin() from public, anon;
grant  execute on function is_platform_admin() to authenticated;
