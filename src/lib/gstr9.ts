/**
 * GSTR-9 annual return (ECR-22 slice 1).
 *
 * Consolidates a financial year's outward supplies (sales, net of credit notes)
 * and inward ITC (purchases, net of debit notes) into the GSTR-9 headline tables:
 *   Table 4/5  — outward supplies + tax payable
 *   Table 6    — ITC availed on inward supplies
 *   Table 7    — ITC reversed
 *   Table 9    — net tax (output − net ITC)
 * Pure & deterministic → unit-tested by scripts/test-gstr9.mjs. Read-only: it does
 * not change any voucher, sale or purchase — it only reads their GST fields.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface GstRecord {
  date: string;
  netAmount: number;        // taxable value (before GST)
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cgstPct?: number;
  sgstPct?: number;
  igstPct?: number;
  isDeleted?: boolean;
}

export interface GstTotals {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number; // cgst + sgst + igst
}

const empty = (): GstTotals => ({ taxableValue: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 });

function inRange(d: string, from: string, to: string): boolean {
  return !!d && d >= from && d <= to;
}

function sumGst(records: GstRecord[], from: string, to: string): GstTotals {
  const t = empty();
  for (const rec of records) {
    if (rec.isDeleted || !inRange(rec.date, from, to)) continue;
    t.taxableValue += rec.netAmount || 0;
    t.cgst += rec.cgstAmount || 0;
    t.sgst += rec.sgstAmount || 0;
    t.igst += rec.igstAmount || 0;
  }
  t.taxableValue = r2(t.taxableValue); t.cgst = r2(t.cgst); t.sgst = r2(t.sgst); t.igst = r2(t.igst);
  t.tax = r2(t.cgst + t.sgst + t.igst);
  return t;
}

/** The effective GST rate of a record: IGST rate inter-state, else CGST+SGST; if
 * the pct isn't stored (e.g. some return notes), derive it from the amounts. */
export function gstRateOf(rec: GstRecord): number {
  const inter = rec.igstPct || 0;
  if (inter > 0) return inter;
  const cs = r2((rec.cgstPct || 0) + (rec.sgstPct || 0));
  if (cs > 0) return cs;
  const taxable = rec.netAmount || 0;
  const tax = (rec.cgstAmount || 0) + (rec.sgstAmount || 0) + (rec.igstAmount || 0);
  return taxable > 0 ? r2((tax / taxable) * 100) : 0;
}

const netTotals = (a: GstTotals, b: GstTotals): GstTotals => ({
  taxableValue: r2(a.taxableValue - b.taxableValue),
  cgst: r2(a.cgst - b.cgst),
  sgst: r2(a.sgst - b.sgst),
  igst: r2(a.igst - b.igst),
  tax: r2(a.tax - b.tax),
});

export interface GSTR9 {
  period: { from: string; to: string };
  outward: GstTotals;      // Table 4 — outward taxable supplies, net of credit notes
  itcAvailed: GstTotals;   // Table 6 — ITC on inward supplies
  itcReversed: GstTotals;  // Table 7 — ITC reversed (debit notes)
  netItc: GstTotals;       // 6 − 7
  netLiability: { cgst: number; sgst: number; igst: number; total: number };       // output − net ITC (floored at 0 per head)
  creditCarryForward: { cgst: number; sgst: number; igst: number; total: number }; // net ITC − output (per head, if positive)
  outwardByRate: Array<{ rate: number; taxableValue: number; cgst: number; sgst: number; igst: number }>;
}

/** Compute the GSTR-9 for [from, to] from sales / purchases and their return notes. */
export function computeGSTR9(input: {
  sales: GstRecord[];
  purchases: GstRecord[];
  salesReturns?: GstRecord[];
  purchaseReturns?: GstRecord[];
  from: string;
  to: string;
}): GSTR9 {
  const { sales, purchases, salesReturns = [], purchaseReturns = [], from, to } = input;

  const salesT = sumGst(sales, from, to);
  const salesRetT = sumGst(salesReturns, from, to);
  const outward = netTotals(salesT, salesRetT); // net of credit notes

  const itcAvailed = sumGst(purchases, from, to);
  const itcReversed = sumGst(purchaseReturns, from, to);
  const netItc = netTotals(itcAvailed, itcReversed);

  const head = (out: number, itc: number) => r2(Math.max(0, out - itc));
  const carry = (out: number, itc: number) => r2(Math.max(0, itc - out));
  const netLiability = {
    cgst: head(outward.cgst, netItc.cgst),
    sgst: head(outward.sgst, netItc.sgst),
    igst: head(outward.igst, netItc.igst),
    total: 0,
  };
  netLiability.total = r2(netLiability.cgst + netLiability.sgst + netLiability.igst);
  const creditCarryForward = {
    cgst: carry(outward.cgst, netItc.cgst),
    sgst: carry(outward.sgst, netItc.sgst),
    igst: carry(outward.igst, netItc.igst),
    total: 0,
  };
  creditCarryForward.total = r2(creditCarryForward.cgst + creditCarryForward.sgst + creditCarryForward.igst);

  // Rate-wise outward (Table 4 sub-rows), net of credit notes.
  const byRate = new Map<number, { rate: number; taxableValue: number; cgst: number; sgst: number; igst: number }>();
  const addRate = (recs: GstRecord[], sign: 1 | -1) => {
    for (const rec of recs) {
      if (rec.isDeleted || !inRange(rec.date, from, to)) continue;
      const rate = gstRateOf(rec);
      const b = byRate.get(rate) ?? { rate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
      b.taxableValue += sign * (rec.netAmount || 0);
      b.cgst += sign * (rec.cgstAmount || 0);
      b.sgst += sign * (rec.sgstAmount || 0);
      b.igst += sign * (rec.igstAmount || 0);
      byRate.set(rate, b);
    }
  };
  addRate(sales, 1);
  addRate(salesReturns, -1);
  const outwardByRate = [...byRate.values()]
    .map(b => ({ rate: b.rate, taxableValue: r2(b.taxableValue), cgst: r2(b.cgst), sgst: r2(b.sgst), igst: r2(b.igst) }))
    .filter(b => Math.abs(b.taxableValue) > 0.005)
    .sort((a, b) => a.rate - b.rate);

  return { period: { from, to }, outward, itcAvailed, itcReversed, netItc, netLiability, creditCarryForward, outwardByRate };
}
