-- =====================================================================================
-- Migration 118 — employee attendance per period (paid days / LOP days).
-- Feeds the calc facts so pay is accurate to days worked (an LOP deduction reduces pay for
-- absent days). Society-scoped, one row per (employee, period). Additive; 118_down drops it.
-- =====================================================================================
create table if not exists pay_calc.attendance (
  id            uuid primary key default gen_random_uuid(),
  society_id    uuid not null references societies(id) on delete restrict,
  employee_id   uuid not null references pay_core.employee(id) on delete cascade,
  period_month  date not null,
  paid_days     numeric(5,2) not null default 30,
  lop_days      numeric(5,2) not null default 0,
  source        pay_core.attendance_source not null default 'manual',
  created_at    timestamptz not null default now(),
  created_by    uuid not null,
  updated_at    timestamptz,
  updated_by    uuid,
  constraint attendance_days_ck check (paid_days >= 0 and lop_days >= 0),
  constraint attendance_uq unique (society_id, employee_id, period_month)
);
alter table pay_calc.attendance enable row level security;
alter table pay_calc.attendance force  row level security;
create policy attendance_sel on pay_calc.attendance for select using (society_id = pay_core.current_society_uuid());
create policy attendance_ins on pay_calc.attendance for insert with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write());
create policy attendance_upd on pay_calc.attendance for update using (society_id = pay_core.current_society_uuid() and public.jwt_can_write()) with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write());
