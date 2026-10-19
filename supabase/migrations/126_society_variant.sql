-- 126 · Society variant (CM-PACS preset, Phase 1 — 2026-10-19).
--
-- WHAT: society_settings."societyVariant" — a state preset's NAME for the society, e.g. 'cm_pacs' =
--   Haryana CM-PACS (Comprehensive Multi-Purpose Activities Cooperative Society). It is NOT a legal type:
--   "societyType" stays the legal anchor (a CM-PACS is saved as 'multipurpose'), and no statutory rule reads
--   the variant. Null = no preset. Additive; existing rows are untouched.
-- Undo: 126_society_variant_down.sql.

begin;

alter table public.society_settings add column if not exists "societyVariant" text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'society_settings_society_variant_chk') then
    alter table public.society_settings add constraint society_settings_society_variant_chk
      check ("societyVariant" is null or "societyVariant" in ('cm_pacs'));
  end if;
end $$;

insert into public.app_migrations (version, name) values ('126', 'society_variant')
  on conflict (version) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFY (expect: 1 | 1 | 1):
--   select (select count(*) from information_schema.columns where table_name = 'society_settings' and column_name = 'societyVariant'),
--          (select count(*) from pg_constraint where conname = 'society_settings_society_variant_chk'),
--          (select count(*) from public.app_migrations where version = '126');
