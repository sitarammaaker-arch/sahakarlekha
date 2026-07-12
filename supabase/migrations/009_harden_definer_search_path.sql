-- ============================================================================
-- P1-SEC-3 · Harden SECURITY DEFINER functions — pin search_path (via ALTER)
-- ============================================================================
-- These SECURITY DEFINER functions run as the owner (elevated) but were created
-- WITHOUT a fixed search_path, so they inherit the CALLER's mutable search_path —
-- the classic Postgres privilege-escalation surface Supabase's Security Advisor
-- flags as `function_search_path_mutable`. Every other definer function here
-- (app_login, app_register_admin, MFA, feedback-admin, 006/007 helpers) already
-- pins search_path; these were missed.
--
-- We use ALTER FUNCTION ... SET search_path (NOT create-or-replace): it changes
-- ONLY the search_path config — body, return type and GRANTs are untouched. This
-- is drift-proof: production has schema drift here (get_all_societies' return type
-- differs from the repo, and update_society_subscription exists as TWO overloads —
-- p_plan_expires_at date AND timestamptz), which would break create-or-replace.
--
-- The DO block discovers every matching function by name and alters each by its
-- exact catalog signature, so BOTH update_society_subscription overloads (and any
-- future drift) are covered automatically. Idempotent. No table / policy / data
-- change.
-- ============================================================================

begin;

do $$
declare r record;
begin
  for r in
    select p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef                                   -- SECURITY DEFINER only
      and p.proname in ('get_all_societies','get_society_user_counts',
                        'update_society_subscription','issue_certificate',
                        'verify_certificate')
  loop
    execute format('alter function public.%I(%s) set search_path = public, extensions',
                   r.proname, r.args);
  end loop;
end $$;

commit;
