-- ============================================================================
-- P1-SEC-5 · A — block clients from READING society_users.password (plain-text)
-- ============================================================================
-- society_users holds plain-text passwords (20/20) and is tenant-readable under
-- RLS (policy society_users_read: society_id in current_user_society_ids()). RLS
-- is row-level, not column-level, so ANY authenticated same-society user could
-- `select password from society_users` and read colleagues' plain-text passwords
-- — an active credential-leak / privilege-escalation vector.
--
-- Revoking the column-level SELECT privilege for anon + authenticated blocks that
-- read for every client, regardless of RLS. Safe because:
--   • the app never selects `password` after the UserManagement fix (PR pending),
--     and login selects only id/name/email/role/society_id/is_active/mfa/branch;
--   • SECURITY DEFINER RPCs run as the table owner and are unaffected;
--   • UPDATE / INSERT (write) privileges are untouched, so user create/edit and
--     password writes still work.
--
-- This does NOT remove plain-text at rest. Stopping the write-paths
-- (app_register_admin / app_add_society_user / app_set_my_password + the
-- UserManagement edit write) and dropping the column is the P1-SEC-5·B follow-up.
--
-- ORDER: deploy the UserManagement read-fix FIRST, then run this — otherwise the
-- live user-list query (which still selects password) would fail.
-- ============================================================================

begin;

revoke select (password) on public.society_users from anon, authenticated;

commit;
