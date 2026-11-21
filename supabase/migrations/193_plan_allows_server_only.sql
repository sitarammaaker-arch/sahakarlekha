-- 193 · NEW-09 (product audit 2026-11-17) — plan_allows() is server-only.
--
-- 161 granted EXECUTE on plan_allows(p_society_id, p_feature) to `authenticated`. It is SECURITY DEFINER and answers
-- for ANY society id passed in, so a signed-in user of one society could ask about another society's plan.
-- Its only caller is the payroll trigger tg_require_plan_payroll(), which is SECURITY DEFINER owned by postgres and
-- calls it as the owner. No browser code or Edge Function calls it (checked in the repo and in production on
-- 2026-11-21). So the grant to `authenticated` is removed; service_role keeps it.
-- Undo: 193_plan_allows_server_only_down.sql.
begin;

revoke execute on function public.plan_allows(text, text) from authenticated;

insert into public.app_migrations (version, name) values ('193', 'plan_allows_server_only')
  on conflict (version) do nothing;

commit;

-- VERIFY (expect: auth_exec = false | service_exec = true | mig = 1):
--   select has_function_privilege('authenticated', 'public.plan_allows(text,text)', 'execute') as auth_exec,
--          has_function_privilege('service_role', 'public.plan_allows(text,text)', 'execute') as service_exec,
--          (select count(*) from public.app_migrations where version = '193') as mig;
