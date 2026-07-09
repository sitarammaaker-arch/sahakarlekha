/**
 * Capex approval visibility (ECR-15). Asset acquisitions capitalize by posting an
 * acquisition voucher via addVoucher, which already routes through the maker-checker
 * approval gate (pending when the society requires approval or the cost meets the
 * threshold). While that voucher is pending it is held out of the ledger — so the asset
 * shows on the register but not yet in the fixed-asset ledger (the drift the ECR-05
 * reconciliation surfaces). This helper flags those assets so the wait is explained.
 * PURE → unit-tested by scripts/test-capex-approval.mjs.
 */
import type { Asset } from '@/types';

/** Live assets whose acquisition voucher is still pending approval (capex not yet in the ledger). */
export function capexPendingAssets(
  assets: Pick<Asset, 'id' | 'name' | 'isDeleted' | 'acquisitionVoucherId'>[],
  pendingVoucherIds: ReadonlySet<string>,
): Array<Pick<Asset, 'id' | 'name'>> {
  return (assets || [])
    .filter((a) => !a.isDeleted && !!a.acquisitionVoucherId && pendingVoucherIds.has(a.acquisitionVoucherId))
    .map((a) => ({ id: a.id, name: a.name }));
}
