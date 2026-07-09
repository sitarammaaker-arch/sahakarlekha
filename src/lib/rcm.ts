/**
 * Reverse Charge Mechanism (RCM) auto-compute (ECR-22 slice B).
 *
 * For inward supplies liable to RCM (GTA/transport, legal, purchases from
 * unregistered dealers, etc.) the RECIPIENT self-assesses the GST — it is both an
 * output liability (paid in cash) and, if eligible, claimable as ITC. This sums
 * the self-assessed GST over RCM-flagged purchases: it uses the recorded GST
 * amounts, or — when the supplier charged none (typical on RCM invoices) —
 * derives it from taxable × rate. Pure & tested by scripts/test-rcm.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface RcmPurchase {
  date: string;
  netAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cgstPct?: number;
  sgstPct?: number;
  igstPct?: number;
  rcmApplicable?: boolean;
  isDeleted?: boolean;
}

export interface RcmSummary {
  count: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number; // = the RCM tax payable in cash, and equally the ITC claimable
}

/** Sum the self-assessed RCM GST over RCM-flagged purchases in [from, to]. */
export function computeRCM(purchases: RcmPurchase[], from: string, to: string): RcmSummary {
  const s: RcmSummary = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
  for (const p of purchases) {
    if (!p.rcmApplicable || p.isDeleted || !p.date || p.date < from || p.date > to) continue;
    s.count++;
    const taxable = p.netAmount || 0;
    let cgst = p.cgstAmount || 0, sgst = p.sgstAmount || 0, igst = p.igstAmount || 0;
    if (cgst === 0 && sgst === 0 && igst === 0) {
      // Supplier charged no GST → self-assess from the applicable rate.
      const inter = p.igstPct || 0;
      if (inter > 0) {
        igst = r2((taxable * inter) / 100);
      } else {
        cgst = r2((taxable * (p.cgstPct || 0)) / 100);
        sgst = r2((taxable * (p.sgstPct || 0)) / 100);
      }
    }
    s.taxableValue = r2(s.taxableValue + taxable);
    s.cgst = r2(s.cgst + cgst);
    s.sgst = r2(s.sgst + sgst);
    s.igst = r2(s.igst + igst);
  }
  s.total = r2(s.cgst + s.sgst + s.igst);
  return s;
}
