-- =====================================================================================
-- Migration 107 — Transactional core: runs, snapshots, payslips (partitioned), events
-- -------------------------------------------------------------------------------------
-- PURPOSE      : The event-sourced payroll heart. A run freezes a snapshot at Draft;
--                payslips + lines are children (partitioned by month for 100k-scale);
--                pay_event is the WORM journal (SoR for the state machine).
-- DEPENDENCIES : 100-106.
-- ROLLBACK     : 999.
-- PARTITIONING : payslip & payslip_line RANGE by period_month (detachable per FY).
--                pay_event kept NON-partitioned (a gapless per-aggregate sequence cannot be
--                globally unique across declarative partitions without the partition key in
--                the constraint) — BRIN on occurred_at gives cheap time scans. Documented
--                trade-off; future partition-by-range lands with a sequence-allocator (Phase 5).
-- VERIFY       : net_minor >= 0; line FK crosses the same partition; UPDATE pay_event → PAY-ACC-720.
-- =====================================================================================

-- ── Payroll run (aggregate root; not partitioned) ───────────────────────────────────
create table pay_calc.payroll_run (
  id                   uuid primary key default gen_random_uuid(),
  society_id           uuid not null references societies(id) on delete restrict,
  scope_branch_id      text references branches(id),
  scope_department_id  uuid references pay_core.department(id),
  period               pay_core.period_ym not null,
  period_month         date not null,                        -- first-of-month (partition key for children)
  pay_basis            pay_core.pay_basis not null default 'accrual',
  run_no               text not null,                        -- numbering authority
  state                pay_core.pay_run_state not null default 'draft',
  snapshot_id          uuid,                                 -- FK → run_snapshot (added below)
  posting_ref          uuid,                                 -- FK → pay_calc.posting_link (added in 108)
  gross_total_minor    pay_core.amount_minor not null default 0,
  net_total_minor      pay_core.amount_minor not null default 0,
  currency             pay_core.currency_code,
  created_at           timestamptz not null default now(),
  created_by           uuid not null,
  updated_at           timestamptz,
  updated_by           uuid,
  constraint run_no_uq       unique (society_id, run_no),
  constraint run_period_ck   check (period_month = to_date(period || '-01','YYYY-MM-DD')),
  constraint run_totals_ck   check (gross_total_minor >= 0 and net_total_minor >= 0)
);
comment on table pay_calc.payroll_run is 'Aggregate root. State machine Draft→Verified→Approved→Locked→Posted→Paid / Cancelled / Rolled_back.';
-- Only ONE open (non-terminal) run per scope+period+basis.
create unique index run_one_open on pay_calc.payroll_run (
    society_id, coalesce(scope_branch_id,''),
    coalesce(scope_department_id,'00000000-0000-0000-0000-000000000000'::uuid), period, pay_basis)
  where state not in ('cancelled','rolled_back');
create index run_state_idx on pay_calc.payroll_run (society_id, state, period_month);

-- ── Run snapshot (frozen ruleset+plan+config; immutable → reproducibility) ───────────
create table pay_calc.run_snapshot (
  id                    uuid primary key default gen_random_uuid(),
  pay_run_id            uuid not null references pay_calc.payroll_run(id) on delete restrict,
  resolved_rules_json   jsonb not null,
  formula_plan_json     jsonb not null,
  config_resolution_json jsonb not null,
  schema_version        int not null default 1,
  created_at            timestamptz not null default now(),
  constraint snapshot_run_uq unique (pay_run_id)
);
comment on table pay_calc.run_snapshot is 'Frozen at Draft. IMMUTABLE (WORM). Guarantees a posted run re-computes to identical figures.';
create trigger snapshot_worm before update or delete on pay_calc.run_snapshot
  for each row execute function pay_core.tg_worm_guard();
alter table pay_calc.payroll_run
  add constraint run_snapshot_fk foreign key (snapshot_id) references pay_calc.run_snapshot(id);

-- ── Payslip (child of run; partitioned by month) ────────────────────────────────────
create table pay_calc.payslip (
  id                uuid not null default gen_random_uuid(),
  society_id        uuid not null references societies(id) on delete restrict,
  pay_run_id        uuid not null references pay_calc.payroll_run(id) on delete restrict,
  employee_id       uuid not null references pay_core.employee(id) on delete restrict,
  period_month      date not null,                           -- partition key
  payslip_no        text not null,
  gross_minor       pay_core.amount_minor not null default 0,
  deductions_minor  pay_core.amount_minor not null default 0,
  net_minor         pay_core.amount_minor not null default 0,
  currency          pay_core.currency_code,
  paid_days         numeric(5,2) not null default 0,
  lop_days          numeric(5,2) not null default 0,
  status            pay_core.payslip_status not null default 'computed',
  created_at        timestamptz not null default now(),
  created_by        uuid not null,
  primary key (id, period_month),
  constraint payslip_no_uq   unique (society_id, payslip_no, period_month),
  constraint payslip_net_ck  check (net_minor >= 0),
  constraint payslip_math_ck check (net_minor = gross_minor - deductions_minor)
) partition by range (period_month);
comment on table pay_calc.payslip is 'One employee''s pay for a run. Child of payroll_run; partitioned monthly. Never independently mutated (reverse-run to correct).';

create table pay_calc.payslip_2026_27 partition of pay_calc.payslip
  for values from ('2026-04-01') to ('2027-04-01');
create table pay_calc.payslip_2027_28 partition of pay_calc.payslip
  for values from ('2027-04-01') to ('2028-04-01');
create table pay_calc.payslip_default partition of pay_calc.payslip default;
create index payslip_run_idx on pay_calc.payslip (pay_run_id);
create index payslip_emp_idx on pay_calc.payslip (society_id, employee_id, period_month);

-- ── Payslip line (child of payslip; partitioned by month; composite FK) ─────────────
create table pay_calc.payslip_line (
  id             uuid not null default gen_random_uuid(),
  society_id     uuid not null references societies(id) on delete restrict,
  payslip_id     uuid not null,
  period_month   date not null,                              -- partition key (matches parent)
  component_id   uuid not null references pay_config.component_catalog(id),
  computed_minor pay_core.amount_minor not null,             -- signed by kind (earning +, deduction −)
  currency       pay_core.currency_code,
  formula_trace  jsonb,                                      -- inputs + function path (audit / AI grounding)
  gl_dimension   jsonb,                                      -- cost_centre/project/fund tags
  sequence       int not null default 100,
  created_at     timestamptz not null default now(),
  primary key (id, period_month),
  constraint payslip_line_fk foreign key (payslip_id, period_month)
    references pay_calc.payslip(id, period_month) on delete cascade
) partition by range (period_month);
comment on table pay_calc.payslip_line is 'One component amount on a payslip. Composite FK keeps line & slip in the same partition. Cascades with the slip.';

create table pay_calc.payslip_line_2026_27 partition of pay_calc.payslip_line
  for values from ('2026-04-01') to ('2027-04-01');
create table pay_calc.payslip_line_2027_28 partition of pay_calc.payslip_line
  for values from ('2027-04-01') to ('2028-04-01');
create table pay_calc.payslip_line_default partition of pay_calc.payslip_line default;
create index payslip_line_slip_idx on pay_calc.payslip_line (payslip_id, period_month);
create index payslip_line_comp_idx on pay_calc.payslip_line (component_id);
create index payslip_line_gl_gin   on pay_calc.payslip_line using gin (gl_dimension jsonb_path_ops);

-- ── Exceptions (employees quarantined from a run) ───────────────────────────────────
create table pay_calc.pay_exception (
  id           uuid primary key default gen_random_uuid(),
  society_id   uuid not null references societies(id) on delete restrict,
  pay_run_id   uuid not null references pay_calc.payroll_run(id) on delete restrict,
  employee_id  uuid not null references pay_core.employee(id),
  reason_code  text not null,                                -- PAY-* code
  severity     text not null default 'error' check (severity in ('warning','error')),
  detail       jsonb,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid not null
);
create index exc_run_idx on pay_calc.pay_exception (pay_run_id) where not resolved;

-- ── pay_event — the WORM journal (SoR for the run lifecycle; ADR-0001) ───────────────
create table pay_calc.pay_event (
  event_id       uuid primary key default gen_random_uuid(),
  society_id     uuid not null references societies(id) on delete restrict,
  aggregate_type text not null default 'pay_run',
  aggregate_id   uuid not null,                              -- payroll_run.id
  sequence       bigint not null,                            -- gapless, 1-based per aggregate
  event_type     pay_core.pay_event_type not null,
  producer_kind  pay_core.producer_kind not null default 'human',
  on_behalf_of   uuid,                                       -- AI acting for a human (ADR-0010)
  actor_email    text not null,
  occurred_at    timestamptz not null default now(),
  payload        jsonb not null,
  schema_version int not null default 1,
  reversal_of    uuid references pay_calc.pay_event(event_id),
  constraint pay_event_seq_uq unique (aggregate_type, aggregate_id, sequence)
);
comment on table pay_calc.pay_event is 'Append-only payroll journal. Corrections are reversing events. NON-partitioned (gapless global sequence). WORM.';
create index pay_event_agg_idx  on pay_calc.pay_event (aggregate_id, sequence);
create index pay_event_time_brin on pay_calc.pay_event using brin (occurred_at);
create trigger pay_event_worm before update or delete on pay_calc.pay_event
  for each row execute function pay_core.tg_worm_guard();

-- ── YTD projection (rebuildable read-model) ─────────────────────────────────────────
create table pay_projection.ytd_cumulative (
  id           uuid primary key default gen_random_uuid(),
  society_id   uuid not null references societies(id) on delete restrict,
  employee_id  uuid not null references pay_core.employee(id),
  fy           text not null,                                -- e.g. 2026-27
  bucket_kind  text not null check (bucket_kind in ('component','statutory')),
  bucket_code  text not null,                                -- component code or statutory_head code
  amount_minor pay_core.amount_minor not null default 0,
  refreshed_at timestamptz not null default now(),
  constraint ytd_uq unique (employee_id, fy, bucket_kind, bucket_code)
);
comment on table pay_projection.ytd_cumulative is 'Projection: YTD per employee/head. Rebuildable from pay_event (pay_projection.rebuild). Never a source of truth.';
create index ytd_emp_idx on pay_projection.ytd_cumulative (society_id, employee_id, fy);

-- audit triggers on the mutable transactional tables (payslip/line are child projections of the run;
-- audited at run grain via pay_event, so we audit run + exceptions here to avoid 100k audit rows/run).
create trigger run_audit after insert or update on pay_calc.payroll_run
  for each row execute function pay_core.tg_pay_audit();
create trigger run_touch before update on pay_calc.payroll_run
  for each row execute function pay_core.tg_touch_updated();
