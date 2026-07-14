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
 * In-place edit forbidden (correct via reversal instead) when the voucher is already reversed, or is
 * posted-under-control (opt-in maker-checker regime + approved).
 */
export function isEditLocked(v: Pick<Voucher, 'reversedBy' | 'approvalStatus'>, approvalRequired: boolean): boolean {
  return !!v.reversedBy || (!!approvalRequired && v.approvalStatus === 'approved');
}
