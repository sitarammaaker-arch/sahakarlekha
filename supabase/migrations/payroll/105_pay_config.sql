-- =====================================================================================
-- Migration 105 — Configuration: component & structure catalogs, hierarchy scope, templates
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Behaviour-as-data. Pay components, salary-structure blueprints, the
--                scope-descriptor + version-envelope pattern that realises the 9-level
--                hierarchy WITHOUT one-table-per-level, org profile, and template registry.
-- DEPENDENCIES : 100-104. Formula FK (formula_version) is added late in 106 to avoid a cycle.
-- ROLLBACK     : 999.
-- VERIFY       : effective_to>effective_from enforced; one active binding per (structure,component).
-- REUSABLE SHAPE (embedded in each config table):
--   scope_level/scope_ref/jurisdiction  +  version/effective_from/effective_to/status/approved_*
-- =====================================================================================

-- ── Pay component catalog + effective-dated version ─────────────────────────────────
create table pay_config.component_catalog (
  id            uuid primary key default gen_random_uuid(),
  society_id    uuid references societies(id) on delete restrict,   -- NULL = platform-standard component
  code          text not null,
  display_name  pay_core.i18n_label not null,
  is_system     boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid not null
);
create unique index component_code_uq
  on pay_config.component_catalog (coalesce(society_id,'00000000-0000-0000-0000-000000000000'::uuid), code);
comment on table pay_config.component_catalog is 'Metadata atom of pay. Platform-standard (society_id null) + tenant-custom. Unlimited components.';

create table pay_config.component_version (
  id             uuid primary key default gen_random_uuid(),
  component_id   uuid not null references pay_config.component_catalog(id) on delete restrict,
  kind           text not null references pay_core.component_kind(code),
  calc_method    pay_core.calc_method not null,
  formula_ref    uuid,                                        -- FK → pay_formula.formula_version (added in 106)
  taxability     pay_core.taxability not null default 'taxable',
  pf_wage        boolean not null default false,
  esi_wage       boolean not null default false,
  pt_base        boolean not null default false,
  gratuity_base  boolean not null default false,
  bonus_base     boolean not null default false,
  gl_symbolic_role text not null,                             -- symbolic → posting binding (never an account id)
  sequence       int not null default 100,
  -- version envelope
  version        int not null default 1,
  effective_from date not null,
  effective_to   date,
  status         pay_core.config_status not null default 'draft',
  approved_by    uuid,
  approved_at    timestamptz,
  supersedes_id  uuid references pay_config.component_version(id),
  change_reason  text,
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz,
  updated_by     uuid,
  constraint compver_eff_ck   check (effective_to is null or effective_to > effective_from),
  constraint compver_formula_ck check (calc_method <> 'formula' or formula_ref is not null),
  constraint compver_ver_uq    unique (component_id, version)
);
comment on table pay_config.component_version is 'Effective-dated component behaviour. Active version pins to a run snapshot.';
create unique index compver_one_active on pay_config.component_version (component_id) where status = 'active' and effective_to is null;

-- ── Salary structure: template + version + component binding (inheritance) ──────────
create table pay_config.structure_template (
  id            uuid primary key default gen_random_uuid(),
  society_id    uuid references societies(id) on delete restrict,   -- NULL = platform/govt template
  code          text not null,
  display_name  pay_core.i18n_label not null,
  is_system     boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid not null
);
create unique index structure_code_uq
  on pay_config.structure_template (coalesce(society_id,'00000000-0000-0000-0000-000000000000'::uuid), code);

create table pay_config.structure_version (
  id                   uuid primary key default gen_random_uuid(),
  structure_id         uuid not null references pay_config.structure_template(id) on delete restrict,
  inherits_template_id uuid references pay_config.structure_template(id),   -- inheritance chain
  version              int not null default 1,
  effective_from       date not null,
  effective_to         date,
  status               pay_core.config_status not null default 'draft',
  approved_by          uuid,
  approved_at          timestamptz,
  supersedes_id        uuid references pay_config.structure_version(id),
  change_reason        text,
  created_at           timestamptz not null default now(),
  created_by           uuid not null,
  updated_at           timestamptz,
  updated_by           uuid,
  constraint structver_eff_ck check (effective_to is null or effective_to > effective_from),
  constraint structver_ver_uq unique (structure_id, version),
  constraint structver_no_self_inherit check (inherits_template_id is distinct from structure_id)
);

create table pay_config.component_binding (
  id                   uuid primary key default gen_random_uuid(),
  structure_version_id uuid not null references pay_config.structure_version(id) on delete cascade,
  component_id         uuid not null references pay_config.component_catalog(id) on delete restrict,
  formula_ref          uuid,                                  -- overrides component default formula (FK in 106)
  eligibility_rule_ref uuid,                                  -- FK → pay_rule.rule_value (added in 106)
  sequence             int not null default 100,
  created_at           timestamptz not null default now(),
  created_by           uuid not null,
  constraint binding_uq unique (structure_version_id, component_id)
);
comment on table pay_config.component_binding is 'A component in a structure version, with optional formula/eligibility override. Cascades with its version.';

-- ── Employee ↔ structure assignment + per-assignment overrides ──────────────────────
create table pay_config.structure_assignment (
  id                   uuid primary key default gen_random_uuid(),
  society_id           uuid not null references societies(id) on delete restrict,
  employee_id          uuid not null references pay_core.employee(id) on delete restrict,
  structure_version_id uuid not null references pay_config.structure_version(id) on delete restrict,
  effective_from       date not null,
  effective_to         date,
  created_at           timestamptz not null default now(),
  created_by           uuid not null,
  updated_at           timestamptz,
  updated_by           uuid,
  constraint assignment_eff_ck check (effective_to is null or effective_to > effective_from)
);
comment on table pay_config.structure_assignment is 'Versioned employee↔structure link. Overrides live on the assignment, never mutate the template.';
create unique index assignment_one_open on pay_config.structure_assignment (employee_id) where effective_to is null;

create table pay_config.assignment_override (
  id                  uuid primary key default gen_random_uuid(),
  assignment_id       uuid not null references pay_config.structure_assignment(id) on delete cascade,
  component_id        uuid not null references pay_config.component_catalog(id) on delete restrict,
  fixed_minor         pay_core.amount_minor,
  fixed_currency      pay_core.currency_code,
  override_formula_ref uuid,
  reason              text not null,                          -- override always carries a reason
  created_at          timestamptz not null default now(),
  created_by          uuid not null,
  constraint override_oneof_ck check ( (fixed_minor is not null)::int + (override_formula_ref is not null)::int = 1 ),
  constraint override_uq unique (assignment_id, component_id)
);

-- ── Org payroll profile + calendars + scoped generic config ─────────────────────────
create table pay_config.org_profile (
  id                 uuid primary key default gen_random_uuid(),
  society_id         uuid not null references societies(id) on delete restrict,
  pay_basis          pay_core.pay_basis not null default 'accrual',
  posting_granularity text not null default 'consolidated'
                      check (posting_granularity in ('consolidated','dimensional')),
  org_template_id    uuid,                                    -- FK → pay_config.template_registry (below)
  state_template_id  uuid,
  rounding_policy    text not null default 'half_up',
  version            int not null default 1,
  effective_from     date not null default current_date,
  effective_to       date,
  status             pay_core.config_status not null default 'active',
  created_at         timestamptz not null default now(),
  created_by         uuid not null,
  updated_at         timestamptz,
  updated_by         uuid,
  constraint org_profile_soc_uq unique (society_id, version)
);

create table pay_config.holiday_calendar (
  id            uuid primary key default gen_random_uuid(),
  society_id    uuid not null references societies(id) on delete restrict,
  branch_id     text references branches(id),
  holiday_date  date not null,
  kind          text not null default 'gazetted',
  label         pay_core.i18n_label,
  created_at    timestamptz not null default now(),
  created_by    uuid not null
);
create unique index holiday_uq
  on pay_config.holiday_calendar (society_id, coalesce(branch_id,''), holiday_date);

create table pay_config.shift_roster (
  id            uuid primary key default gen_random_uuid(),
  society_id    uuid not null references societies(id) on delete restrict,
  branch_id     text references branches(id),
  code          text not null,
  pattern       jsonb not null,                              -- validated shift pattern
  effective_from date not null default current_date,
  effective_to   date,
  created_at    timestamptz not null default now(),
  created_by    uuid not null,
  constraint shift_uq unique (society_id, code)
);

-- ── Template registry (named seed bundles) ──────────────────────────────────────────
create table pay_config.template_registry (
  id            uuid primary key default gen_random_uuid(),
  kind          pay_core.template_kind not null,
  code          text not null,
  display_name  pay_core.i18n_label not null,
  jurisdiction  pay_core.jurisdiction_code,
  is_system     boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid not null default '00000000-0000-0000-0000-000000000000'::uuid,
  constraint template_code_uq unique (kind, code)
);
comment on table pay_config.template_registry is 'Named bundles (org/state/salary/rule/policy/formula) that SEED tenant rows on adoption (copy-with-provenance).';

create table pay_config.template_binding (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references pay_config.template_registry(id) on delete cascade,
  target_catalog text not null,                              -- which catalog this seeds
  target_ref    uuid not null,                               -- the row to copy
  created_at    timestamptz not null default now()
);

alter table pay_config.org_profile
  add constraint org_profile_org_tmpl_fk   foreign key (org_template_id)   references pay_config.template_registry(id),
  add constraint org_profile_state_tmpl_fk foreign key (state_template_id) references pay_config.template_registry(id);

-- Touch + audit on all three; version-immutability only on the two tables that carry `status`.
do $$
declare t text;
begin
  foreach t in array array['pay_config.component_version','pay_config.structure_version','pay_config.structure_assignment']
  loop
    execute format('create trigger %s_touch before update on %s for each row execute function pay_core.tg_touch_updated()', split_part(t,'.',2), t);
    execute format('create trigger %s_audit after insert or update or delete on %s for each row execute function pay_core.tg_pay_audit()', split_part(t,'.',2), t);
  end loop;
  foreach t in array array['pay_config.component_version','pay_config.structure_version']
  loop
    execute format('create trigger %s_verimm before update on %s for each row execute function pay_core.tg_version_immutable()', split_part(t,'.',2), t);
  end loop;
end$$;
