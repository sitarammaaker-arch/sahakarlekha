/**
 * Voucher reversal & edit-lock — pure accounting guards, extracted from DataContext so they are
 * unit-testable in isolation and reusable. A voucher is corrected by REVERSAL (equal-and-opposite),
 * never edited in place, once it is reversed or posted-under-control. PURE — no React, no Supabase.
 */
import type { Voucher, VoucherLine } from '@/types';

/** Equal-and-opposite lines for a reversing voucher — flips each line's Dr/Cr, keeps account + amount. */
export function reverseEntryLines(lines: VoucherLine[]): VoucherLine[] {
  return lines.map(l => ({ ...l, type: (l.type === 'Dr' ? 'Cr' : 'Dr') as 'Dr' | 'Cr' }));
}

/**
 * In-place edit forbidden (correct via reversal instead) when the voucher is already reversed, IS a
 * reversal (it must mirror its original exactly — an edited reversal left a pair ₹50,000 apart in
 * prod), or is posted-under-control: approved under the maker-checker regime, OR actually approved by
 * a checker (approvedBy set — only approveVoucher / approve_voucher write it with status 'approved').
 * The second arm covers vouchers held by the amount-threshold / voucher-type matrix while
 * approvalRequired is OFF. `approvalStatus === 'approved'` ALONE is not proof of approval: the
 * vouchers.approvalStatus column DEFAULTS to 'approved' in prod, so it is on nearly every voucher.
 */
export function isEditLocked(v: Pick<Voucher, 'reversedBy' | 'approvalStatus'> & { reversalOf?: string; approvedBy?: string }, approvalRequired: boolean): boolean {
  return !!v.reversedBy || !!v.reversalOf
    || (v.approvalStatus === 'approved' && (!!approvalRequired || !!v.approvedBy));
}
