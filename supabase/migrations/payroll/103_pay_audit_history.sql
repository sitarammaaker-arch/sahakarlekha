-- =====================================================================================
-- Migration 103 — WORM audit & history tables (must precede any audited table)
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Immutable change log + per-domain configuration history. These are the
--                append-only backbone the generic audit trigger (102) writes to. Created
--                before establishment/config so their INSERT triggers have a target.
-- DEPENDENCIES : 100, 101, 102.
-- ROLLBACK     : 999.
-- VERIFY       : attempt UPDATE on pay_audit.change_log → raises PAY-ACC-720.
-- NOTE         : complements (does not replace) the platform public.audit_log; the app-level
--                logAudit() continues to write there. This captures ROW-LEVEL before/after.
-- =====================================================================================

create table pay_audit.change_log (
  id            uuid not null default gen_random_uuid(),
  primary key (id, occurred_at),                           -- partitioned table PK must include the partition key
  society_id    uuid,                                       -- nullable: platform-config rows have none
  entity_schema text not null,
  entity_table  text not null,
  entity_id     uuid,
  op            text not null check (op in ('INSERT','UPDATE','DELETE')),
  actor_email   text not null,
  before_row    jsonb,
  after_row     jsonb,
  occurred_at   timestamptz not null default now()
) partition by range (occurred_at);
comment on table pay_audit.change_log is 'WORM row-level audit. Partitioned monthly by occurred_at for retention/detach. No UPDATE/DELETE.';

-- Initial partitions + default (production would automate monthly creation via pg_cron).
create table pay_audit.change_log_2026 partition of pay_audit.change_log
  for values from ('2026-01-01') to ('2027-01-01');
create table pay_audit.change_log_2027 partition of pay_audit.change_log
  for values from ('2027-01-01') to ('2028-01-01');
create table pay_audit.change_log_default partition of pay_audit.change_log default;

create index cl_soc_time_idx  on pay_audit.change_log (society_id, occurred_at desc);
create index cl_entity_idx    on pay_audit.change_log (entity_table, entity_id);
create index cl_after_gin     on pay_audit.change_log using gin (after_row jsonb_path_ops);  -- ad-hoc audit queries

-- WORM enforcement.
create trigger cl_worm before update or delete on pay_audit.change_log
  for each row execute function pay_core.tg_worm_guard();

-- ── Configuration history (one shape reused for config/rule/formula/policy) ─────────
-- Written on supersession by domain triggers (attached in 105/106). Captures the version
-- lineage for fast "why did this value change" audits without replaying the whole journal.
create table pay_audit.config_history (
  id             uuid not null default gen_random_uuid(),
  primary key (id, occurred_at),                           -- partitioned table PK must include the partition key
  society_id     uuid,
  domain         text not null check (domain in ('config','rule','formula','policy','structure','component')),
  logical_key    text not null,                             -- rule key / component code / structure id, etc.
  version        int  not null,
  effective_from date not null,
  effective_to   date,
  status         pay_core.config_status not null,
  changed_by     text not null,
  change_reason  text,
  snapshot       jsonb not null,                            -- the versioned row image
  occurred_at    timestamptz not null default now()
) partition by range (occurred_at);
comment on table pay_audit.config_history is 'WORM lineage of every configurable version (rule/formula/policy/structure/component). Partitioned by time.';

create table pay_audit.config_history_2026 partition of pay_audit.config_history
  for values from ('2026-01-01') to ('2027-01-01');
create table pay_audit.config_history_2027 partition of pay_audit.config_history
  for values from ('2027-01-01') to ('2028-01-01');
create table pay_audit.config_history_default partition of pay_audit.config_history default;

create index ch_key_idx on pay_audit.config_history (domain, logical_key, version);
create trigger ch_worm before update or delete on pay_audit.config_history
  for each row execute function pay_core.tg_worm_guard();

-- ── Employment lifecycle events (WORM) ──────────────────────────────────────────────
create table pay_core.employment_event (
  id             uuid not null default gen_random_uuid(),
  primary key (id, occurred_at),                           -- partitioned table PK must include the partition key
  society_id     uuid not null references societies(id),
  employee_id    uuid not null,                             -- FK added in 104 after pay_core.employee exists
  event_type     text not null references pay_core.employment_event_type(code),
  effective_date date not null,
  detail         jsonb,
  producer_kind  pay_core.producer_kind not null default 'human',
  on_behalf_of   uuid,
  actor_email    text not null,
  occurred_at    timestamptz not null default now()
) partition by range (occurred_at);
comment on table pay_core.employment_event is 'WORM: join/promote/transfer/retire/… facts. Source of employment history.';

create table pay_core.employment_event_2026 partition of pay_core.employment_event
  for values from ('2026-01-01') to ('2027-01-01');
create table pay_core.employment_event_2027 partition of pay_core.employment_event
  for values from ('2027-01-01') to ('2028-01-01');
create table pay_core.employment_event_default partition of pay_core.employment_event default;

create index ee_emp_idx on pay_core.employment_event (society_id, employee_id, effective_date);
create trigger ee_worm before update or delete on pay_core.employment_event
  for each row execute function pay_core.tg_worm_guard();
