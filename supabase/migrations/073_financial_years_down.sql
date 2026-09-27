-- 073 down · drop financial_years. Nothing reads it yet and society_settings still holds every
-- FY field, so the app is unaffected. btree_gist stays installed (stock, harmless).
begin;
drop policy if exists financial_years_tenant_select on public.financial_years;
drop table if exists public.financial_years;
delete from public.app_migrations where version = '073';
commit;
