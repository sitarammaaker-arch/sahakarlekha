-- 111 down · stop adding payroll roles automatically. The account_roles rows it already wrote are valid and are kept.
begin;
drop trigger if exists trg_payroll_role_for_new_account on public.accounts;
drop function if exists public.tg_payroll_role_for_new_account();
delete from public.app_migrations where version = '111';
commit;
