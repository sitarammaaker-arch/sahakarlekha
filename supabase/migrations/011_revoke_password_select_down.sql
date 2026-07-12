-- ============================================================================
-- P1-SEC-5 · A — ROLLBACK: re-grant column SELECT on society_users.password
-- ============================================================================
-- WARNING: this re-opens the plain-text password read path to any authenticated
-- same-society user. Provided only for faithful reversibility of 011.
-- ============================================================================

begin;

grant select (password) on public.society_users to anon, authenticated;

commit;
