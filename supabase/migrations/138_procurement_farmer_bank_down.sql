-- 138 down · drops the farmer bank / village / portal columns (the values are lost — export first).

begin;

alter table public.procurement_farmers drop column if exists "portalId";
alter table public.procurement_farmers drop column if exists ifsc;
alter table public.procurement_farmers drop column if exists "bankAccountNo";
alter table public.procurement_farmers drop column if exists "bankName";
alter table public.procurement_farmers drop column if exists village;

delete from public.app_migrations where version = '138';

commit;

notify pgrst, 'reload schema';
