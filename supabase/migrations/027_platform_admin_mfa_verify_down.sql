-- 027 down · drop the platform-admin MFA login verifier (disables slice-B enforcement server-side).
drop function if exists platform_admin_mfa_verify(text);
