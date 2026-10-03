/**
 * Share refund as an APPROVED PAYABLE. PURE — no React, no I/O, no timeline or set-off rules.
 *
 * Until now a share refund was one step: Dr Share Capital / Cr Cash-Bank, paid on the spot. When a society's committee
 * approves a refund but pays later, the amount sat in share capital (the member has left) or in no account at all.
 * This adds the two-step form next to the one-step form (which is unchanged):
 *
 *   approve  Dr Share Capital 1102          / Cr Share Refund Payable      (journal)
 *   pay      Dr Share Refund Payable        / Cr Cash-Bank                 (payment)
 *
 * The outstanding payable of a member is read from their live vouchers (refType + memberId), so no column is needed
 * and a cancelled voucher drops out by itself. WHEN a refund may be approved, any waiting period, and any set-off
 * against the member's loans are decided by the Act, the Rules and the bye-laws — none of that is encoded here.
 */
import { toMinor, toRupees } from '@/lib/money';
import type { VoucherLine } from '@/types';

export const SHARE_REFUND_APPROVE_REF = 'share.refund.approve';
export const SHARE_REFUND_PAY_REF = 'share.refund.pay';

interface VoucherLike { memberId?: string; refType?: string; amount: number; isDeleted?: boolean }

/** Approved-but-unpaid share refund of one member (₹), from their live approve / pay vouchers. Never negative. */
export function shareRefundOutstanding(vouchers: ReadonlyArray<VoucherLike>, memberId: string): number {
  let minor = 0;
  for (const v of vouchers) {
    if (v.isDeleted || v.memberId !== memberId) continue;
    if (v.refType === SHARE_REFUND_APPROVE_REF) minor += toMinor(v.amount);
    else if (v.refType === SHARE_REFUND_PAY_REF) minor -= toMinor(v.amount);
  }
  return toRupees(Math.max(0, minor));
}

export type ShareRefundError =
  | 'amount'               // not a positive amount
  | 'exceeds_capital'      // approval larger than the member's share capital
  | 'exceeds_outstanding'  // payment larger than the approved, unpaid amount
  | 'no_payable_head'      // chart has no Share Refund Payable liability
  | 'no_bank'              // no cash/bank account to pay from
  | 'resolution';          // approval needs the committee resolution reference

export type ShareRefundPosting =
  | { ok: true; lines: VoucherLine[]; amount: number }
  | { ok: false; error: ShareRefundError };

export function buildShareRefundApproval(
  input: { amount: number; shareCapital: number; shareCapAccountId: string; payableAccountId: string | null | undefined; resolution: string },
  newId: () => string = () => crypto.randomUUID(),
): ShareRefundPosting {
  const amount = toMinor(input.amount);
  if (!(amount > 0)) return { ok: false, error: 'amount' };
  if (amount > toMinor(input.shareCapital)) return { ok: false, error: 'exceeds_capital' };
  if (!input.payableAccountId) return { ok: false, error: 'no_payable_head' };
  if (input.resolution.trim().length < 2) return { ok: false, error: 'resolution' };
  const rupees = toRupees(amount);
  return { ok: true, amount: rupees, lines: [
    { id: newId(), accountId: input.shareCapAccountId, type: 'Dr', amount: rupees },
    { id: newId(), accountId: input.payableAccountId, type: 'Cr', amount: rupees },
  ] };
}

export function buildShareRefundPayment(
  input: { amount: number; outstanding: number; payableAccountId: string | null | undefined; cashBankAccountId: string | null | undefined },
  newId: () => string = () => crypto.randomUUID(),
): ShareRefundPosting {
  const amount = toMinor(input.amount);
  if (!(amount > 0)) return { ok: false, error: 'amount' };
  if (amount > toMinor(input.outstanding)) return { ok: false, error: 'exceeds_outstanding' };
  if (!input.payableAccountId) return { ok: false, error: 'no_payable_head' };
  if (!input.cashBankAccountId) return { ok: false, error: 'no_bank' };
  const rupees = toRupees(amount);
  return { ok: true, amount: rupees, lines: [
    { id: newId(), accountId: input.payableAccountId, type: 'Dr', amount: rupees },
    { id: newId(), accountId: input.cashBankAccountId, type: 'Cr', amount: rupees },
  ] };
}

/** Hindi-first message for a refused posting (RULE 7). The missing-head case has its own toast (headResolve). */
export const SHARE_REFUND_MESSAGE: Record<Exclude<ShareRefundError, 'no_payable_head'>, string> = {
  amount: 'राशि 0 से ज़्यादा होनी चाहिए।',
  exceeds_capital: 'स्वीकृत राशि सदस्य की मौजूदा शेयर पूँजी से ज़्यादा नहीं हो सकती।',
  exceeds_outstanding: 'भुगतान स्वीकृत और बकाया राशि से ज़्यादा नहीं हो सकता।',
  no_bank: 'भुगतान के लिए नकद/बैंक खाता नहीं मिला।',
  resolution: 'समिति के प्रस्ताव की संख्या/संदर्भ लिखना ज़रूरी है।',
};
