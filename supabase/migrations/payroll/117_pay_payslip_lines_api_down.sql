-- Migration 117 DOWN — drop the payslip line-items API.
drop function if exists public.pay_payslip_lines(uuid);
