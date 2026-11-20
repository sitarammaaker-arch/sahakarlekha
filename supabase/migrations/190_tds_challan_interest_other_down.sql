-- Down for 190 — drops the challan interest / other columns (the app then counts the whole challan again).

begin;

alter table public.tds_challans drop column if exists "interestAmount";
alter table public.tds_challans drop column if exists "otherAmount";

delete from public.app_migrations where version = '190';

commit;
