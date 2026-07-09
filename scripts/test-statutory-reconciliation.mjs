// Unified statutory reconciliation (ECR-14) — mirrors src/lib/statutoryReconciliation.ts.
// Run: node scripts/test-statutory-reconciliation.mjs
const r2 = (n) => Math.round(n * 100) / 100;

function reconcileStatutory(rows) {
  const sum = (k) => r2(rows.reduce((s, r) => s + (r[k] || 0), 0));
  const pfEmployee = sum('pfEmployee'), pfEmployer = sum('pfEmployer');
  const esiEmployee = sum('esiEmployee'), esiEmployer = sum('esiEmployer');
  return { rows, totals: {
    gross: sum('gross'), pfEmployee, pfEmployer, esiEmployee, esiEmployer,
    pfTotal: r2(pfEmployee + pfEmployer), esiTotal: r2(esiEmployee + esiEmployer),
    count: rows.reduce((s, r) => s + (r.count || 0), 0),
  } };
}
function salariedRow(records) {
  const s = (f) => records.reduce((a, r) => a + (r[f] || 0), 0);
  return { source: 'salaried', count: records.length,
    gross: r2(records.reduce((a, r) => a + ((r.basicSalary || 0) + (r.allowances || 0)), 0)),
    pfEmployee: r2(s('pfEmployee')), pfEmployer: r2(s('pfEmployer')),
    esiEmployee: r2(s('esiEmployee')), esiEmployer: r2(s('esiEmployer')) };
}
function labourRow(comp, workerCount) {
  return { source: 'labour', count: workerCount, gross: r2(comp.grossWages || 0),
    pfEmployee: r2(comp.epfEmployee || 0), pfEmployer: r2(comp.epfEmployer || 0),
    esiEmployee: r2(comp.esiEmployee || 0), esiEmployer: r2(comp.esiEmployer || 0) };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// Salaried: 2 employees.
const sal = salariedRow([
  { basicSalary: 20000, allowances: 5000, pfEmployee: 1800, pfEmployer: 1800, esiEmployee: 0, esiEmployer: 0 },
  { basicSalary: 12000, allowances: 3000, pfEmployee: 1080, pfEmployer: 1080, esiEmployee: 112, esiEmployer: 487 },
]);
ok(sal.gross === 40000, 'salaried gross = Σ(basic+allow) = 40000');
ok(sal.pfEmployee === 2880 && sal.pfEmployer === 2880, 'salaried PF emp/er summed');
ok(sal.count === 2, 'salaried count = 2');

// Labour from computePfEsi output (5 workers).
const lab = labourRow({ grossWages: 60000, epfEmployee: 7200, epfEmployer: 7200, esiEmployee: 450, esiEmployer: 1950 }, 5);
ok(lab.gross === 60000 && lab.pfEmployee === 7200, 'labour row maps grossWages/epf');
ok(lab.count === 5, 'labour worker count = 5');

// Combined reconciliation.
const rec = reconcileStatutory([sal, lab]);
ok(rec.totals.gross === 100000, 'combined gross = 40000 + 60000');
ok(rec.totals.pfEmployee === 10080 && rec.totals.pfEmployer === 10080, 'combined PF split');
ok(rec.totals.pfTotal === 20160, 'PF challan total = emp + er');
ok(rec.totals.esiTotal === r2(112 + 487 + 450 + 1950), 'ESI total = emp + er across both');
ok(rec.totals.count === 7, 'combined headcount = 2 + 5');
ok(rec.rows.length === 2, 'two source rows preserved');

// Empty period → all zeros, no crash.
const empty = reconcileStatutory([salariedRow([]), labourRow({}, 0)]);
ok(empty.totals.gross === 0 && empty.totals.pfTotal === 0 && empty.totals.count === 0, 'empty period → zeros');

console.log(`\nStatutory reconciliation (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
