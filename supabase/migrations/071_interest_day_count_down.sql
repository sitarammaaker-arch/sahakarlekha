-- Down for 071.
alter table society_settings drop constraint if exists society_settings_interest_day_count_chk;
alter table society_settings drop column if exists "interestDayCount";
