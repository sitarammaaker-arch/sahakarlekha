-- 026 down · drop platform-admin recovery RPCs.
drop function if exists platform_admin_mfa_gen_recovery(text);
drop function if exists platform_admin_verify_recovery(text);
