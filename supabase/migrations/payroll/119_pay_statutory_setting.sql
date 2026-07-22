-- =====================================================================================
-- Migration 119 — editable statutory rates per society (admin-owned, sourced).
-- Statutory values (PF %, ESI %, thresholds…) are NEVER hard-coded — the society's admin enters the
-- AUTHORITATIVE figure with its source (Act/circular/URL), and the payroll formulas consume it as a
-- scalar variable. Society-scoped, one row per key. Additive; 119_down drops it.
-- =====================================================================================
create table if not exists pay_config.statutory_setting (
  id          uuid primary key default gen_random_uuid(),
  society_id  uuid not null references societies(id) on delete restrict,
  key         text not null,                 -- e.g. 'pf_rate', 'esi_rate'
  value_num   numeric not null,              -- the rate / threshold the admin entered
  label       text,                          -- human label
  source      text,                          -- the AUTHORITATIVE source (Act section / circular / URL)
  created_at  timestamptz not null default now(),
  created_by  uuid not null,
  updated_at  timestamptz,
  updated_by  uuid,
  constraint statutory_setting_uq unique (society_id, key)
);
alter table pay_config.statutory_setting enable row level security;
alter table pay_config.statutory_setting force  row level security;
create policy statutory_setting_sel on pay_config.statutory_setting for select using (society_id = pay_core.current_society_uuid());
create policy statutory_setting_ins on pay_config.statutory_setting for insert with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write());
create policy statutory_setting_upd on pay_config.statutory_setting for update using (society_id = pay_core.current_society_uuid() and public.jwt_can_write()) with check (society_id = pay_core.current_society_uuid() and public.jwt_can_write());
