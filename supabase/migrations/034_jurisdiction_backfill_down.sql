-- 034 down · (intentional no-op) — a backfill has no clean reverse.
--
-- Re-nulling jurisdiction would also wipe values written by the app's live stamping (once T-01 slice 3
-- is deployed), since a plain UPDATE cannot tell a backfilled value from an app-stamped one. Per T-01's
-- rollback guidance the column is additive/nullable and harmless — the real rollback is to disable the
-- write-path stamping, not to erase data. So this down deliberately does nothing.
--
-- For a genuine full teardown of the jurisdiction key (columns + any values), use 033_..._down.sql.

select 'jurisdiction backfill (034) has no reverse — see header' as note;
