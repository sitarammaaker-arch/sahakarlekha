-- 072 down · drop app_migrations. Only the run-record is lost; no business data lives here.
-- Run the downs of any later migration (073+) first — they delete their own rows from this table.
begin;
drop table if exists public.app_migrations;
commit;
