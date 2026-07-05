/**
 * POS GST computation — GST-INCLUSIVE extraction from the retail (MRP) price.
 *
 * The Retail Counter bills at the final shelf price the customer pays. When the
 * society is GST-registered, the tax is EMBEDDED in that price and must be
 * extracted (not added on top) so the customer-facing total never changes:
 *
 *   taxable = amount × 100 / (100 + gstRate)
 *   tax     = amount − taxable
 *
 * Walk-in counter sales are intra-state → CGST = SGST = tax / 2 (no IGST).
 * Exempt items (gstRate unset/0) contribute their full amount as taxable, zero tax.
 * An unregistered society (no GSTIN) charges no GST → Bill of Supply (all zero).
 *
 * The header rate% returned is the EFFECTIVE blended rate (taxAmount / netAmount),
 * exact for single-rate baskets and a weighted blend for mixed-rate baskets.
 */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PosGstItem {
  amount: number;      // gross final (MRP-inclusive) line amount
  gstRate?: number;    // item GST rate % (e.g. 5, 12, 18); unset/0 = exempt
}

export interface PosGstResult {
  netAmount: number;   // taxable value (grandTotal − taxAmount)
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;   // cgst + sgst (+ igst)
  grandTotal: number;  // == sum of line amounts (customer pays this, unchanged)
  cgstPct: number;     // effective blended half-rate (display / B2CS grouping)
  sgstPct: number;
  igstPct: number;
}

export function computeCartGst(items: PosGstItem[], opts: { gstRegistered: boolean }): PosGstResult {
  const grandTotal = round2(items.reduce((s, i) => s + (i.amount || 0), 0));
  if (!opts.gstRegistered) {
    return { netAmount: grandTotal, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, taxAmount: 0, grandTotal, cgstPct: 0, sgstPct: 0, igstPct: 0 };
  }
  let taxTotal = 0;
  for (const it of items) {
    const rate = it.gstRate || 0;
    if (rate > 0 && it.amount > 0) {
      const taxable = round2((it.amount * 100) / (100 + rate));
      taxTotal += round2(it.amount - taxable);
    }
  }
  // Split intra-state; sgst = taxTotal − cgst keeps cgst+sgst exactly = taxTotal (no rounding drift).
  const cgstAmount = round2(round2(taxTotal) / 2);
  const taxAmount = round2(taxTotal);
  const sgstAmount = round2(taxAmount - cgstAmount);
  const netAmount = round2(grandTotal - taxAmount); // net + tax == grandTotal exactly
  const effRate = netAmount > 0 ? round2((taxAmount / netAmount) * 100) : 0;
  const halfPct = round2(effRate / 2);
  return { netAmount, cgstAmount, sgstAmount, igstAmount: 0, taxAmount, grandTotal, cgstPct: halfPct, sgstPct: halfPct, igstPct: 0 };
}
