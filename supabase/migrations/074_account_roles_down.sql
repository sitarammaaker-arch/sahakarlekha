-- 074 down · drop account_roles and accounts.report_class. Nothing reads either yet, so the app
-- is unaffected; any role map or report classes entered after 074 are lost.
begin;
drop policy if exists account_roles_tenant_select on public.account_roles;
drop table if exists public.account_roles;
alter table public.accounts drop constraint if exists accounts_report_class_check;
alter table public.accounts drop column if exists report_class;
delete from public.app_migrations where version = '074';
commit;
