/**
 * Round off + cash discount on a sale / purchase voucher (2026-10-08). PURE.
 *
 * The goods (sales / purchases) lines are split from a "goods base" = grandTotal with the adjustments taken back
 * out, so the voucher still balances by construction (splitNetByAccount):
 *   sale     — Dr party grandTotal · Cr goods · Cr GST · round off: + → Cr 5499, − → Dr 5499
 *   purchase — Dr goods · Dr ITC · Dr TCS · Cr party grandTotal · Cr TDS · Cr 4499 cash discount ·
 *              round off: + → Dr 5499 (the payable went up), − → Cr 5499
 * Taxable value, GST, ITC and TDS never change — round off and cash discount sit outside them.
 */
import { toMinor, toRupees, addMinor, subMinor } from './money';

export const ROUND_OFF_ACCOUNT_ID = '5499';
export const DISCOUNT_RECEIVED_ACCOUNT_ID = '4499';

type Acc = { id: string; subtype?: string; isGroup?: boolean };

/** The society's round-off ledger: by subtype first (a society may have it under another id), else 5499. */
export function resolveRoundOffAccountId(accounts: ReadonlyArray<Acc>): string {
  return accounts.find(a => a.subtype === 'round_off' && !a.isGroup)?.id ?? ROUND_OFF_ACCOUNT_ID;
}
/** The society's discount-received ledger: by subtype first, else 4499. */
export function resolveDiscountReceivedAccountId(accounts: ReadonlyArray<Acc>): string {
  return accounts.find(a => a.subtype === 'discount_received' && !a.isGroup)?.id ?? DISCOUNT_RECEIVED_ACCOUNT_ID;
}

/** grandTotal with the adjustments taken back out — what the goods lines are split from. */
export function goodsBase(kind: 'sale' | 'purchase', grandTotal: number, roundOff = 0, cashDiscount = 0): number {
  const g = toMinor(Number(grandTotal) || 0);
  const ro = toMinor(Number(roundOff) || 0);
  const cd = kind === 'purchase' ? toMinor(Number(cashDiscount) || 0) : 0;
  return toRupees(addMinor(subMinor(g, ro), cd));
}

export interface AdjustmentLine { accountId: string; type: 'Dr' | 'Cr'; amount: number; narration: string }

/** The extra voucher lines for a bill's round off (and, on a purchase, its cash discount). */
export function adjustmentLines(
  kind: 'sale' | 'purchase',
  accounts: ReadonlyArray<Acc>,
  roundOff = 0,
  cashDiscount = 0,
): AdjustmentLine[] {
  const out: AdjustmentLine[] = [];
  const cd = toRupees(toMinor(Number(cashDiscount) || 0));
  if (kind === 'purchase' && cd > 0) {
    out.push({ accountId: resolveDiscountReceivedAccountId(accounts), type: 'Cr', amount: cd, narration: 'नकद छूट (Cash Discount)' });
  }
  const ro = toRupees(toMinor(Number(roundOff) || 0));
  if (ro !== 0) {
    // sale: +ro means the party pays more → Cr round off; purchase: +ro means we owe more → Dr round off.
    const up = ro > 0;
    const type: 'Dr' | 'Cr' = kind === 'sale' ? (up ? 'Cr' : 'Dr') : (up ? 'Dr' : 'Cr');
    out.push({ accountId: resolveRoundOffAccountId(accounts), type, amount: Math.abs(ro), narration: 'राउंड ऑफ (Round Off)' });
  }
  return out;
}
