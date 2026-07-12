-- ============================================================================
-- P1-SEC-5 · A — wipe plain-text passwords out of society_users.password
-- ============================================================================
-- society_users held plain-text passwords for all 20 users, and society_users is
-- tenant-readable under RLS (society_users_read), so any same-society user could
-- read colleagues' passwords.
--
-- A column-level `REVOKE SELECT (password)` does NOT work here: Supabase grants
-- anon + authenticated TABLE-level SELECT on society_users, and a table-level
-- grant overrides column-level revokes (verified via role_table_grants). Rather
-- than tear down the table grant and re-grant every column except one (fragile),
-- we remove the SECRET itself — set every stored password to '' (the column is
-- NOT NULL, so '' satisfies it). Immediately effective; a reader now sees only ''.
--
-- Auth is unaffected: real credentials live in auth.users (bcrypt) and login goes
-- through Supabase Auth. app_login (the only reader of this column) was already
-- dropped in 010, and UserManagement no longer selects it (PR #61).
--
-- This clears the EXISTING 20. The write-paths (app_register_admin,
-- app_add_society_user, app_set_my_password, and the UserManagement edit write)
-- still store plain-text for NEW/edited users — stopping those and dropping the
-- column is the P1-SEC-5·B follow-up.
-- ============================================================================

begin;

update public.society_users
   set password = ''
 where password is distinct from '';

commit;
