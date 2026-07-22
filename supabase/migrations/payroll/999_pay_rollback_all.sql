-- =====================================================================================
-- Migration 999 — FULL ROLLBACK of the payroll subsystem
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Because payroll lives entirely in its own schemas and only REFERENCES
--                public.* (never alters it), rollback is a clean schema drop. No public
--                object is touched. Run ONLY to remove payroll entirely.
-- SAFETY       : cascade drops all payroll tables/policies/functions/types/matviews AND the
--                data in them. Take a backup first. Individual migrations'' partial rollback =
--                drop the objects they created (each file lists its objects).
-- VERIFY       : select count(*) from pg_namespace where nspname like 'pay\_%';  -- expect 0
-- =====================================================================================

drop schema if exists pay_reporting  cascade;
drop schema if exists pay_projection cascade;
drop schema if exists pay_calc       cascade;
drop schema if exists pay_policy      cascade;
drop schema if exists pay_formula     cascade;
drop schema if exists pay_rule        cascade;
drop schema if exists pay_config      cascade;
drop schema if exists pay_core        cascade;   -- domains/enums/reference tables live here
drop schema if exists pay_audit       cascade;
