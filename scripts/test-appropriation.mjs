// Appropriation waterfall (ECR-10) — mirrors src/lib/appropriation.ts.
// Run: node scripts/test-appropriation.mjs

const r2 = (n) => Math.round(n * 100) / 100;
const STATUTORY_RESERVE_MIN = 25;
function appropriationWaterfall(netProfit, config = {}) {
  const np = r2(Math.max(0, netProfit || 0));
  const reservePct = config.reservePct ?? 25;
  const educationPct = config.educationPct ?? 1;
  const steps = [];
  let order = 1;
  const push = (accountId, label, labelHi, pct) => {
    const p = Math.max(0, pct || 0);
    const amount = r2(np * p / 100);
    if (np > 0 && amount > 0) steps.push({ order: order++, accountId, label, labelHi, pct: p, amount });
  };
  push('1201', 'Statutory Reserve Fund', 'x', reservePct);
  push('1203', 'Education Fund', 'x', educationPct);
  for (const f of config.otherFunds ?? []) push(f.accountId, f.label, f.labelHi ?? f.label, f.pct);
  const totalAppropriated = r2(steps.reduce((s, x) => s + x.amount, 0));
  return { netProfit: np, steps, totalAppropriated, residual: r2(np - totalAppropriated), reserveBelowStatutory: reservePct < STATUTORY_RESERVE_MIN };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Default (25% reserve, 1% education) on ₹1,00,000 → 25000 + 1000, residual 74000.
const p = appropriationWaterfall(100000);
ok(p.steps.length === 2, 'two default steps (reserve + education)');
ok(p.steps[0].accountId === '1201' && p.steps[0].amount === 25000 && p.steps[0].order === 1, 'reserve first: 25% = 25000');
ok(p.steps[1].accountId === '1203' && p.steps[1].amount === 1000 && p.steps[1].order === 2, 'education second: 1% = 1000');
ok(p.totalAppropriated === 26000 && p.residual === 74000, 'total 26000, residual 74000');
ok(!p.reserveBelowStatutory, '25% is not below statutory');

// 2. Residual identity always holds.
ok(r2(p.totalAppropriated + p.residual) === p.netProfit, 'appropriated + residual = net profit');

// 3. Below-statutory reserve flagged.
const low = appropriationWaterfall(100000, { reservePct: 10 });
ok(low.reserveBelowStatutory && low.steps[0].amount === 10000, 'reserve 10% flagged below statutory');

// 4. Other funds appended in order after reserve+education.
const withFunds = appropriationWaterfall(100000, { reservePct: 25, educationPct: 2, otherFunds: [{ accountId: '1202', label: 'Building', pct: 5 }, { accountId: '1207', label: 'Welfare', pct: 3 }] });
ok(withFunds.steps.length === 4, 'reserve + education + 2 other funds');
ok(withFunds.steps[2].accountId === '1202' && withFunds.steps[2].order === 3 && withFunds.steps[2].amount === 5000, 'building fund 5% = 5000, order 3');
ok(withFunds.steps[3].accountId === '1207' && withFunds.steps[3].amount === 3000, 'welfare 3% = 3000');
ok(withFunds.totalAppropriated === 35000 && withFunds.residual === 65000, 'total 35000, residual 65000');

// 5. Net profit ≤ 0 → empty plan.
ok(appropriationWaterfall(0).steps.length === 0 && appropriationWaterfall(-500).steps.length === 0, 'no profit → empty plan');
ok(appropriationWaterfall(-500).netProfit === 0, 'negative clamped to 0');

// 6. Zero-pct funds skipped.
const zero = appropriationWaterfall(100000, { reservePct: 25, educationPct: 0 });
ok(zero.steps.length === 1 && zero.steps[0].accountId === '1201', 'education 0% skipped');

// 7. Rounding to 2dp.
const frac = appropriationWaterfall(33333.33, { reservePct: 25 });
ok(frac.steps[0].amount === r2(33333.33 * 0.25), 'fractional reserve rounds to 2dp');

console.log(`\nAppropriation waterfall (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
