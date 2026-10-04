/**
 * PURE — does this voucher count in financial reports? THE one rule, shared by DataContext's
 * `activeVouchers` (which adds the branch filter) and every page that reads raw `vouchers`, so
 * they all tie to the Trial Balance (audit A-03, RULE 2/5): not deleted, not rejected, not pending.
 *
 * A PENDING voucher is excluded whatever society.approvalRequired says: the approval matrix also
 * holds vouchers by amount threshold / voucher type with the flag OFF, and a held voucher has no
 * journal event and no voucher_entries until approve_voucher posts it — counting it client-side
 * made the reports disagree with the journal (and failed the T-09 ledger parity gate).
 *
 * Dependency-free on purpose so scripts/test-counted-voucher.mjs can import it directly.
 */
export function isCountedVoucher(v: { isDeleted?: boolean; approvalStatus?: string }): boolean {
  return !v.isDeleted && v.approvalStatus !== 'rejected' && v.approvalStatus !== 'pending';
}
