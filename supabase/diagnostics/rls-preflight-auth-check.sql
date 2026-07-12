-- ============================================================================
-- P1-SEC-1 · RLS TENANT-ISOLATION PRE-FLIGHT  —  READ ONLY. APPLIES NOTHING.
-- ============================================================================
-- Purpose: decide whether tenant-scoped RLS can be enforced NOW without locking
-- out users. The RLS tenant key (get_current_society_id, migration 001) reads
--     society_id FROM society_users WHERE email = auth.jwt()->>'email'
-- so it ONLY works for users who present a Supabase Auth JWT. A JWT-less user
-- (login path-3 / legacy plain-text auth) resolves to NULL and would be DENIED
-- on every tenant-scoped table.
--
-- Run this in the Supabase SQL Editor (it has access to the `auth` schema).
-- Nothing here writes, alters, or drops anything.
-- ============================================================================

-- ── (1) JWT COVERAGE — the decision query ───────────────────────────────────
-- How many society_users CAN present a JWT (exist in auth.users) vs cannot?
--   jwt_less_legacy = 0  →  BRANCH 1: safe to enforce RLS now.
--   jwt_less_legacy > 0  →  BRANCH 2: migrate those users to Supabase Auth first
--                                     (P1-SEC-2 / T-18) — enforcing RLS now would
--                                     lock them out.
select
  count(*)                                    as society_users_total,
  count(*) filter (where au.id is not null)   as with_supabase_auth_jwt,
  count(*) filter (where au.id is null)       as jwt_less_legacy
from public.society_users su
left join auth.users au on lower(au.email) = lower(su.email);

-- ── (2) WHICH TENANTS ARE AT RISK — per-society breakdown of legacy users ───
select su.society_id,
       count(*)                                as users,
       count(*) filter (where au.id is null)   as jwt_less_legacy
from public.society_users su
left join auth.users au on lower(au.email) = lower(su.email)
group by su.society_id
having count(*) filter (where au.id is null) > 0
order by jwt_less_legacy desc;

-- ── (3) DOES THE 001 TENANT HELPER EXIST? (RLS policies depend on it) ────────
-- If these are missing, migration 001 was never applied and migration 006 must
-- (re)create them.
select proname
from pg_proc
where proname in ('get_current_society_id', 'get_current_user_role');

-- ── (4) LIVE PERMISSIVE-POLICY INVENTORY — what actually needs tightening ────
-- The tables whose current policy is unconditionally true (open to any caller).
select tablename, policyname, cmd,
       coalesce(qual, '')       as using_expr,
       coalesce(with_check, '') as check_expr
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
order by tablename, policyname;

-- ── (5) TABLES WITH RLS ENABLED BUT *NO* POLICY (implicitly deny-all) ────────
-- These would already be blocking all client access; useful to know before 006.
select c.relname as table_no_policy
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = true
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
order by c.relname;
