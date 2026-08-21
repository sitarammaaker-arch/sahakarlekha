-- 058 down — remove the manual activation RPC. Existing subscription rows are left intact.
drop function if exists public.admin_activate_subscription(text, text, int);
