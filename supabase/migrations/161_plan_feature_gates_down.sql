-- 161 down · removes the payroll plan triggers and plan_allows(). Payroll is then open to every plan on the
-- server again (the app's own gate is unaffected by this file).
begin;

drop trigger if exists trg_plan_payroll on pay_core.employee;
drop trigger if exists trg_plan_payroll on pay_calc.payroll_run;
drop function if exists public.tg_require_plan_payroll();
drop function if exists public.plan_allows(text, text);

delete from public.app_migrations where version = '161';

commit;

notify pgrst, 'reload schema';
