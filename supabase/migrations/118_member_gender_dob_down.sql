-- 118 down · drop member gender + date of birth (LOSES the recorded values).
begin;
alter table public.members drop column if exists "gender";
alter table public.members drop column if exists "dateOfBirth";
delete from public.app_migrations where version = '118';
commit;
notify pgrst, 'reload schema';
