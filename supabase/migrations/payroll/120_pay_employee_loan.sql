-- =====================================================================================
-- Migration 120 — employee loans / advances (staff advance recovery).
--
-- Cooperative societies routinely advance money to staff and recover it from salary. The
-- calc already understood this (ExecutionContext.facts.loan → the `loanRecovery` money var,
-- and the 'loan_recovery' component kind deducts it) — it just had nowhere to read a loan
-- FROM. This is that table.
--
-- ONE active loan per employee (partial unique index): the payslip carries a single
-- LOAN_RECOVERY line, so a single active loan keeps the recovery unambiguously attributable
-- when pay-pay credits it back. Additional advances wait until the current one closes.
--
-- Recovery is credited only when a run is actually PAID (pay-pay), never at compute time —
-- a cancelled or reversed run must not reduce what the employee still owes.
--
-- Additive + reversible (120_..._down.sql). RLS mirrors 118/119: tenant-scoped.
-- =====================================================================================
create table if not exists pay_calc.employee_loan (
  id                 uuid primary key default gen_random_uuid(),
  society_id         uuid not null references societies(id) on delete restrict,
  employee_id        uuid not null references pay_core.employee(id) on delete restrict,
  principal_minor    bigint not null check (principal_minor > 0),
  installment_minor  bigint not null check (installment_minor > 0),
  recovered_minor    bigint not null default 0 check (recovered_minor >= 0),
  purpose            text,
  status             text not null default 'active' check (status in ('active','closed','cancelled')),
  started_on         date not null default current_date,
  closed_on          date,
  created_at         timestamptz not null default now(),
  created_by         uuid not null,
  updated_at         timestamptz,
  updated_by         uuid,
  constraint loan_recovered_ck   check (recovered_minor <= principal_minor),
  constraint loan_installment_ck check (installment_minor <= principal_minor)
);
comment on table pay_calc.employee_loan is
  'Staff advance / loan recovered from salary. One ACTIVE loan per employee; recovery is credited by pay-pay when a run is paid.';

create unique index if not exists loan_one_active
  on pay_calc.employee_loan (employee_id) where status = 'active';
create index if not exists loan_emp_idx on pay_calc.employee_loan (society_id, employee_id, status);

alter table pay_calc.employee_loan enable row level security;
alter table pay_calc.employee_loan force row level security;

drop policy if exists loan_sel on pay_calc.employee_loan;
create policy loan_sel on pay_calc.employee_loan for select
  using (society_id = pay_core.current_society_uuid());
drop policy if exists loan_ins on pay_calc.employee_loan;
create policy loan_ins on pay_calc.employee_loan for insert
  with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write());
drop policy if exists loan_upd on pay_calc.employee_loan;
create policy loan_upd on pay_calc.employee_loan for update
  using (society_id = pay_core.current_society_uuid() and public.jwt_can_write())
  with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write());
