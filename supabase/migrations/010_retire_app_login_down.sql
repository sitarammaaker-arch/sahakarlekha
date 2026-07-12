-- ============================================================================
-- P1-SEC-4 · B — ROLLBACK: recreate the app_login RPC (verbatim from
-- supabase-app-login.sql)
-- ============================================================================
-- WARNING: this restores a JWT-less, plain-text-password verification endpoint.
-- Provided only for faithful reversibility of 010; the retired state is desired.
-- The client no longer calls it (PR #60), so recreating it alone does not restore
-- the login path.
-- ============================================================================

begin;

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
      su.password = p_password
      or (su.password like '$2%' and su.password = crypt(p_password, su.password))
    )
  limit 1;
$fn$;

revoke all on function public.app_login(text, text) from public;
grant execute on function public.app_login(text, text) to anon, authenticated;

commit;
