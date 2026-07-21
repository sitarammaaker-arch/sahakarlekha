-- =====================================================================================
-- Migration 106 — Rule catalog (SOURCED), Formula catalog (+DAG), Policy catalog + facts
-- -------------------------------------------------------------------------------------
-- PURPOSE      : The three metadata engines' storage. Rules are effective-dated, jurisdiction-
--                scoped and SOURCED (verified ⟹ a source row exists — the hard-won integrity
--                rule). Formulas persist their dependency DAG (cycle detection is a query).
--                Policies are typed config that produce facts (attendance/leave).
-- DEPENDENCIES : 100-105. Resolves the forward formula_ref/eligibility FKs left in 105.
-- ROLLBACK     : 999.
-- VERIFY       : mark a rule_value verified w/o a rule_source → PAY-CMP-501 (deferrable constraint);
--                a formula_dependency self-cycle is detectable via pay_formula.validate_dag().
-- =====================================================================================

-- ── RULE catalog ────────────────────────────────────────────────────────────────────
create table pay_rule.rule_catalog (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,                          -- e.g. pf.rate.employee, pt.slab, tds.slab
  kind        pay_core.rule_kind not null,
  display_name pay_core.i18n_label not null,
  description  text,
  is_system   boolean not null default true
);
comment on table pay_rule.rule_catalog is 'The set of resolvable rule keys. Kind drives interpretation of value_json.';

create table pay_rule.rule_value (
  id             uuid primary key default gen_random_uuid(),
  rule_id        uuid not null references pay_rule.rule_catalog(id) on delete restrict,
  society_id     uuid references societies(id) on delete restrict,   -- NULL for platform/jurisdiction rows
  scope_level    pay_core.scope_level not null,
  scope_ref      uuid,                                        -- entity at that level; null for global/country/state
  jurisdiction   pay_core.jurisdiction_code,
  when_predicate jsonb,                                       -- attribute condition (e.g. regime=new)
  value_json     jsonb not null,                              -- rate/threshold/slab payload
  verified       boolean not null default false,             -- true ⟹ at least one rule_source (deferred check)
  version        int not null default 1,
  effective_from date not null,
  effective_to   date,
  status         pay_core.config_status not null default 'draft',
  approved_by    uuid,
  approved_at    timestamptz,
  supersedes_id  uuid references pay_rule.rule_value(id),
  change_reason  text,
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz,
  updated_by     uuid,
  constraint rulev_eff_ck check (effective_to is null or effective_to > effective_from)
);
comment on table pay_rule.rule_value is 'Effective-dated, jurisdiction-scoped rule value. Most-specific-then-most-recent resolution. NULL match = caller refuses (no guess).';
create index rulev_resolve_idx on pay_rule.rule_value (rule_id, jurisdiction, effective_from desc)
  where status = 'active';
create index rulev_scope_idx   on pay_rule.rule_value (scope_level, scope_ref) where status = 'active';

create table pay_rule.rule_source (
  id            uuid primary key default gen_random_uuid(),
  rule_value_id uuid not null references pay_rule.rule_value(id) on delete cascade,
  source_url    text not null,                               -- link to the Act/circular TEXT
  citation_text text not null,                               -- section / notification no.
  verified_by   uuid not null,                               -- the named human owner
  verified_at   timestamptz not null default now()
);
comment on table pay_rule.rule_source is 'Provenance for a rule value. INTEGRITY LAW: verified=true requires ≥1 source (checked by CI + pay_rule.assert_sourced trigger, Phase 5).';

-- ── FORMULA catalog + persisted DAG + golden vectors ────────────────────────────────
create table pay_formula.formula_catalog (
  id           uuid primary key default gen_random_uuid(),
  society_id   uuid references societies(id) on delete restrict,   -- NULL = platform skeleton
  name         text not null,
  purpose      text,
  is_system    boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid not null
);
create unique index formula_name_uq
  on pay_formula.formula_catalog (coalesce(society_id,'00000000-0000-0000-0000-000000000000'::uuid), name);

create table pay_formula.formula_version (
  id                uuid primary key default gen_random_uuid(),
  formula_id        uuid not null references pay_formula.formula_catalog(id) on delete restrict,
  expression_text   text not null,
  whitelist_profile text not null default 'default',         -- permitted pure-function set (security boundary)
  status            pay_core.formula_status not null default 'draft',
  version           int not null default 1,
  effective_from    date not null,
  effective_to      date,
  supersedes_id     uuid references pay_formula.formula_version(id),
  created_at        timestamptz not null default now(),
  created_by        uuid not null,
  updated_at        timestamptz,
  updated_by        uuid,
  constraint formver_eff_ck check (effective_to is null or effective_to > effective_from),
  constraint formver_uq     unique (formula_id, version)
);
create unique index formver_one_active on pay_formula.formula_version (formula_id) where status = 'active' and effective_to is null;

create table pay_formula.formula_dependency (
  id                 uuid primary key default gen_random_uuid(),
  formula_version_id uuid not null references pay_formula.formula_version(id) on delete cascade,
  depends_on_kind    pay_core.dep_kind not null,
  depends_on_ref     text not null,                          -- component code / rule key / variable / formula id
  constraint dep_uq unique (formula_version_id, depends_on_kind, depends_on_ref)
);
comment on table pay_formula.formula_dependency is 'Persisted DAG edges. pay_formula.validate_dag() runs cycle detection before a version may go active.';

create table pay_formula.formula_test_vector (
  id                 uuid primary key default gen_random_uuid(),
  formula_version_id uuid not null references pay_formula.formula_version(id) on delete cascade,
  inputs_json        jsonb not null,
  expected_minor     pay_core.amount_minor not null,
  note               text
);
comment on table pay_formula.formula_test_vector is 'Golden vectors; a version cannot go active until all pass (CI gate).';

-- Resolve the forward FKs left in 105 now that formula_version + rule_value exist.
alter table pay_config.component_version
  add constraint compver_formula_fk foreign key (formula_ref) references pay_formula.formula_version(id);
alter table pay_config.component_binding
  add constraint binding_formula_fk     foreign key (formula_ref)          references pay_formula.formula_version(id),
  add constraint binding_eligibility_fk foreign key (eligibility_rule_ref) references pay_rule.rule_value(id);
alter table pay_config.assignment_override
  add constraint override_formula_fk foreign key (override_formula_ref) references pay_formula.formula_version(id);

-- ── POLICY catalog + versions ────────────────────────────────────────────────────────
create table pay_policy.policy_catalog (
  id           uuid primary key default gen_random_uuid(),
  society_id   uuid references societies(id) on delete restrict,
  policy_type  pay_core.policy_type not null,
  code         text not null,
  display_name pay_core.i18n_label not null,
  is_system    boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid not null
);
create unique index policy_code_uq
  on pay_policy.policy_catalog (coalesce(society_id,'00000000-0000-0000-0000-000000000000'::uuid), policy_type, code);

create table pay_policy.policy_version (
  id            uuid primary key default gen_random_uuid(),
  policy_id     uuid not null references pay_policy.policy_catalog(id) on delete restrict,
  scope_level   pay_core.scope_level not null,
  scope_ref     uuid,
  config_json   jsonb not null,                              -- typed & validated per policy_type
  version       int not null default 1,
  effective_from date not null,
  effective_to   date,
  status        pay_core.config_status not null default 'draft',
  approved_by   uuid,
  approved_at   timestamptz,
  supersedes_id uuid references pay_policy.policy_version(id),
  change_reason text,
  created_at    timestamptz not null default now(),
  created_by    uuid not null,
  updated_at    timestamptz,
  updated_by    uuid,
  constraint polver_eff_ck check (effective_to is null or effective_to > effective_from),
  constraint polver_uq     unique (policy_id, version)
);

-- ── POLICY facts (ACL output + leave ledger) ─────────────────────────────────────────
create table pay_policy.attendance_fact (
  id           uuid primary key default gen_random_uuid(),
  society_id   uuid not null references societies(id) on delete restrict,
  branch_id    text references branches(id),
  employee_id  uuid not null references pay_core.employee(id) on delete restrict,
  period       pay_core.period_ym not null,
  paid_days    numeric(5,2) not null default 0 check (paid_days >= 0),
  lop_days     numeric(5,2) not null default 0 check (lop_days >= 0),
  ot_hours     numeric(6,2) not null default 0 check (ot_hours >= 0),
  source       pay_core.attendance_source not null,
  created_at   timestamptz not null default now(),
  created_by   uuid not null,
  updated_at   timestamptz,
  updated_by   uuid,
  constraint att_fact_uq  unique (employee_id, period),
  constraint att_days_ck  check (paid_days + lop_days <= 31)
);
comment on table pay_policy.attendance_fact is 'ACL: normalized attendance from muster/biometric/manual/roster. Single point (retires the Phase-0 dual model).';

create table pay_policy.leave_ledger (
  id           uuid primary key default gen_random_uuid(),
  society_id   uuid not null references societies(id) on delete restrict,
  employee_id  uuid not null references pay_core.employee(id) on delete restrict,
  leave_type   text not null,                                -- references pay_core.leave_type(code) [+society]
  accrued      numeric(6,2) not null default 0,
  availed      numeric(6,2) not null default 0,
  balance      numeric(6,2) generated always as (accrued - availed) stored,
  as_of        date not null,
  event_ref    uuid,
  created_at   timestamptz not null default now(),
  created_by   uuid not null
);
comment on table pay_policy.leave_ledger is 'Leave accrual/availment; balance is a GENERATED column (accrued − availed).';
create index leave_emp_idx on pay_policy.leave_ledger (society_id, employee_id, leave_type, as_of desc);

-- audit + version triggers
do $$
declare t text;
begin
  foreach t in array array['pay_rule.rule_value','pay_formula.formula_version','pay_policy.policy_version',
                            'pay_policy.attendance_fact','pay_policy.leave_ledger']
  loop
    execute format('create trigger %s_audit after insert or update or delete on %s for each row execute function pay_core.tg_pay_audit()', split_part(t,'.',2), t);
  end loop;
end$$;
