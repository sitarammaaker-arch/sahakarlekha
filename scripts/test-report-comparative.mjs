// Report comparatives (ECR-19) — mirrors src/lib/reportComparative.ts.
// Run: node scripts/test-report-comparative.mjs
const r2 = (n) => Math.round(n * 100) / 100;

function comparative(current, prior) {
  const c = current || 0, p = prior || 0;
  const variance = r2(c - p);
  let variancePct;
  if (p === 0) variancePct = c === 0 ? 0 : null;
  else variancePct = r2((variance / Math.abs(p)) * 100);
  return { current: r2(c), prior: r2(p), variance, variancePct };
}
function buildComparativeMap(current, prior) {
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(prior || {})]);
  const out = {};
  for (const k of keys) out[k] = comparative(current?.[k] || 0, prior?.[k] || 0);
  return out;
}
function isEmptyPeriod(map) {
  return !map || Object.values(map).every(v => !v || Math.abs(v) < 0.005);
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Growth: 120 vs 100 → +20, +20%.
let x = comparative(120, 100);
ok(x.variance === 20 && x.variancePct === 20, 'growth: +20 / +20%');

// 2. Decline: 80 vs 100 → -20, -20%.
x = comparative(80, 100);
ok(x.variance === -20 && x.variancePct === -20, 'decline: -20 / -20%');

// 3. Prior 0, current > 0 → variance = current, pct = null (undefined %).
x = comparative(50, 0);
ok(x.variance === 50 && x.variancePct === null, 'from-zero: pct undefined');

// 4. Both 0 → 0 variance, 0%.
x = comparative(0, 0);
ok(x.variance === 0 && x.variancePct === 0, 'both zero → 0 / 0%');

// 5. Negative prior (net credit): -100 → -50 → variance +50, pct uses |prior|.
x = comparative(-50, -100);
ok(x.variance === 50 && x.variancePct === 50, 'negative prior uses |prior| for %');

// 6. Rounding to 2dp.
x = comparative(100.005, 33.331);
ok(x.variance === r2(100.005 - 33.331), 'variance rounded to paise');

// 7. buildComparativeMap unions keys, missing side = 0.
const m = buildComparativeMap({ a: 100, b: 50 }, { a: 80, c: 30 });
ok(m.a.variance === 20 && m.b.prior === 0 && m.b.variance === 50 && m.c.current === 0 && m.c.variance === -30, 'map unions keys, missing = 0');

// 8. isEmptyPeriod: all-zero (or near-zero) → true; any real figure → false.
ok(isEmptyPeriod({ a: 0, b: 0.004 }) === true, 'empty period detected');
ok(isEmptyPeriod({ a: 0, b: 100 }) === false, 'non-empty period detected');
ok(isEmptyPeriod({}) === true, 'empty map → empty period');

// 9. Balance-sheet prior-column gating: a non-empty computed prior is used; an
//    all-zero computed prior falls back to the saved snapshot (mirrors the page).
const priorComputed = { '3301': 50000, '1102': -50000 };
const snapshot = { '1102': -40000 };
ok((!isEmptyPeriod(priorComputed) ? priorComputed : snapshot) === priorComputed, 'non-empty computed prior is used');
ok((!isEmptyPeriod({ '3301': 0, '1102': 0 }) ? { x: 1 } : snapshot) === snapshot, 'empty computed prior → snapshot fallback');

// ── deltaProfitLoss: prior-FY P&L = cumulative(end) − cumulative(start) ──────
function deltaProfitLoss(end, start) {
  const sub = (a, b) => {
    const bMap = new Map(b.map(i => [i.name, i]));
    const names = new Set([...a.map(i => i.name), ...b.map(i => i.name)]);
    const out = [];
    for (const name of names) {
      const ai = a.find(i => i.name === name);
      const bi = bMap.get(name);
      const amount = r2((ai?.amount || 0) - (bi?.amount || 0));
      if (Math.abs(amount) < 0.005) continue;
      out.push({ name, nameHi: ai?.nameHi || bi?.nameHi || name, amount });
    }
    return out;
  };
  const totalIncome = r2(end.totalIncome - start.totalIncome);
  const totalExpenses = r2(end.totalExpenses - start.totalExpenses);
  return { incomeItems: sub(end.incomeItems, start.incomeItems), expenseItems: sub(end.expenseItems, start.expenseItems), totalIncome, totalExpenses, netProfit: r2(totalIncome - totalExpenses) };
}
function isEmptyPL(pl) { return !pl || (Math.abs(pl.totalIncome) < 0.005 && Math.abs(pl.totalExpenses) < 0.005); }

// 10. Prior-FY P&L isolated as the delta of two cumulative statements.
const plEnd   = { incomeItems: [{ name: 'Sales', nameHi: 'बिक्री', amount: 100 }, { name: 'Interest', nameHi: 'ब्याज', amount: 20 }], expenseItems: [{ name: 'Rent', nameHi: 'किराया', amount: 30 }], totalIncome: 120, totalExpenses: 30, netProfit: 90 };
const plStart = { incomeItems: [{ name: 'Sales', nameHi: 'बिक्री', amount: 40 }], expenseItems: [{ name: 'Rent', nameHi: 'किराया', amount: 10 }], totalIncome: 40, totalExpenses: 10, netProfit: 30 };
const d = deltaProfitLoss(plEnd, plStart);
ok(d.totalIncome === 80 && d.totalExpenses === 20 && d.netProfit === 60, 'period P&L = 120−40 income, 30−10 exp, netProfit 60');
ok(d.incomeItems.find(i => i.name === 'Sales').amount === 60, 'Sales flow this period = 100 − 40 = 60');
ok(d.incomeItems.find(i => i.name === 'Interest').amount === 20, 'a head only in end period keeps its full amount');
ok(d.incomeItems.find(i => i.name === 'Interest').nameHi === 'ब्याज', 'nameHi preserved');

// 11. A head that only existed in the earlier cumulative → negative (reversed/closed) is dropped if it nets to itself.
const d2 = deltaProfitLoss({ incomeItems: [], expenseItems: [], totalIncome: 0, totalExpenses: 0, netProfit: 0 }, { incomeItems: [{ name: 'X', nameHi: 'X', amount: 50 }], expenseItems: [], totalIncome: 50, totalExpenses: 0, netProfit: 50 });
ok(d2.incomeItems.find(i => i.name === 'X').amount === -50, 'head present only in start → −50 (net reduction)');
ok(d2.totalIncome === -50, 'delta totals go negative correctly');

// 12. isEmptyPL gating.
ok(isEmptyPL({ incomeItems: [], expenseItems: [], totalIncome: 0, totalExpenses: 0, netProfit: 0 }) === true, 'empty P&L detected → snapshot fallback');
ok(isEmptyPL(plEnd) === false, 'non-empty P&L detected');

console.log(`\nReport comparative (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
