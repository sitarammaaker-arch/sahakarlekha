-- =====================================================================================
-- Migration 115 — public API for the payroll UI.
-- The browser (PostgREST) can only reach the `public` schema, so these SECURITY INVOKER
-- functions are the tenant-safe read surface over the pay_* schemas. INVOKER ⇒ the caller's
-- RLS (tenant + role + branch, migration 110) applies unchanged — a user sees only their own
-- society's runs/payslips. Granted to `authenticated` only.
-- Additive + reversible (115_down drops them). Independent of 114 (the AAL2 gate).
-- =====================================================================================

-- Payroll runs for the caller's tenant, with a payslip count + total net (from the payslips).
create or replace function public.pay_list_runs()
returns table(run_id uuid, run_no text, period text, period_month date, state text, currency text,
              created_at timestamptz, payslip_count int, total_net_minor bigint)
language sql stable security invoker set search_path = public, pay_calc, pay_core as $$
  select r.id, r.run_no, r.period, r.period_month, r.state::text, r.currency, r.created_at,
         count(p.id)::int, coalesce(sum(p.net_minor), 0)::bigint
  from pay_calc.payroll_run r
  left join pay_calc.payslip p on p.pay_run_id = r.id
  group by r.id
  order by r.created_at desc;
$$;
grant execute on function public.pay_list_runs() to authenticated;

-- Payslips of one run (the run-detail view). RLS still scopes to the caller's tenant.
create or replace function public.pay_run_payslips(p_run_id uuid)
returns table(payslip_id uuid, employee_code text, employee_name jsonb, payslip_no text,
              gross_minor bigint, deductions_minor bigint, net_minor bigint, currency text,
              paid_days numeric, lop_days numeric, status text)
language sql stable security invoker set search_path = public, pay_calc, pay_core as $$
  select p.id, e.employee_code, e.full_name, p.payslip_no,
         p.gross_minor, p.deductions_minor, p.net_minor, p.currency, p.paid_days, p.lop_days, p.status::text
  from pay_calc.payslip p
  join pay_core.employee e on e.id = p.employee_id
  where p.pay_run_id = p_run_id
  order by e.employee_code;
$$;
grant execute on function public.pay_run_payslips(uuid) to authenticated;
