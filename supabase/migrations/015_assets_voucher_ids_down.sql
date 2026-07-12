-- ============================================================================
-- P0-3 · ROLLBACK of 015 — drop assets.voucherIds
-- ============================================================================
-- deleteAsset tolerates a missing voucherIds (falls back to the narration match),
-- so dropping the column reverts to the pre-015 behaviour.
-- ============================================================================

begin;

alter table assets drop column if exists "voucherIds";

commit;
