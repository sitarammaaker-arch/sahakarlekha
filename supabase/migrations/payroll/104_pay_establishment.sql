-- =====================================================================================
-- Migration 104 — Establishment master + PII-isolated tables
-- -------------------------------------------------------------------------------------
-- PURPOSE      : The person and their placements (employee, appointment, deputation) plus
--                the org-unit masters (cadre, designation, department). Direct identifiers
--                (PAN/Aadhaar/UAN/bank) are ISOLATED in their own tables (Phase-2 §14) so
--                salary analytics/AI can read the person WITHOUT touching identifiers.
-- DEPENDENCIES : 100-103. FK targets: societies(id) uuid, branches(id) text.
-- ROLLBACK     : 999.
-- VERIFY       : insert without society_id → PAY-VAL-001; hard delete employee → PAY-BUS-250;
--                two active-primary appointments for one employee → unique-violation.
-- =====================================================================================

-- ── Org-unit masters ────────────────────────────────────────────────────────────────
create table pay_core.department (
  id             uuid primary key default gen_random_uuid(),
  society_id     uuid not null references societies(id) on delete restrict,
  branch_id      text references branches(id),
  code           text not null,
  name           pay_core.i18n_label not null,
  cost_centre    text,                                        -- analytical dimension for posting
  is_active      boolean not null default true,
  effective_from date not null default current_date,
  effective_to   date,
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz,
  updated_by     uuid,
  constraint department_code_uq unique (society_id, code),
  constraint department_eff_ck  check (effective_to is null or effective_to > effective_from)
);
comment on table pay_core.department is 'Org unit / cost centre. Owner: Accounts/HR.';

create table pay_core.cadre (
  id             uuid primary key default gen_random_uuid(),
  society_id     uuid not null references societies(id) on delete restrict,
  code           text not null,
  name           pay_core.i18n_label not null,
  is_common_cadre boolean not null default false,             -- govt/registrar common cadre
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz,
  updated_by     uuid,
  constraint cadre_code_uq unique (society_id, code)
);

create table pay_core.designation (
  id             uuid primary key default gen_random_uuid(),
  society_id     uuid not null references societies(id) on delete restrict,
  cadre_id       uuid references pay_core.cadre(id) on delete restrict,
  code           text not null,
  name           pay_core.i18n_label not null,
  grade          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz,
  updated_by     uuid,
  constraint designation_code_uq unique (society_id, code)
);

-- ── Employee (master; never hard-deleted) ───────────────────────────────────────────
create table pay_core.employee (
  id             uuid primary key default gen_random_uuid(),
  society_id     uuid not null references societies(id) on delete restrict,
  branch_id      text references branches(id),
  employee_code  text not null,                               -- via numbering authority
  full_name      pay_core.i18n_label not null,
  gender         text check (gender in ('male','female','other','undisclosed')),
  date_of_birth  date,
  date_of_join   date not null,
  employment_type text not null references pay_core.employment_type(code),
  status         text not null default 'active'
                   check (status in ('active','suspended','retired','resigned','terminated','deceased')),
  pseudonym_id   uuid not null default gen_random_uuid(),     -- stable id for post-erasure financial history
  is_erased      boolean not null default false,              -- PII tombstone flag (ADR-0007)
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz,
  updated_by     uuid,
  constraint employee_code_uq  unique (society_id, employee_code),
  constraint employee_pseud_uq unique (pseudonym_id),
  constraint employee_join_ck  check (date_of_join <= current_date + 1),   -- +1 tolerates TZ
  constraint employee_dob_ck   check (date_of_birth is null or date_of_birth < date_of_join)
);
comment on table pay_core.employee is 'The person. PII identifiers live in pay_core.statutory_identity / bank_mandate. Never hard-deleted.';
create index emp_status_idx on pay_core.employee (society_id, status);
create index emp_name_gin   on pay_core.employee using gin (full_name jsonb_path_ops);   -- name search (GlobalSearch)

-- late FK from the WORM event table (103) now that employee exists
alter table pay_core.employment_event
  add constraint ee_emp_fk foreign key (employee_id) references pay_core.employee(id) on delete restrict;

-- ── Appointment (a posting over a period) ───────────────────────────────────────────
create table pay_core.appointment (
  id             uuid primary key default gen_random_uuid(),
  society_id     uuid not null references societies(id) on delete restrict,
  branch_id      text references branches(id),
  employee_id    uuid not null references pay_core.employee(id) on delete restrict,
  cadre_id       uuid references pay_core.cadre(id) on delete restrict,
  designation_id uuid not null references pay_core.designation(id) on delete restrict,
  department_id  uuid not null references pay_core.department(id) on delete restrict,
  pay_level      text,                                        -- govt pay-matrix level (resolved via rules)
  is_primary     boolean not null default true,
  effective_from date not null,
  effective_to   date,
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz,
  updated_by     uuid,
  constraint appointment_eff_ck check (effective_to is null or effective_to > effective_from)
);
comment on table pay_core.appointment is 'An employee posting (cadre/designation/dept/branch) over a period.';
-- Exactly one OPEN primary appointment per employee (temporal-ish invariant, enforced for open rows).
create unique index appointment_one_primary_open
  on pay_core.appointment (employee_id)
  where is_primary and effective_to is null;
create index appointment_emp_idx  on pay_core.appointment (society_id, employee_id, effective_from);
create index appointment_dept_idx on pay_core.appointment (department_id) where effective_to is null;

-- ── Deputation / lien (structural, never a type flag) ───────────────────────────────
create table pay_core.deputation (
  id              uuid primary key default gen_random_uuid(),
  society_id      uuid not null references societies(id) on delete restrict,
  appointment_id  uuid not null references pay_core.appointment(id) on delete restrict,
  parent_cadre_id uuid not null references pay_core.cadre(id) on delete restrict,
  host_org_id     uuid not null references societies(id) on delete restrict,
  lien_state      pay_core.lien_state not null default 'active',
  effective_from  date not null,
  effective_to    date,
  created_at      timestamptz not null default now(),
  created_by      uuid not null,
  updated_at      timestamptz,
  updated_by      uuid,
  constraint deputation_eff_ck check (effective_to is null or effective_to > effective_from)
);
comment on table pay_core.deputation is 'Deputation/lien on an appointment (common-cadre/deputationists). Structural, not a boolean flag.';

-- ── PII-isolated: statutory identity (Sensitive/Restricted) ─────────────────────────
create table pay_core.statutory_identity (
  id           uuid primary key default gen_random_uuid(),
  society_id   uuid not null references societies(id) on delete restrict,
  employee_id  uuid not null references pay_core.employee(id) on delete restrict,
  pan          text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  aadhaar_ref  text,                                          -- tokenized/masked reference; NEVER plaintext in logs/URLs
  uan          text check (uan is null or uan ~ '^[0-9]{12}$'),
  esic_ip      text,
  gpf_no       text,
  nps_pran     text check (nps_pran is null or nps_pran ~ '^[0-9]{12}$'),
  is_tombstoned boolean not null default false,               -- erasure: identifiers cleared, row skeleton kept
  created_at   timestamptz not null default now(),
  created_by   uuid not null,
  updated_at   timestamptz,
  updated_by   uuid,
  constraint statutory_identity_emp_uq unique (employee_id)
);
comment on table pay_core.statutory_identity is 'PII: PAN/Aadhaar/UAN/ESIC/GPF/PRAN. Sensitive_PII. Access-logged, masked on read, tombstoned on erasure.';

-- ── PII-isolated: bank mandate (Restricted) ─────────────────────────────────────────
create table pay_core.bank_mandate (
  id             uuid primary key default gen_random_uuid(),
  society_id     uuid not null references societies(id) on delete restrict,
  employee_id    uuid not null references pay_core.employee(id) on delete restrict,
  account_no     text not null,                               -- masked on read; never in URL
  ifsc           text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  account_holder_name text not null,
  is_active      boolean not null default true,
  effective_from date not null default current_date,
  effective_to   date,
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz,
  updated_by     uuid
);
comment on table pay_core.bank_mandate is 'PII: salary bank account(s). Restricted_PII. Masked, access-logged, tombstoned post-retention.';
-- One ACTIVE mandate per employee.
create unique index bank_mandate_one_active on pay_core.bank_mandate (employee_id) where is_active;

-- ── Attach generic triggers to every master/PII table ───────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['pay_core.department','pay_core.cadre','pay_core.designation',
                            'pay_core.employee','pay_core.appointment','pay_core.deputation',
                            'pay_core.statutory_identity','pay_core.bank_mandate']
  loop
    execute format('create trigger %s_tenant   before insert           on %s for each row execute function pay_core.tg_require_tenant()', split_part(t,'.',2), t);
    execute format('create trigger %s_touch    before update           on %s for each row execute function pay_core.tg_touch_updated()',  split_part(t,'.',2), t);
    execute format('create trigger %s_audit    after insert or update or delete on %s for each row execute function pay_core.tg_pay_audit()', split_part(t,'.',2), t);
  end loop;
  -- Master/financial tables: block hard delete (soft-cancel/status only).
  foreach t in array array['pay_core.employee','pay_core.appointment']
  loop
    execute format('create trigger %s_nodelete before delete on %s for each row execute function pay_core.tg_no_hard_delete()', split_part(t,'.',2), t);
  end loop;
end$$;
