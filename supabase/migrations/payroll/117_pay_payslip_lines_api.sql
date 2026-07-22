-- =====================================================================================
-- Migration 117 — public API: payslip line-items (the salary breakdown for the UI).
-- Returns each computed component line (BASIC, DA, HRA, PF, …) with its label + kind so the UI can
-- group earnings vs deductions. Additive + reversible (117_down).
--
-- SECURITY DEFINER with an EXPLICIT tenant guard: the payslip's own society must equal the caller's
-- (pay_core.current_society_uuid()), so a caller only ever sees their own society's lines. DEFINER
-- (not INVOKER) is used deliberately — the join needs pay_config.component_version for the `kind`,
-- and that config table has no society_id column so it is not covered by the tenant SELECT policies
-- (same RLS gap class as 116, but for society-less config tables). The explicit guard keeps this
-- tenant-safe without depending on those missing policies.
-- =====================================================================================
create or replace function public.pay_payslip_lines(p_payslip_id uuid)
returns table(code text, name jsonb, kind text, computed_minor bigint, currency text, seq int)
language sql stable security definer set search_path = public, pay_calc, pay_config, pay_core as $$
  select cc.code, cc.display_name, cv.kind, l.computed_minor, l.currency, l.sequence
  from pay_calc.payslip p
  join pay_calc.payslip_line l on l.payslip_id = p.id and l.period_month = p.period_month
  join pay_config.component_catalog cc on cc.id = l.component_id
  left join lateral (
    select kind from pay_config.component_version v
    where v.component_id = cc.id and v.status = 'active'
    order by v.effective_from desc limit 1
  ) cv on true
  where p.id = p_payslip_id
    and p.society_id = pay_core.current_society_uuid()   -- tenant guard (DEFINER bypasses RLS)
  order by l.sequence, cc.code;
$$;
grant execute on function public.pay_payslip_lines(uuid) to authenticated;
