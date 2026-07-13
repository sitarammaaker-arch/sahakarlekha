-- 024 down · re-grant anon EXECUTE on the feedback-admin RPCs (partial revert).
-- NOTE: the pre-024 bodies authorized via verify_platform_admin(), which slice S4 (migration 022)
-- DROPPED — so the RPC bodies cannot be restored to their old form without first restoring
-- verify_platform_admin + platform_admins.password. This down only reverses the anon revoke.
grant execute on function public.admin_feedback_list(text, text)                     to anon;
grant execute on function public.admin_feedback_set_status(text, text, uuid, text)   to anon;
grant execute on function public.admin_feedback_set_public(text, text, uuid, boolean) to anon;
