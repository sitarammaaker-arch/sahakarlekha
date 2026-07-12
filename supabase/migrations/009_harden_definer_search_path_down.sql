-- ============================================================================
-- P1-SEC-3 · ROLLBACK of 009 — un-pin search_path on the five definer functions
-- ============================================================================
-- ALTER FUNCTION ... RESET search_path removes the per-function setting, returning
-- each to the inherited (mutable) search_path — i.e. the exact pre-009 state.
-- Body / return type / grants untouched. Covers both update_society_subscription
-- overloads via the same catalog-driven loop.
--
-- WARNING: this RE-OPENS the mutable-search_path surface (the
-- `function_search_path_mutable` finding). Provided only for faithful
-- reversibility of 009; leaving search_path pinned is the desired state.
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
      and p.prosecdef
      and p.proname in ('get_all_societies','get_society_user_counts',
                        'update_society_subscription','issue_certificate',
                        'verify_certificate')
  loop
    execute format('alter function public.%I(%s) reset search_path',
                   r.proname, r.args);
  end loop;
end $$;

commit;
