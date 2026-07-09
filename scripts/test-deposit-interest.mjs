// Deposit interest calculators (Deposits module — SB/FD/RD) — mirrors src/lib/depositInterest.ts.
// Run: node scripts/test-deposit-interest.mjs

const r2 = (n) => Math.round(n * 100) / 100;
const simpleInterest = (p, rate, days) => r2(p * (rate / 100) * (days / 365));
const sbInterest = (bal, rate, days) => simpleInterest(bal, rate, days);
const fdInterest = (p, rate, months) => r2(p * (rate / 100) * (months / 12));
const fdMaturityValue = (p, rate, months) => r2(p + fdInterest(p, rate, months));
const rdInterest = (inst, rate, months) => r2(inst * (rate / 100 / 12) * (months * (months + 1) / 2));
const rdMaturityValue = (inst, rate, months) => r2(inst * months + rdInterest(inst, rate, months));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Simple interest: 10000 @ 6% for 365 days = 600.
ok(simpleInterest(10000, 6, 365) === 600, '10000 @ 6% for a year = 600');
ok(simpleInterest(10000, 6, 90) === r2(600 * 90 / 365), '90-day interest is pro-rata');
ok(simpleInterest(0, 6, 90) === 0 && simpleInterest(10000, 0, 90) === 0, 'zero principal/rate → 0');

// 2. SB is simple interest on the balance.
ok(sbInterest(50000, 4, 90) === simpleInterest(50000, 4, 90), 'SB == simple interest');

// 3. FD: 100000 @ 7% for 12 months = 7000 interest, 107000 maturity.
ok(fdInterest(100000, 7, 12) === 7000, 'FD 1-year interest');
ok(fdMaturityValue(100000, 7, 12) === 107000, 'FD maturity = principal + interest');
ok(fdInterest(100000, 7, 6) === 3500, 'FD 6-month interest is half');

// 4. RD: R=1000, 12 months @ 6%.  Σ interest = 1000 × (0.06/12) × (12×13/2) = 1000×0.005×78 = 390.
ok(rdInterest(1000, 6, 12) === 390, 'RD 12-month interest = 390');
ok(rdMaturityValue(1000, 6, 12) === 12390, 'RD maturity = 12000 installments + 390 interest');
ok(rdInterest(1000, 0, 12) === 0, 'RD zero-rate interest = 0');

// 5. Rounding to 2dp.
ok(simpleInterest(12345, 7.25, 37) === r2(12345 * 0.0725 * 37 / 365), 'fractional interest rounds to 2dp');

console.log(`\nDeposit interest (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
