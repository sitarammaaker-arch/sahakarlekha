-- 049 DOWN · remove the per-tenant statutory-appropriation flag (T-20).
alter table society_settings drop column if exists "statutoryAppropriation";
