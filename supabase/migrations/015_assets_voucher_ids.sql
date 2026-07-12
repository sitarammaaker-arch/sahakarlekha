-- ============================================================================
-- P0-3 (L3) · assets.voucherIds — link an asset to its depreciation + disposal vouchers
-- ============================================================================
-- deleteAsset previously soft-cancelled an asset's vouchers by
-- `narration.includes(assetNo)` — a substring match that collides "AST/0001" with
-- "AST/00010" and breaks if the narration is edited. The capitalization voucher is
-- already linked by `acquisitionVoucherId`; this column stores the DEPRECIATION and
-- DISPOSAL voucher ids too, so deleteAsset cancels exactly this asset's vouchers.
--
-- jsonb array, default '[]'. postDepreciation appends each depreciation voucher id;
-- disposeAsset appends the disposal voucher id; deleteAsset cancels by
-- acquisitionVoucherId + voucherIds, falling back to the narration match only for
-- assets created before these ids were stored.
-- ============================================================================

begin;

alter table assets add column if not exists "voucherIds" jsonb default '[]';

commit;
