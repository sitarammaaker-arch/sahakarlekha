-- 116 down · drop the six member-admission columns. This LOSES any recorded application / admission dates,
-- committee resolutions and refusal reasons — run only if 116 must be undone.
begin;
alter table public.members drop column if exists "applicationDate";
alter table public.members drop column if exists "admissionDate";
alter table public.members drop column if exists "admissionResolutionNo";
alter table public.members drop column if exists "admissionResolutionDate";
alter table public.members drop column if exists "rejectionReason";
alter table public.members drop column if exists "decidedAt";
delete from public.app_migrations where version = '116';
commit;
notify pgrst, 'reload schema';
