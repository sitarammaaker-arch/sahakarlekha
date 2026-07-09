// GSTR-9 annual return (ECR-22) — mirrors src/lib/gstr9.ts.
// Run: node scripts/test-gstr9.mjs
const r2 = (n) => Math.round(n * 100) / 100;
const empty = () => ({ taxableValue: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 });
const inRange = (d, from, to) => !!d && d >= from && d <= to;
function sumGst(records, from, to) {
  const t = empty();
  for (const rec of records) {
    if (rec.isDeleted || !inRange(rec.date, from, to)) continue;
    t.taxableValue += rec.netAmount || 0; t.cgst += rec.cgstAmount || 0; t.sgst += rec.sgstAmount || 0; t.igst += rec.igstAmount || 0;
  }
  t.taxableValue = r2(t.taxableValue); t.cgst = r2(t.cgst); t.sgst = r2(t.sgst); t.igst = r2(t.igst); t.tax = r2(t.cgst + t.sgst + t.igst);
  return t;
}
function gstRateOf(rec) { const inter = rec.igstPct || 0; if (inter > 0) return inter; const cs = r2((rec.cgstPct || 0) + (rec.sgstPct || 0)); if (cs > 0) return cs; const taxable = rec.netAmount || 0; const tax = (rec.cgstAmount || 0) + (rec.sgstAmount || 0) + (rec.igstAmount || 0); return taxable > 0 ? r2((tax / taxable) * 100) : 0; }
const netTotals = (a, b) => ({ taxableValue: r2(a.taxableValue - b.taxableValue), cgst: r2(a.cgst - b.cgst), sgst: r2(a.sgst - b.sgst), igst: r2(a.igst - b.igst), tax: r2(a.tax - b.tax) });
function computeGSTR9(input) {
  const { sales, purchases, salesReturns = [], purchaseReturns = [], from, to } = input;
  const outward = netTotals(sumGst(sales, from, to), sumGst(salesReturns, from, to));
  const itcAvailed = sumGst(purchases, from, to);
  const itcReversed = sumGst(purchaseReturns, from, to);
  const netItc = netTotals(itcAvailed, itcReversed);
  const head = (o, i) => r2(Math.max(0, o - i));
  const carry = (o, i) => r2(Math.max(0, i - o));
  const netLiability = { cgst: head(outward.cgst, netItc.cgst), sgst: head(outward.sgst, netItc.sgst), igst: head(outward.igst, netItc.igst), total: 0 };
  netLiability.total = r2(netLiability.cgst + netLiability.sgst + netLiability.igst);
  const creditCarryForward = { cgst: carry(outward.cgst, netItc.cgst), sgst: carry(outward.sgst, netItc.sgst), igst: carry(outward.igst, netItc.igst), total: 0 };
  creditCarryForward.total = r2(creditCarryForward.cgst + creditCarryForward.sgst + creditCarryForward.igst);
  const byRate = new Map();
  const addRate = (recs, sign) => { for (const rec of recs) { if (rec.isDeleted || !inRange(rec.date, from, to)) continue; const rate = gstRateOf(rec); const b = byRate.get(rate) ?? { rate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 }; b.taxableValue += sign * (rec.netAmount || 0); b.cgst += sign * (rec.cgstAmount || 0); b.sgst += sign * (rec.sgstAmount || 0); b.igst += sign * (rec.igstAmount || 0); byRate.set(rate, b); } };
  addRate(sales, 1); addRate(salesReturns, -1);
  const outwardByRate = [...byRate.values()].map(b => ({ rate: b.rate, taxableValue: r2(b.taxableValue), cgst: r2(b.cgst), sgst: r2(b.sgst), igst: r2(b.igst) })).filter(b => Math.abs(b.taxableValue) > 0.005).sort((a, b) => a.rate - b.rate);
  return { period: { from, to }, outward, itcAvailed, itcReversed, netItc, netLiability, creditCarryForward, outwardByRate };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const FROM = '2026-04-01', TO = '2027-03-31';

// Intra-state sale 10,000 @ 18% (9+9); inter-state sale 5,000 @ 18% IGST.
const sales = [
  { date: '2026-05-10', netAmount: 10000, cgstAmount: 900, sgstAmount: 900, igstAmount: 0, cgstPct: 9, sgstPct: 9, igstPct: 0 },
  { date: '2026-06-01', netAmount: 5000, cgstAmount: 0, sgstAmount: 0, igstAmount: 900, cgstPct: 0, sgstPct: 0, igstPct: 18 },
  { date: '2025-03-31', netAmount: 99999, cgstAmount: 9999, sgstAmount: 9999, igstAmount: 0 }, // OUT of FY → excluded
];
const purchases = [
  { date: '2026-05-05', netAmount: 4000, cgstAmount: 360, sgstAmount: 360, igstAmount: 0, cgstPct: 9, sgstPct: 9 },
];
const salesReturns = [
  { date: '2026-07-01', netAmount: 1000, cgstAmount: 90, sgstAmount: 90, igstAmount: 0 }, // credit note
];
const purchaseReturns = [
  { date: '2026-08-01', netAmount: 500, cgstAmount: 45, sgstAmount: 45, igstAmount: 0 },
];
const g = computeGSTR9({ sales, purchases, salesReturns, purchaseReturns, from: FROM, to: TO });

// 1. Outward = sales − credit notes, FY-bounded (the 2025 row excluded).
ok(g.outward.taxableValue === 14000, 'outward taxable = 10000+5000−1000 = 14000 (out-of-FY row excluded)');
ok(g.outward.cgst === 810 && g.outward.sgst === 810 && g.outward.igst === 900, 'output tax net of credit note');
ok(g.outward.tax === 2520, 'total output tax = 810+810+900');

// 2. ITC availed and reversed.
ok(g.itcAvailed.cgst === 360 && g.itcAvailed.sgst === 360, 'ITC availed from purchases');
ok(g.itcReversed.cgst === 45 && g.itcReversed.sgst === 45, 'ITC reversed from debit notes');
ok(g.netItc.cgst === 315 && g.netItc.sgst === 315 && g.netItc.tax === 630, 'net ITC = availed − reversed');

// 3. Net liability per head = output − net ITC (floored at 0).
ok(g.netLiability.cgst === 495 && g.netLiability.sgst === 495 && g.netLiability.igst === 900, 'net GST payable per head');
ok(g.netLiability.total === 1890, 'total net GST payable = 495+495+900');

// 4. Credit carry-forward when ITC exceeds output on a head.
const g2 = computeGSTR9({ sales: [{ date: '2026-05-01', netAmount: 100, cgstAmount: 9, sgstAmount: 9, igstAmount: 0, cgstPct: 9, sgstPct: 9 }], purchases: [{ date: '2026-05-02', netAmount: 1000, cgstAmount: 90, sgstAmount: 90, igstAmount: 0 }], from: FROM, to: TO });
ok(g2.netLiability.cgst === 0 && g2.creditCarryForward.cgst === 81, 'ITC > output → 0 payable, 81 carry-forward');

// 5. Rate-wise outward, net of credit notes.
const r18 = g.outwardByRate.find(x => x.rate === 18);
ok(!!r18 && r18.taxableValue === 14000, 'rate-wise: 18% bucket taxable = 14000 (net of return)');
ok(g.outwardByRate.length === 1, 'only one rate bucket (18%)');

console.log(`\nGSTR-9 (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
