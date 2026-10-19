-- 129 down · drops society_settings."maxSharePremiumPercent" — LOSES the saved share-premium cap.
begin;
alter table public.society_settings drop column if exists "maxSharePremiumPercent";
delete from public.app_migrations where version = '129';
commit;
notify pgrst, 'reload schema';
