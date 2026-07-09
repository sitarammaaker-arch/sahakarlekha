// RCM auto-compute (ECR-22 slice B) — mirrors src/lib/rcm.ts.
// Run: node scripts/test-rcm.mjs
const r2 = (n) => Math.round(n * 100) / 100;
function computeRCM(purchases, from, to) {
  const s = { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
  for (const p of purchases) {
    if (!p.rcmApplicable || p.isDeleted || !p.date || p.date < from || p.date > to) continue;
    s.count++;
    const taxable = p.netAmount || 0;
    let cgst = p.cgstAmount || 0, sgst = p.sgstAmount || 0, igst = p.igstAmount || 0;
    if (cgst === 0 && sgst === 0 && igst === 0) {
      const inter = p.igstPct || 0;
      if (inter > 0) igst = r2((taxable * inter) / 100);
      else { cgst = r2((taxable * (p.cgstPct || 0)) / 100); sgst = r2((taxable * (p.sgstPct || 0)) / 100); }
    }
    s.taxableValue = r2(s.taxableValue + taxable);
    s.cgst = r2(s.cgst + cgst); s.sgst = r2(s.sgst + sgst); s.igst = r2(s.igst + igst);
  }
  s.total = r2(s.cgst + s.sgst + s.igst);
  return s;
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const FROM = '2026-04-01', TO = '2027-03-31';

const purchases = [
  // RCM, supplier charged no GST → self-assess 18% intra (9+9) on 10,000.
  { date: '2026-05-01', netAmount: 10000, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cgstPct: 9, sgstPct: 9, rcmApplicable: true },
  // RCM, GST already recorded (IGST 900) → use as-is.
  { date: '2026-06-01', netAmount: 5000, cgstAmount: 0, sgstAmount: 0, igstAmount: 900, igstPct: 18, rcmApplicable: true },
  // NOT RCM → excluded.
  { date: '2026-06-10', netAmount: 20000, cgstAmount: 1800, sgstAmount: 1800, igstAmount: 0, rcmApplicable: false },
  // RCM but deleted → excluded.
  { date: '2026-06-15', netAmount: 3000, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cgstPct: 9, sgstPct: 9, rcmApplicable: true, isDeleted: true },
  // RCM but out of FY → excluded.
  { date: '2025-06-01', netAmount: 9999, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cgstPct: 9, sgstPct: 9, rcmApplicable: true },
];
const s = computeRCM(purchases, FROM, TO);

ok(s.count === 2, 'only 2 RCM purchases counted (non-RCM, deleted, out-of-FY excluded)');
ok(s.taxableValue === 15000, 'RCM taxable value = 10000 + 5000');
ok(s.cgst === 900 && s.sgst === 900, 'intra self-assessed 9%+9% on 10,000');
ok(s.igst === 900, 'recorded IGST used as-is');
ok(s.total === 2700, 'total RCM tax = 900+900+900 (payable in cash AND claimable as ITC)');

// Empty / no RCM.
ok(computeRCM([{ date: '2026-05-01', netAmount: 100, cgstAmount: 9, sgstAmount: 9, igstAmount: 0 }], FROM, TO).total === 0, 'no RCM-flagged purchase → 0');

console.log(`\nRCM (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
