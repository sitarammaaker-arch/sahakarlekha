import type { Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';

/**
 * Which account a SALES RETURN credits (the Cr side of the credit note).
 *
 *  • refund in cash → Cash (3301); refund to bank → the chosen bank (else the first bank, else 3302)
 *  • "adjust against credit" → the RECEIVABLE THE ORIGINAL SALE DEBITED (RULE 2: the return undoes the
 *    sale on the same account). For a customer that is the customer's own ledger (a leaf under 3303), so
 *    the customer's outstanding drops. Before 2026-10-01 this always credited the 3303 control account,
 *    leaving the customer's outstanding unchanged (Kapil Nutri Store SRET/2026-27/001).
 *    Fallbacks when the sale voucher is missing or was a cash sale: the member receivable for a member's
 *    sale, else the 3303 control.
 */
export function salesReturnCreditAccountId(args: {
  refundMode: 'cash' | 'bank' | 'credit' | string;
  bankAccountId?: string;
  bankAccountIds: string[];
  saleVoucher?: Voucher | null;
  memberId?: string | null;
  memberReceivableAccountId?: string | null;
  /** The postable "Sundry Debtors" head (defaultDebtorsAccountId) — 3303 is a group in a current chart. */
  debtorsAccountId?: string;
}): string {
  const { refundMode, bankAccountId, bankAccountIds, saleVoucher, memberId, memberReceivableAccountId } = args;
  const debtors = args.debtorsAccountId || '3303';
  if (refundMode === 'cash') return '3301';
  if (refundMode === 'bank') return bankAccountId || bankAccountIds[0] || '3302';
  if (saleVoucher && !saleVoucher.isDeleted) {
    const cashOrBank = new Set(['3301', '3302', ...bankAccountIds]);
    const receivable = getVoucherLines(saleVoucher)
      .filter(l => l.type === 'Dr' && !cashOrBank.has(l.accountId))
      .sort((a, b) => b.amount - a.amount)[0];
    if (receivable) return receivable.accountId;
  }
  return memberId ? (memberReceivableAccountId || debtors) : debtors;
}
