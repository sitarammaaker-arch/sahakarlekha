/**
 * Display label for a Receipts & Payments line. PURE, VIEW-ONLY.
 *
 * R&P is a CASH statement: a line under Payments means cash WENT OUT, under Receipts it came
 * IN — the side already carries the direction. But a liability account named "…Payable" reads
 * as "still owed", so users kept asking the same thing: "salary is paid, why does it show under
 * Payable?" (and the same for EPF Payable). Making the direction explicit on the label removes
 * that: a payable on the Payments side is PAID; on the Receipts side it was received/contributed.
 *
 * This NEVER changes the amount or the underlying `accountName` — that stays the ledger head, so
 * prior-year lookup and every data path are untouched. Applied at the view layer (page + PDF)
 * only, via the shared helper, so the two can't drift (RULE 2).
 */
import type { ReceiptsPaymentsItem } from '@/types';

type RPLabelItem = Pick<ReceiptsPaymentsItem, 'accountName' | 'accountNameHi' | 'glType'>;

/** True for a liability head (…Payable). Prefers glType; falls back to the name so it still
 *  works if glType is absent on an older data path. */
export function isPayableHead(item: RPLabelItem): boolean {
  if (item.glType === 'liability') return true;
  if (/payable\b/i.test(item.accountName)) return true;
  return (item.accountNameHi || '').includes('देय');
}

export function rpParticulars(item: RPLabelItem, prefix: 'To' | 'By', hi: boolean): string {
  const name = hi ? (item.accountNameHi || item.accountName) : item.accountName;
  if (!isPayableHead(item)) return name;
  if (prefix === 'By') return hi ? `${name} (चुकाया गया)` : `${name} (paid)`;
  return hi ? `${name} (प्राप्त)` : `${name} (received)`;
}
