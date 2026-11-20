/**
 * RPT-10 (audit 2026-11-17) — the VALUES of an e-Way Bill, from one sale / purchase.
 *
 * The page sent `totalValue: totalAmount` (the item total BEFORE the trade discount), per-item `taxable: item.amount`
 * (also pre-discount), `gstRate: cgstPct * 2 || igstPct`, and `totInvValue: grandTotal` — the amount PAYABLE (TDS off,
 * TCS / round-off on, RCM tax left out). The figures did not reconcile with each other or with the tax values, and the
 * "above ₹50,000" list used the payable figure (with `>=`).
 *
 * Here: taxable value = netAmount (after the trade discount); the discount spread over the items in proportion, the last
 * item taking the rounding paise so the items add up exactly; rate = CGST% + SGST% + IGST%; invoice value = taxable +
 * the GST charged on the document. PURE.
 */
export interface EwayDoc {
  totalAmount?: number;
  netAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cgstPct?: number;
  sgstPct?: number;
  igstPct?: number;
  items?: ReadonlyArray<{ amount?: number }>;
}

const toPaise = (n: number) => Math.round((Number(n) || 0) * 100);

export function ewayValues(doc: EwayDoc): { taxable: number; tax: number; invoiceValue: number; rate: number; itemTaxable: number[] } {
  const items = doc.items ?? [];
  const grossP = items.reduce((s, i) => s + toPaise(i.amount ?? 0), 0);
  const taxableP = toPaise(doc.netAmount ?? doc.totalAmount ?? grossP / 100);
  const taxP = toPaise(doc.cgstAmount ?? 0) + toPaise(doc.sgstAmount ?? 0) + toPaise(doc.igstAmount ?? 0);
  const itemP: number[] = [];
  let used = 0;
  items.forEach((it, idx) => {
    if (idx === items.length - 1) { itemP.push(taxableP - used); return; }
    const p = grossP > 0 ? Math.round((toPaise(it.amount ?? 0) * taxableP) / grossP) : 0;
    itemP.push(p); used += p;
  });
  const rate = Math.round(((Number(doc.cgstPct) || 0) + (Number(doc.sgstPct) || 0) + (Number(doc.igstPct) || 0)) * 100) / 100;
  return { taxable: taxableP / 100, tax: taxP / 100, invoiceValue: (taxableP + taxP) / 100, rate, itemTaxable: itemP.map(p => p / 100) };
}

/** Rule 138: an e-Way Bill is needed when the consignment value EXCEEDS ₹50,000 (invoice value, not the payable). */
export const EWAY_THRESHOLD = 50000;
export function needsEwayBill(doc: EwayDoc): boolean {
  return ewayValues(doc).invoiceValue > EWAY_THRESHOLD;
}
