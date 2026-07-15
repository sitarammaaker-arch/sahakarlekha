-- 041 down · remove the admin password-reset RPC. The Edit User dialog's password
-- field will fail loudly (RPC missing) rather than silently no-op — do not revert
-- the UserManagement.tsx change without also restoring this function.
drop function if exists public.app_reset_society_user_password(text, text);
