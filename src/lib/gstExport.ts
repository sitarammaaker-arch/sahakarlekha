/**
 * GST portal export scaffold (ECR-22 slice D).
 *
 * Produces a structured JSON of the GSTR-9 figures in a GSTN-style shape so the
 * user can review it and enter/reconcile the values on the government portal.
 * This is a DRAFT export, NOT a certified upload file — real GSTN/TRACES upload
 * needs a GSP/portal API integration (external infra), which is out of scope. The
 * `_disclaimer` field makes that explicit. Pure & unit-tested by
 * scripts/test-gst-export.mjs.
 */
import type { GSTR9 } from './gstr9';

export interface Gstr9Export {
  doc: 'GSTR9-DRAFT';
  gstin: string;
  fp: string; // financial-year period label
  outward_supplies: { taxable_value: number; igst: number; cgst: number; sgst: number };
  itc_availed: { igst: number; cgst: number; sgst: number };
  itc_reversed: { igst: number; cgst: number; sgst: number };
  net_itc: { igst: number; cgst: number; sgst: number };
  tax_payable_cash: { igst: number; cgst: number; sgst: number; total: number };
  rate_wise: Array<{ rate: number; taxable_value: number; igst: number; cgst: number; sgst: number }>;
  _disclaimer: string;
}

/** Build the GSTR-9 draft export object from a computed GSTR9 result. */
export function buildGstr9Export(g: GSTR9, gstin: string, fy: string): Gstr9Export {
  return {
    doc: 'GSTR9-DRAFT',
    gstin: (gstin || '').trim().toUpperCase(),
    fp: fy,
    outward_supplies: { taxable_value: g.outward.taxableValue, igst: g.outward.igst, cgst: g.outward.cgst, sgst: g.outward.sgst },
    itc_availed: { igst: g.itcAvailed.igst, cgst: g.itcAvailed.cgst, sgst: g.itcAvailed.sgst },
    itc_reversed: { igst: g.itcReversed.igst, cgst: g.itcReversed.cgst, sgst: g.itcReversed.sgst },
    net_itc: { igst: g.netItc.igst, cgst: g.netItc.cgst, sgst: g.netItc.sgst },
    tax_payable_cash: { igst: g.netLiability.igst, cgst: g.netLiability.cgst, sgst: g.netLiability.sgst, total: g.netLiability.total },
    rate_wise: g.outwardByRate.map(r => ({ rate: r.rate, taxable_value: r.taxableValue, igst: r.igst, cgst: r.cgst, sgst: r.sgst })),
    _disclaimer: 'Draft export for manual reconciliation on the GST portal. NOT a certified GSTN upload file. Verify every figure before filing.',
  };
}
