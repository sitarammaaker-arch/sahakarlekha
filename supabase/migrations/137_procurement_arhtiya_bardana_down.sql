-- 137 down · drops the arhtiya master, the bardana register and the weighment / per-unit columns.
-- Data in those tables is lost — export them first.

begin;

alter table public.procurement_deduction_rules drop column if exists "basisUnit";
alter table public.procurement_lots drop column if exists bags;
alter table public.procurement_lots drop column if exists "tareWeight";
alter table public.procurement_lots drop column if exists "grossWeight";
drop table if exists public.procurement_bardana_movements;
drop table if exists public.procurement_arhtiyas;

delete from public.app_migrations where version = '137';

commit;

notify pgrst, 'reload schema';
