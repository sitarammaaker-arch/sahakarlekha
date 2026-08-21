-- 059 · Phase 2a-5c-1 — platform-admin read of ALL subscriptions.
--
-- The subscriptions RLS (055) is read-own-society only, so a platform admin cannot
-- see every society's row through normal SELECT. This SECURITY DEFINER function
-- returns the whole table BUT only to a verified platform admin (is_platform_admin,
-- 019) — a non-admin caller gets zero rows, never an error. Lets SuperAdminDashboard
-- show each society's canonical tier/status/seats/renewal from `subscriptions`
-- (reconciling away the old coarse societies.plan). Reversible via _down.

create or replace function public.admin_list_subscriptions()
returns setof public.subscriptions
language sql
security definer
set search_path = public, extensions
stable
as $$
  select * from public.subscriptions where public.is_platform_admin();
$$;

revoke all on function public.admin_list_subscriptions() from public, anon;
grant execute on function public.admin_list_subscriptions() to authenticated;
