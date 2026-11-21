/**
 * GSTR-1 Table 5 — B2CL: inter-State supplies to UNREGISTERED persons above the invoice-value threshold are reported
 * invoice-wise (Table 5); everything below stays consolidated rate-wise in B2CS (Table 7).
 *
 * SOURCE (read 2026-11-21 from the primary text): CBIC Notification No. 12/2024–Central Tax, dated 10 July 2024
 * (CGST (Amendment) Rules, 2024), gstcouncil.gov.in/sites/default/files/2024-09/central-tax-12-2024-11072024.pdf:
 *   rule 59(4): "with effect from 1st day of August, 2024, two and a half lakh rupees wherever they occur, one lakh
 *   shall be substituted"; rule 59(4)(a)(ii): "inter-State supplies with invoice value more than one lakh rupees made
 *   to the unregistered persons"; FORM GSTR-1 Table 5: "where the invoice value is more than Rs 1 lakh".
 * So: strictly MORE than the threshold; ₹2,50,000 for invoices dated before 2024-08-01, ₹1,00,000 from then on.
 */
export const B2CL_THRESHOLD_BEFORE_2024_08_01 = 250000;
export const B2CL_THRESHOLD_FROM_2024_08_01 = 100000;
export const B2CL_CHANGE_DATE = '2024-08-01';

export function b2clThreshold(invoiceDate: string): number {
  return String(invoiceDate || '') >= B2CL_CHANGE_DATE ? B2CL_THRESHOLD_FROM_2024_08_01 : B2CL_THRESHOLD_BEFORE_2024_08_01;
}

export interface B2cSale {
  id: string; saleNo: string; date: string; grandTotal: number; netAmount: number;
  cgstPct: number; sgstPct: number; igstPct: number; igstAmount: number; cgstAmount: number; sgstAmount: number;
}

/**
 * An unregistered-buyer sale is B2CL when it is inter-State and its invoice value is MORE than the threshold of its
 * date. Inter-State = the invoice carries IGST (the same signal B2CS uses for sply_ty, RPT-09).
 * The caller passes only sales that are NOT B2B (the buyer has no GSTIN).
 */
export function isB2CL(s: Pick<B2cSale, 'date' | 'grandTotal' | 'igstAmount'>): boolean {
  return (Number(s.igstAmount) || 0) > 0.005 && (Number(s.grandTotal) || 0) > b2clThreshold(s.date);
}

/** GSTR-1 JSON `b2cl`: grouped by place of supply, one entry per invoice (same field shapes as the b2b section). */
export function buildB2clSection<T extends B2cSale>(sales: T[], posOf: (s: T) => string) {
  const byPos = new Map<string, T[]>();
  for (const s of sales) {
    const pos = posOf(s);
    byPos.set(pos, [...(byPos.get(pos) ?? []), s]);
  }
  return [...byPos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([pos, list]) => ({
    pos,
    inv: list.map((s) => ({
      inum: s.saleNo,
      idt: s.date,
      val: s.grandTotal,
      itms: [{ num: 1, itm_det: { rt: s.cgstPct + s.sgstPct + s.igstPct, txval: s.netAmount, iamt: s.igstAmount, csamt: 0 } }],
    })),
  }));
}
