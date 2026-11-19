/**
 * MEM-02 / MEM-03 (product audit 2026-11-17) — is this voucher one of a member's SYSTEM share vouchers? PURE.
 *
 * A joining receipt, an additional share purchase, a share refund (approval and payment), a share operation
 * (forfeit / redeem / surrender / bonus) or a share transfer moves the member's share register together with the
 * ledger. Such a voucher may be changed only through the Members page / Share Register; reversing or editing it from
 * the Vouchers page moved the ledger alone (register ≠ 1102, dividend on the wrong base).
 *
 * A hand-made voucher (origin 'manual') never moved the register, so it is NOT one — it stays editable.
 */
import type { Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { SHARE_REFUND_APPROVE_REF, SHARE_REFUND_PAY_REF } from '@/lib/shares/refundPayable';

export const SHARE_CAPITAL_ID = '1102';
export const ADMISSION_FEE_ID = '4407';

export function isMemberShareVoucher(v: Voucher | null | undefined): boolean {
  if (!v || !v.memberId || v.origin === 'manual') return false;
  const ref = (v as { refType?: string }).refType ?? '';
  if (ref === SHARE_REFUND_APPROVE_REF || ref === SHARE_REFUND_PAY_REF || ref === 'share.transfer') return true;
  const lines = getVoucherLines(v);
  return lines.some((l) => l.accountId === SHARE_CAPITAL_ID)
    || lines.some((l) => l.accountId === ADMISSION_FEE_ID && l.type === 'Cr');
}
