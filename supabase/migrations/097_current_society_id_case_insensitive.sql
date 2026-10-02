-- 097 · get_current_society_id(): match the login email case-insensitively.
--
-- Why: the helper compared society_users.email to the JWT email EXACTLY, while its sibling
-- current_user_society_ids() (vouchers/members/accounts RLS) compares lower()/lower(). Supabase Auth
-- stores emails lower-case, so a society_users row saved with capitals made this helper return NULL
-- for that user: every table whose RLS uses it (ledger_events, audit_log, society_flags,
-- document_sequences, branches, kachi_aarat_entries, recoverables, p7_entries, financial_years, … —
-- 20 tables in prod on 2026-10-02) silently refused that user's reads and writes, while vouchers
-- still saved. Found via Assandh (one admin, mixed-case email): its journal appends and chart-edit
-- audits never landed, and a voucher edit could not see the journal it had to reverse.
--
-- Semantics otherwise unchanged (no is_active filter added; still `limit 1`; MFA gate kept).
-- Idempotent. Down: 097_current_society_id_case_insensitive_down.sql.
--
-- anon-exec: get_current_society_id — evaluated inside RLS policies granted to `public` (incl. anon
-- requests); revoking it would turn those reads into errors. For anon it returns NULL (no JWT email),
-- which matches no row. CREATE OR REPLACE keeps the existing grants.
--
-- Applied in prod 2026-10-02 (verified: helper uses lower(email), 0 mixed-case emails, grants intact).

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
  limit 1;
$function$;

-- Normalise stored emails so every other exact comparison agrees too. Skips a row whose lower-case
-- form would collide with another row (none in prod on 2026-10-02).
update public.society_users su
   set email = lower(su.email)
 where su.email <> lower(su.email)
   and not exists (select 1 from public.society_users o
                    where o.id <> su.id and lower(o.email) = lower(su.email));

insert into public.app_migrations (version, name) values ('097', 'current_society_id_case_insensitive')
  on conflict (version) do nothing;

commit;

-- Verify (run after): both must return 0 rows / 0.
--   select count(*) from public.society_users where email <> lower(email);
--   select pg_get_functiondef('public.get_current_society_id'::regproc) ~ 'lower\(email\)';  -- true
