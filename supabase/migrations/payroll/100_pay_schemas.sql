-- =====================================================================================
-- Migration 100 — Payroll logical schemas, extensions, grants
-- Phase 4 · SahakarLekha Payroll Platform · PostgreSQL 17 / Supabase
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Create the payroll logical schemas and required extensions. All payroll
--                objects live OUTSIDE public (public is the existing app's SSOT) so the
--                subsystem is self-contained, independently grant-able, and cleanly
--                droppable (rollback = drop these schemas, see 999).
-- DEPENDENCIES : none (first payroll migration). Requires the existing platform (societies,
--                branches, society_users, and the RLS helpers get_current_society_id() etc.).
-- ROLLBACK     : 999_pay_rollback_all.sql (drops all pay_* schemas in reverse order).
-- VERIFY       : \dn pay_* shows 9 schemas; pgcrypto present; authenticated has USAGE.
-- IDEMPOTENT   : yes (create ... if not exists).
-- =====================================================================================

-- Extensions (Supabase ships these; created idempotently in the extensions schema).
create extension if not exists pgcrypto;      -- gen_random_uuid(), digest()/hmac() for TOTP-style needs

-- ── Logical schemas (Phase-2 §3 / Phase-4 "database organization") ──────────────────
-- Why separate schemas: bounded-context isolation, per-context GRANTs, smaller search
-- surface, and a rollback that is a schema drop rather than 60 table drops.
create schema if not exists pay_core;        -- establishment: employee, appointment, cadre, org units
create schema if not exists pay_config;      -- component/structure catalogs, hierarchy, templates, org profile
create schema if not exists pay_rule;        -- statutory + business rule catalog (sourced, effective-dated)
create schema if not exists pay_formula;     -- formula catalog + persisted dependency DAG + test vectors
create schema if not exists pay_policy;      -- attendance/leave/holiday/shift/lifecycle policies + facts
create schema if not exists pay_calc;        -- payroll runs, snapshots, payslips, events (the transactional core)
create schema if not exists pay_audit;       -- WORM change log + config/rule/formula/policy history
create schema if not exists pay_projection;  -- rebuildable read-models (ytd, register materializations)
create schema if not exists pay_reporting;   -- operational/HR/accounting/compliance/ESS views

comment on schema pay_core       is 'Payroll establishment master: employee, appointment, deputation, cadre, designation, department.';
comment on schema pay_config     is 'Payroll configuration: component/structure catalogs, config hierarchy, templates, org profile.';
comment on schema pay_rule       is 'Effective-dated, jurisdiction-scoped, SOURCED statutory & business rules.';
comment on schema pay_formula    is 'Formula catalog + persisted dependency DAG + golden test vectors.';
comment on schema pay_policy     is 'Policy catalogs (attendance/leave/lifecycle) and normalized policy facts.';
comment on schema pay_calc       is 'Transactional core: event-sourced payroll runs, snapshots, payslips, lines.';
comment on schema pay_audit      is 'WORM: payroll change log and config/rule/formula/policy history.';
comment on schema pay_projection is 'Rebuildable read-models (YTD, registers). Never a source of truth.';
comment on schema pay_reporting  is 'Read-only reporting views (operational/HR/accounting/compliance/ESS).';

-- ── GRANTs ──────────────────────────────────────────────────────────────────────────
-- authenticated  : app users reach payroll via PostgREST; RLS (migration 110) does the filtering.
-- service_role    : the server Payroll Compute Service (SAD ADR-P4) bypasses RLS by design.
-- anon           : DENIED everywhere (payroll is never public). No grant issued.
-- NOTE (deploy)  : PostgREST only exposes schemas listed in the project's "Exposed schemas"
--                  API setting — add pay_core, pay_config, pay_reporting there (see deploy checklist).
grant usage on schema pay_core, pay_config, pay_rule, pay_formula, pay_policy,
                       pay_calc, pay_audit, pay_projection, pay_reporting
  to authenticated, service_role;

-- Default privileges so future tables/sequences inherit the grants (RLS still gates rows).
do $$
declare s text;
begin
  foreach s in array array['pay_core','pay_config','pay_rule','pay_formula','pay_policy',
                            'pay_calc','pay_audit','pay_projection','pay_reporting']
  loop
    execute format('alter default privileges in schema %I grant select, insert, update, delete on tables to authenticated', s);
    execute format('alter default privileges in schema %I grant all on tables to service_role', s);
    execute format('alter default privileges in schema %I grant usage, select on sequences to authenticated, service_role', s);
  end loop;
end$$;
