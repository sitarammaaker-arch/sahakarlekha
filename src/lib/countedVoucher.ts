/**
 * PURE — does this voucher count in financial reports? Same rule as DataContext's
 * `activeVouchers` (minus the branch filter, which pages apply themselves): not deleted,
 * not rejected, and not pending when the society uses maker-checker. Pages that read raw
 * `vouchers` must use this so they tie to the Trial Balance (audit A-03).
 *
 * Dependency-free on purpose so scripts/test-counted-voucher.mjs can import it directly.
 */
export function isCountedVoucher(
  v: { isDeleted?: boolean; approvalStatus?: string },
  approvalRequired?: boolean,
): boolean {
  return !v.isDeleted
    && v.approvalStatus !== 'rejected'
    && !(approvalRequired && v.approvalStatus === 'pending');
}
