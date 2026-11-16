-- 173 · a deactivated user has no society
--
-- Audit 2026-11-16 (docs/audits/SAHAKARLEKHA-USER-JOURNEY-CONVERSION-AUDIT.md, S-3).
--
-- An admin "deactivates" a user by setting society_users.is_active = false. Login refuses such a user, but
-- a session that is ALREADY open (or a saved refresh token) kept working: get_current_society_id() — the
-- helper behind the RLS policies of every tenant table created by migration 007 — did not look at
-- is_active (097 kept that on purpose: "no is_active filter added"). Its sibling
-- current_user_society_ids() (vouchers / members / accounts) has filtered on is_active since 085, so the
-- two disagreed: by the policy text, a deactivated user loses vouchers but still matches ledger_events,
-- audit_log, branches, financial_years and the other tables scoped by this helper. (Read from the SQL, not
-- reproduced against a live database — the staging check in the PR notes settles it either way.)
--
-- Fix: both JWT helpers ignore a row that has been switched off.
--     get_current_society_id()  → NULL  for a deactivated user  → every tenant policy matches no row
--     get_current_user_role()   → NULL  for a deactivated user
-- `is_active is not false` (not `= true`) so a row whose flag was never set behaves exactly as before;
-- only an explicit deactivation changes anything. Active users are unaffected.
--
-- Bodies are 097's (society id) and 085's (role) with only the lines marked "173".
--
-- anon-exec: get_current_society_id — evaluated inside RLS policies granted to `public` (incl. anon
-- requests); revoking it would turn those reads into errors. For anon it returns NULL (no JWT email).
-- anon-exec: get_current_user_role — same reason: read inside RLS policies; NULL for anon.
-- CREATE OR REPLACE keeps the existing grants.
--
-- Idempotent. Undo: 173_inactive_user_no_tenant_down.sql.

begin;

create or replace function public.get_current_society_id()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select society_id::text from public.society_users
  where lower(email) = lower(auth.jwt() ->> 'email') and not public.jwt_mfa_pending()
    and is_active is not false   -- 173
  limit 1;
$function$;

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select role from public.society_users
  where email = auth.jwt() ->> 'email' and not public.jwt_mfa_pending()
    and is_active is not false   -- 173
  limit 1;
$function$;

insert into public.app_migrations (version, name) values ('173', 'inactive_user_no_tenant')
  on conflict (version) do nothing;

commit;

-- VERIFY (run after the migration; read-only — both must be true):
--   select pg_get_functiondef('public.get_current_society_id'::regproc) ~ 'is_active is not false' as society_helper_ok,
--          pg_get_functiondef('public.get_current_user_role'::regproc)  ~ 'is_active is not false' as role_helper_ok;
-- How many logins this affects right now (deactivated users — expect a small number, often 0):
--   select count(*) from public.society_users where is_active is false;
