-- Migration 115 DOWN — drop the payroll public API. Reversible; base RLS untouched.
drop function if exists public.pay_list_runs();
drop function if exists public.pay_run_payslips(uuid);
