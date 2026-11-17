-- Undo 175: drop the "one salary path per month" trigger on salary_records.
begin;
drop trigger if exists salary_slip_refuse_if_payroll_run on public.salary_records;
drop function if exists public._salary_slip_refuse_if_payroll_run();
delete from public.app_migrations where version = '175';
commit;
