-- 126 down · drops society_settings."societyVariant" — LOSES which societies were marked CM-PACS
-- (their legal type 'multipurpose' stays).
begin;
alter table public.society_settings drop constraint if exists society_settings_society_variant_chk;
alter table public.society_settings drop column if exists "societyVariant";
delete from public.app_migrations where version = '126';
commit;
notify pgrst, 'reload schema';
