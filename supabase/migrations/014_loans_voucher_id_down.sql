-- ============================================================================
-- P0-3 · ROLLBACK of 014 — drop loans.voucherId
-- ============================================================================
-- deleteLoan tolerates a missing voucherId (it falls back to the narration match),
-- so dropping the column reverts to the pre-014 behaviour.
-- ============================================================================

begin;

alter table loans drop column if exists "voucherId";

commit;
