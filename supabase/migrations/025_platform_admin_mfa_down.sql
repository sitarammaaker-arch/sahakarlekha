-- 025 down · drop platform-admin MFA enrolment (slice A). Also clears any enrolled admin secrets.
drop function if exists platform_admin_mfa_enroll(text, text);
drop function if exists platform_admin_mfa_disable(text);
drop function if exists platform_admin_mfa_status();
-- Remove any platform-admin secrets stored under user_mfa (emails present in platform_admins).
delete from user_mfa where email in (select lower(email) from platform_admins);
alter table platform_admins drop column if exists mfa_enabled;
