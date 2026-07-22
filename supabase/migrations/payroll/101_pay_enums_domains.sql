-- =====================================================================================
-- Migration 101 — Enumerated types, domains, and open-set reference tables
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Central type vocabulary. Two mechanisms, deliberately split:
--                  · ENUM        for CLOSED, code-coupled lifecycles/states (engine switches on them).
--                                Extension = ALTER TYPE ADD VALUE (rare, code-reviewed).
--                  · REFERENCE   for OPEN taxonomies (statutory heads, leave types, components…).
--                    TABLES        Extension = a data row + catalog_version bump — NO schema change
--                                  (honours Phase-3: "new law = data row"). Reference tables are
--                                  platform-scoped (society_id null) or tenant-extensible.
--                Also: reusable DOMAINs for money (paise), currency, jurisdiction, i18n label.
-- DEPENDENCIES : 100.
-- ROLLBACK     : drop the types/domains/tables (covered by 999 schema drop).
-- VERIFY       : \dT pay_core.*  ; select count(*) from pay_core.statutory_head (>0 after seed).
-- =====================================================================================

-- ── DOMAINs (reusable column contracts) ─────────────────────────────────────────────
create domain pay_core.amount_minor as bigint;                       -- integer paise; SIGN allowed (deductions negative)
comment on domain pay_core.amount_minor is 'Monetary amount in minor units (paise). ADR-0006/T-05. Never float. Pair with a *_currency column.';

create domain pay_core.currency_code as text
  default 'INR' not null
  check (value ~ '^[A-Z]{3}$');
comment on domain pay_core.currency_code is 'ISO-4217 alpha-3. Default INR; multi-currency ready.';

create domain pay_core.jurisdiction_code as text
  check (value is null or value ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$');    -- IN, IN-HR (T-01)
comment on domain pay_core.jurisdiction_code is 'Country or country-state code (T-01). e.g. IN, IN-HR. NULL = unspecified/global.';

create domain pay_core.period_ym as text
  check (value ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');                      -- payroll month YYYY-MM
comment on domain pay_core.period_ym is 'Payroll period as YYYY-MM.';

-- i18n label: a jsonb object {hi, en, ...}. hi + en required (Hindi-first, Constitution L12).
create domain pay_core.i18n_label as jsonb
  check (value ? 'hi' and value ? 'en');
comment on domain pay_core.i18n_label is 'Localized label {hi,en,...}; hi+en mandatory (Hindi-first, L12).';

-- ── CLOSED ENUMs (code-coupled lifecycles/states) ───────────────────────────────────
create type pay_core.config_status   as enum ('draft','pending_approval','active','superseded','retired');
create type pay_core.approval_state  as enum ('pending','approved','rejected','returned');
create type pay_core.pay_run_state   as enum ('draft','verified','approved','locked','posted','paid','cancelled','rolled_back');
create type pay_core.payslip_status  as enum ('computed','exception','posted','paid','reversed');
create type pay_core.formula_status  as enum ('draft','validated','active','superseded');
create type pay_core.pay_basis       as enum ('accrual','cash');
create type pay_core.scope_level     as enum ('global','country','state','org_type','org','branch','department','cadre','designation','employee');
create type pay_core.rule_kind       as enum ('rate','threshold','slab','eligibility','entitlement','clamp','posting_map');
create type pay_core.policy_type      as enum ('attendance','leave','holiday','shift','late','overtime','probation','increment','promotion','suspension','retirement','termination');
create type pay_core.producer_kind   as enum ('human','agent','import','integration');
create type pay_core.pii_class       as enum ('public','internal','confidential','restricted_pii','sensitive_pii');
create type pay_core.attendance_source as enum ('muster','biometric','manual','roster');
create type pay_core.lien_state      as enum ('active','suspended','reverted');
create type pay_core.taxability      as enum ('taxable','exempt','partial');
create type pay_core.calc_method     as enum ('fixed','formula','rule','attendance_derived');
create type pay_core.pay_event_type  as enum ('initiated','calculated','verified','approved','locked','posted','paid','reversed','cancelled');
create type pay_core.template_kind   as enum ('org','state','payroll','salary','rule','policy','formula');
create type pay_core.dep_kind        as enum ('component','rule','variable','formula');   -- formula DAG edge kind

-- ── OPEN reference tables (extensible by DATA, not schema) ───────────────────────────
-- Common shape: code (stable, English), label (i18n), is_system, society_id (null=platform),
-- catalog_version_ref (which pack introduced it). New value = INSERT + catalog_version bump.

create table pay_core.component_kind (
  code                text primary key,                              -- earning, deduction, employer_contrib, ...
  label               pay_core.i18n_label not null,
  affects_gross       boolean not null default true,
  is_system           boolean not null default true
);
comment on table pay_core.component_kind is 'Open taxonomy of pay-component kinds. Extend by row.';

create table pay_core.statutory_head (
  code                text primary key,                              -- pf, esi, pt, tds, nps, gpf, gis, bonus, gratuity, leave_encash, lwf
  label               pay_core.i18n_label not null,
  liability_symbolic  text not null,                                 -- symbolic GL role for the payable
  is_employer_cost    boolean not null default false,
  is_system           boolean not null default true
);
comment on table pay_core.statutory_head is 'Open taxonomy of statutory heads. A new head is a row — no new columns (Phase-3 §21).';

create table pay_core.leave_type (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  society_id          uuid,                                          -- null = platform standard; else tenant-defined
  label               pay_core.i18n_label not null,
  is_paid             boolean not null default true,
  is_encashable       boolean not null default false,
  is_system           boolean not null default true
);
-- expression-unique: one code per tenant (platform rows keyed on a sentinel).
create unique index leave_type_code_uq
  on pay_core.leave_type (coalesce(society_id, '00000000-0000-0000-0000-000000000000'::uuid), code);
comment on table pay_core.leave_type is 'Leave types; platform standards + tenant-defined. Open taxonomy.';

create table pay_core.payment_mode (
  code                text primary key,                              -- cash, bank, cheque, nach, treasury
  label               pay_core.i18n_label not null,
  is_system           boolean not null default true
);

create table pay_core.employment_type (
  code                text primary key,                              -- permanent, contract, muster, deputation, honorary
  label               pay_core.i18n_label not null,
  is_system           boolean not null default true
);

create table pay_core.return_form (
  code                text primary key,                              -- 24Q, ecr, esic, pt, form16, form16a
  label               pay_core.i18n_label not null,
  statutory_head_code text references pay_core.statutory_head(code),
  is_system           boolean not null default true
);

create table pay_core.employment_event_type (
  code                text primary key,                              -- join, confirm, promote, transfer, retire, ...
  label               pay_core.i18n_label not null,
  is_terminal         boolean not null default false,                -- retire/resign/terminate/death
  is_system           boolean not null default true
);
