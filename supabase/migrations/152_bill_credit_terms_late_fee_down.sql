-- 152 down · removes the columns. Any due dates and rules saved since are lost; no ledger depended on them.
alter table public.sales            drop column if exists "creditDays";
alter table public.sales            drop column if exists "dueDate";
alter table public.sales            drop column if exists "lateFeeRule";
alter table public.purchases        drop column if exists "creditDays";
alter table public.purchases        drop column if exists "dueDate";
alter table public.purchases        drop column if exists "lateFeeRule";
alter table public.customers        drop column if exists "lateFeeRule";
alter table public.suppliers        drop column if exists "lateFeeRule";
alter table public.society_settings drop column if exists "lateFeeRules";

notify pgrst, 'reload schema';

delete from public.app_migrations where version = '152';
