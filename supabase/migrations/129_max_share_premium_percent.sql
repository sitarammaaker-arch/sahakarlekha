-- 129 · society_settings."maxSharePremiumPercent" (2026-10-19).
--
-- WHAT: the Share Register's "maximum share premium %" setting. The column was only ever in supabase-tables.sql
--   (line ~857), never in a numbered migration, so prod never had it: every save of that setting was trimmed by
--   updateSociety's missing-column retry ("कॉलम DB में नहीं" warning) and the value vanished on refresh. Additive.
-- Undo: 129_max_share_premium_percent_down.sql.

begin;

alter table public.society_settings add column if not exists "maxSharePremiumPercent" numeric;

insert into public.app_migrations (version, name) values ('129', 'max_share_premium_percent')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: col = 1 | mig = 1):
--   select (select count(*) from information_schema.columns where table_name = 'society_settings' and column_name = 'maxSharePremiumPercent') as col,
--          (select count(*) from public.app_migrations where version = '129') as mig;
