-- =====================================================================================
-- Migration 111 — Views (security_invoker) & Materialized Views (+ tenant-safe wrappers)
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Read surfaces for HR / Payroll / Accounting / Compliance / Manager / ESS.
-- KEY SECURITY : Plain VIEWs use security_invoker=on (PG15+) so they RESPECT the caller''s RLS.
--                MATERIALIZED VIEWs do NOT honour RLS (they run as owner) — so every matview
--                carries society_id and is exposed ONLY through a security_barrier + security_invoker
--                wrapper view that re-applies the tenant filter. NEVER grant select on a matview.
-- DEPENDENCIES : 100-110.
-- ROLLBACK     : 999.
-- VERIFY       : as tenant A, select from pay_reporting.* returns only A''s rows.
-- =====================================================================================

-- ── VIEWS (RLS-respecting) ──────────────────────────────────────────────────────────

-- HR: current establishment snapshot (open primary appointment).
create view pay_reporting.v_employee_current
with (security_invoker = on) as
select e.society_id, e.id as employee_id, e.employee_code, e.full_name, e.status,
       a.id as appointment_id, a.designation_id, a.department_id, a.branch_id, a.pay_level
from pay_core.employee e
left join pay_core.appointment a
       on a.employee_id = e.id and a.is_primary and a.effective_to is null;
comment on view pay_reporting.v_employee_current is 'HR: employee + current primary appointment. RLS-respecting.';

-- Payroll / ESS: payslip header + lines (line detail visible within the caller''s RLS scope).
create view pay_reporting.v_payslip_detail
with (security_invoker = on) as
select p.society_id, p.pay_run_id, p.period_month, p.payslip_no, p.employee_id,
       p.gross_minor, p.deductions_minor, p.net_minor, p.status,
       l.component_id, l.computed_minor, l.formula_trace
from pay_calc.payslip p
join pay_calc.payslip_line l
  on l.payslip_id = p.id and l.period_month = p.period_month;
comment on view pay_reporting.v_payslip_detail is 'Payslip header + component lines. formula_trace is the AI-grounding citation for a computed figure.';

-- Manager: run summary.
create view pay_reporting.v_run_summary
with (security_invoker = on) as
select r.society_id, r.id as pay_run_id, r.run_no, r.period, r.scope_branch_id, r.scope_department_id,
       r.state, r.pay_basis, r.gross_total_minor, r.net_total_minor,
       (select count(*) from pay_calc.payslip s where s.pay_run_id = r.id) as headcount,
       (select count(*) from pay_calc.pay_exception x where x.pay_run_id = r.id and not x.resolved) as open_exceptions
from pay_calc.payroll_run r;
comment on view pay_reporting.v_run_summary is 'Manager/approver: one row per run with headcount + open exceptions.';

-- Accounting / Compliance: statutory liability position.
create view pay_reporting.v_statutory_position
with (security_invoker = on) as
select sl.society_id, sl.head, sl.period,
       sum(sl.payable_minor) as payable_minor,
       sum(sl.paid_minor)    as paid_minor,
       sum(sl.payable_minor - sl.paid_minor) as outstanding_minor
from pay_calc.statutory_liability sl
group by sl.society_id, sl.head, sl.period;
comment on view pay_reporting.v_statutory_position is 'Compliance/Accounting: payable vs paid per statutory head/period.';

-- ── MATERIALIZED VIEWS (owner-run; wrapped for tenancy) ─────────────────────────────

-- YTD register per employee/head (heavy aggregate; refreshed on run posting — Phase 5 job).
create materialized view pay_projection.mv_ytd as
select society_id, fy, employee_id, bucket_kind, bucket_code, sum(amount_minor) as amount_minor
from pay_projection.ytd_cumulative
group by society_id, fy, employee_id, bucket_kind, bucket_code
with no data;
create unique index mv_ytd_uq on pay_projection.mv_ytd (society_id, fy, employee_id, bucket_kind, bucket_code);

-- Department salary summary per period (from posted payslips).
create materialized view pay_projection.mv_department_summary as
select p.society_id, a.department_id, p.period_month,
       count(distinct p.employee_id) as headcount,
       sum(p.gross_minor) as gross_minor, sum(p.net_minor) as net_minor
from pay_calc.payslip p
join pay_core.appointment a on a.employee_id = p.employee_id and a.effective_to is null and a.is_primary
where p.status in ('posted','paid')
group by p.society_id, a.department_id, p.period_month
with no data;
create unique index mv_dept_uq on pay_projection.mv_department_summary (society_id, department_id, period_month);

-- Statutory head summaries (PF/ESI/TDS/… — one matview, head as a column; new head needs no new matview).
create materialized view pay_projection.mv_statutory_summary as
select society_id, head, period, sum(payable_minor) as payable_minor, sum(paid_minor) as paid_minor
from pay_calc.statutory_liability
group by society_id, head, period
with no data;
create unique index mv_stat_uq on pay_projection.mv_statutory_summary (society_id, head, period);

-- ── Tenant-safe wrapper views over the matviews (RLS re-applied) ────────────────────
-- Grant select on THESE, never on the matviews.
create view pay_reporting.v_ytd
with (security_invoker = on, security_barrier = true) as
  select * from pay_projection.mv_ytd where society_id = pay_core.current_society_uuid();
create view pay_reporting.v_department_summary
with (security_invoker = on, security_barrier = true) as
  select * from pay_projection.mv_department_summary where society_id = pay_core.current_society_uuid();
create view pay_reporting.v_statutory_summary
with (security_invoker = on, security_barrier = true) as
  select * from pay_projection.mv_statutory_summary where society_id = pay_core.current_society_uuid();

revoke all on pay_projection.mv_ytd, pay_projection.mv_department_summary, pay_projection.mv_statutory_summary
  from authenticated;
grant select on pay_reporting.v_ytd, pay_reporting.v_department_summary, pay_reporting.v_statutory_summary
  to authenticated;

-- SPECIFIED (Phase-5 additions, not created here to keep this migration focused):
--   pay_reporting.v_pf_ecr / v_esi_return / v_tds_24q      (statutory return extracts)
--   pay_reporting.v_ledger_summary                          (posting_link ↔ vouchers roll-up)
--   pay_reporting.v_employee_self                           (ESS, gated on employee↔user link)
