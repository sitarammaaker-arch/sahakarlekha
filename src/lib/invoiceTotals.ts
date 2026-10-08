/**
 * Invoice totals — the ONE place a sale/purchase's net, GST, TDS, TCS and grand total are
 * computed, born exact in integer paise (T-02 / ADR-0006).
 *
 * TDS and TCS pull in OPPOSITE directions and must never share a field:
 *   TDS — WE deduct from the supplier and owe the government  → grandTotal goes DOWN, Cr 2202.
 *   TCS — the SELLER collects from US and adds it to the bill → grandTotal goes UP,   Dr 3307.
 * A forest-depot timber bill charges TCS: base 41,03,009 + IGST 7,38,542 + I.T. 82,060 =
 * 49,23,611. Putting that 2% in tdsPct produced 47,59,491 — short by twice the tax.
 *
 * Each percentage goes through money.applyPercent (disciplined half-up rounding), which
 * avoids the `+(x).toFixed(2)` / `Math.round(x*100)/100` float-boundary misround — e.g.
 * 2.5% of ₹107 is ₹2.675, and `(2.675).toFixed(2)` yields "2.67" because 2.675 is stored as
 * 2.67499…; applyPercent rounds the exact 267.5 paise up to ₹2.68. Every sum is integer paise.
 *
 * SaleManagement and PurchaseManagement both call this, so the two forms cannot drift apart
 * (RULE 2). A sale simply passes tdsPct/tcsPct 0 (or omits them).
 */
import { toMinor, toRupees, addMinor, subMinor, sumMinor, applyPercent } from '@/lib/money';

export interface InvoiceTotalsInput {
  items: { amount: number }[];
  discount?: number;
  cgstPct?: number;
  sgstPct?: number;
  igstPct?: number;
  tdsPct?: number;
  tcsPct?: number;
  /** Cash discount (purchase bill) — taken AFTER GST: GST / ITC / TDS are unchanged, the payable goes down. */
  cashDiscount?: number;
  /** Round off applied to the bill (+ raises, − lowers the total). Clamped to ±0.99 — see autoRoundOff. */
  roundOff?: number;
}

export interface InvoiceTotals {
  /** Taxable value = Σ item amounts − discount, floored at 0. */
  netAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  /** cgst + sgst + igst. */
  taxAmount: number;
  /** net × tdsPct — WE deduct it, so it REDUCES the grand total. */
  tdsAmount: number;
  /** net × tcsPct — the SELLER collects it, so it RAISES the grand total. */
  tcsAmount: number;
  /** cash discount actually applied (capped at the pre-discount total). */
  cashDiscount: number;
  /** net + tax + tcs − tds − cashDiscount — the bill before rounding. */
  totalBeforeRoundOff: number;
  /** round off actually applied (clamped to ±0.99). */
  roundOff: number;
  /** totalBeforeRoundOff + roundOff. */
  grandTotal: number;
}

/** Largest round off allowed on a bill — rounding, never a hidden adjustment. */
export const MAX_ROUND_OFF = 0.99;

/** PURE — the round off that brings a total to the nearest whole rupee (half-up: ₹10.50 → ₹11). */
export function autoRoundOff(total: number): number {
  const m = toMinor(Number(total) || 0);
  const rounded = Math.floor((m + 50) / 100) * 100;
  return toRupees(rounded - m);
}

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const totalMinor = sumMinor((input.items ?? []).map((i) => toMinor(Number(i.amount) || 0)));
  const discountMinor = toMinor(Number(input.discount) || 0);
  const netMinor = Math.max(0, subMinor(totalMinor, discountMinor));
  const cgstMinor = applyPercent(netMinor, Number(input.cgstPct) || 0).minor;
  const sgstMinor = applyPercent(netMinor, Number(input.sgstPct) || 0).minor;
  const igstMinor = applyPercent(netMinor, Number(input.igstPct) || 0).minor;
  const taxMinor = addMinor(cgstMinor, sgstMinor, igstMinor);
  const tdsMinor = applyPercent(netMinor, Number(input.tdsPct) || 0).minor;
  const tcsMinor = applyPercent(netMinor, Number(input.tcsPct) || 0).minor;
  const preDiscountMinor = subMinor(addMinor(netMinor, taxMinor, tcsMinor), tdsMinor);
  const cashDiscountMinor = Math.min(Math.max(0, toMinor(Number(input.cashDiscount) || 0)), Math.max(0, preDiscountMinor));
  const beforeRoundMinor = subMinor(preDiscountMinor, cashDiscountMinor);
  const capMinor = toMinor(MAX_ROUND_OFF);
  const roundOffMinor = Math.max(-capMinor, Math.min(capMinor, toMinor(Number(input.roundOff) || 0)));
  const grandTotalMinor = addMinor(beforeRoundMinor, roundOffMinor);
  return {
    netAmount: toRupees(netMinor),
    cgstAmount: toRupees(cgstMinor),
    sgstAmount: toRupees(sgstMinor),
    igstAmount: toRupees(igstMinor),
    taxAmount: toRupees(taxMinor),
    tdsAmount: toRupees(tdsMinor),
    tcsAmount: toRupees(tcsMinor),
    cashDiscount: toRupees(cashDiscountMinor),
    totalBeforeRoundOff: toRupees(beforeRoundMinor),
    roundOff: toRupees(roundOffMinor),
    grandTotal: toRupees(grandTotalMinor),
  };
}
