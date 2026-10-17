-- 117 down · drop the two member status-resolution columns (LOSES any recorded expulsion / withdrawal resolutions).
begin;
alter table public.members drop column if exists "statusResolutionNo";
alter table public.members drop column if exists "statusResolutionDate";
delete from public.app_migrations where version = '117';
commit;
notify pgrst, 'reload schema';
