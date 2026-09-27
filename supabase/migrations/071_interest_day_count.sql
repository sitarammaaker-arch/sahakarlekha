-- 071: society-level interest year basis (NABARD PACS RFP §16.1.2 — "pre-set parameters like rate of
-- interest, period (including days) of interest applicability"). '365' | 'actual' | '360'.
-- NULL means '365' — exactly the behaviour before this column existed. Additive, nullable, no backfill.
alter table society_settings add column if not exists "interestDayCount" text;
alter table society_settings drop constraint if exists society_settings_interest_day_count_chk;
alter table society_settings add constraint society_settings_interest_day_count_chk
  check ("interestDayCount" is null or "interestDayCount" in ('365', 'actual', '360'));
