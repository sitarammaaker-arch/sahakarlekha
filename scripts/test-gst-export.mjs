// GST export scaffold (ECR-22 slice D) — mirrors src/lib/gstExport.ts.
// Run: node scripts/test-gst-export.mjs
function buildGstr9Export(g, gstin, fy) {
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

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const g = {
  outward: { taxableValue: 14000, cgst: 810, sgst: 810, igst: 900, tax: 2520 },
  itcAvailed: { cgst: 360, sgst: 360, igst: 0, taxableValue: 4000, tax: 720 },
  itcReversed: { cgst: 45, sgst: 45, igst: 0, taxableValue: 500, tax: 90 },
  netItc: { cgst: 315, sgst: 315, igst: 0, taxableValue: 3500, tax: 630 },
  netLiability: { cgst: 495, sgst: 495, igst: 900, total: 1890 },
  creditCarryForward: { cgst: 0, sgst: 0, igst: 0, total: 0 },
  outwardByRate: [{ rate: 18, taxableValue: 14000, cgst: 810, sgst: 810, igst: 900 }],
};
const e = buildGstr9Export(g, ' 06aaaat8335l1z6 ', '2026-27');

ok(e.doc === 'GSTR9-DRAFT', 'doc tag = GSTR9-DRAFT');
ok(e.gstin === '06AAAAT8335L1Z6', 'GSTIN trimmed + upper-cased');
ok(e.fp === '2026-27', 'financial period label');
ok(e.outward_supplies.taxable_value === 14000 && e.outward_supplies.igst === 900, 'outward mapped');
ok(e.itc_availed.cgst === 360 && e.itc_reversed.cgst === 45 && e.net_itc.cgst === 315, 'ITC availed/reversed/net mapped');
ok(e.tax_payable_cash.total === 1890, 'net tax payable total');
ok(e.rate_wise.length === 1 && e.rate_wise[0].rate === 18 && e.rate_wise[0].taxable_value === 14000, 'rate-wise mapped');
ok(typeof e._disclaimer === 'string' && /NOT a certified/.test(e._disclaimer), 'disclaimer present (honest scaffold)');
ok(JSON.stringify(e).length > 0 && JSON.parse(JSON.stringify(e)).doc === 'GSTR9-DRAFT', 'serialises to valid JSON');

console.log(`\nGST export (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
