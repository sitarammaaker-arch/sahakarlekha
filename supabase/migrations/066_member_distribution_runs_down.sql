-- Rollback for 066_member_distribution_runs.sql. Drops the per-member distribution breakdowns;
-- the dividend VOUCHERS are untouched, so the books are unchanged (Profit Distribution falls back
-- to its proportional split for every year).
begin;
drop table if exists public.member_distribution_runs;
commit;
