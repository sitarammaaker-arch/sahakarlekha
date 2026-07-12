/**
 * Invoice totals — the ONE place a sale/purchase's net, GST, TDS and grand total are
 * computed, born exact in integer paise (T-02 / ADR-0006).
 *
 * Each percentage goes through money.applyPercent (disciplined half-up rounding), which
 * avoids the `+(x).toFixed(2)` / `Math.round(x*100)/100` float-boundary misround — e.g.
 * 2.5% of ₹107 is ₹2.675, and `(2.675).toFixed(2)` yields "2.67" because 2.675 is stored as
 * 2.67499…; applyPercent rounds the exact 267.5 paise up to ₹2.68. Every sum is integer paise.
 *
 * SaleManagement and PurchaseManagement both call this, so the two forms cannot drift apart
 * (RULE 2). A sale simply passes tdsPct 0 (or omits it).
 */
import { toMinor, toRupees, addMinor, subMinor, sumMinor, applyPercent } from '@/lib/money';

export interface InvoiceTotalsInput {
  items: { amount: number }[];
  discount?: number;
  cgstPct?: number;
  sgstPct?: number;
  igstPct?: number;
  tdsPct?: number;
}

export interface InvoiceTotals {
  /** Taxable value = Σ item amounts − discount, floored at 0. */
  netAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  /** cgst + sgst + igst. */
  taxAmount: number;
  /** net × tdsPct. */
  tdsAmount: number;
  /** net + tax − tds. */
  grandTotal: number;
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
  const grandTotalMinor = subMinor(addMinor(netMinor, taxMinor), tdsMinor);
  return {
    netAmount: toRupees(netMinor),
    cgstAmount: toRupees(cgstMinor),
    sgstAmount: toRupees(sgstMinor),
    igstAmount: toRupees(igstMinor),
    taxAmount: toRupees(taxMinor),
    tdsAmount: toRupees(tdsMinor),
    grandTotal: toRupees(grandTotalMinor),
  };
}
