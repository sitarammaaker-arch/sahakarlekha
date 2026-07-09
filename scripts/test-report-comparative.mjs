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

console.log(`\nReport comparative (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
