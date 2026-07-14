/**
 * Voucher → ledger-event posting legs (T-06 / ADR-0001). PURE.
 *
 * The append-only journal is only a faithful system of record if a `voucher.posted` event carries
 * the actual balanced posting LEGS — the shape projectTrialBalance / replayBalances consume
 * (`payload.lines: { accountId, drCr, amountMinor }[]`, exact paise per T-02). A metadata-only
 * payload (voucherNo/amount/date) replays to nothing. This maps a voucher onto those legs so the
 * shadow journal is replay-faithful; balances derived from the events reconcile to the vouchers.
 */
import type { Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor } from '@/lib/money';

/** One posting leg in the canonical event-payload shape (matches projections' `legsOf`). */
export interface EventPostingLine {
  accountId: string;
  drCr: 'Dr' | 'Cr';
  amountMinor: number;
}

/**
 * PURE — a voucher's balanced posting legs in exact minor units (paise), for the `voucher.posted`
 * event payload `lines`. Works for both the simple debit/credit/amount shape and explicit multi-line
 * vouchers (getVoucherLines normalises both), so ΣDr === ΣCr in minor units, exactly.
 */
export function voucherPostingLines(voucher: Voucher): EventPostingLine[] {
  return getVoucherLines(voucher).map((l) => ({ accountId: l.accountId, drCr: l.type, amountMinor: toMinor(l.amount) }));
}
