-- ============================================================================
-- P1-SEC-5 · B — ROLLBACK: remove the password-blanking trigger
-- ============================================================================
-- WARNING: after this, the write-paths again store plain-text in
-- society_users.password for new/edited/reset users. Provided only for faithful
-- reversibility of 012.
-- ============================================================================

begin;

drop trigger if exists trg_force_blank_su_password on public.society_users;
drop function if exists public.force_blank_society_user_password();

commit;
