-- 123 down · removes the login attempt limit and the session-ending helper. Deploy the previous member-portal-admin and
-- stop using member-portal-login FIRST (they call these functions).
begin;
drop function if exists public.member_portal_end_sessions(uuid);
drop function if exists public.member_portal_login_success(text);
drop function if exists public.member_portal_login_begin(text);
drop table if exists public.member_portal_login_attempts;
delete from public.app_migrations where version = '123';
commit;
