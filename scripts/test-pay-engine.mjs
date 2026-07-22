// Payroll calc engine (Phase-8 capstone). The GOLDEN end-to-end test: one call to computePayslip
// takes a compiled catalog + facts + injected resolved inputs and produces a full payslip. Proves
// the single pure entry point the orchestrator will call composes run + aggregate correctly, single-
// sources the currency, and propagates refusals. Imports real .ts across the whole subsystem.
//
// Run: node scripts/test-pay-engine.mjs   (npm run test:pay-engine)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let eng, cc, ex;
try {
  eng = await import(abs('../src/lib/pay/calc/engine.ts'));
  cc = await import(abs('../src/lib/pay/formula/compile.ts'));
  ex = await import(abs('../src/lib/pay/formula/evaluator.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { computePayslip } = eng;
const { compileFormulaCatalog } = cc;
const { makeMoney } = ex;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };
const money = (v, minor, cur = 'INR') => v && v.kind === 'money' && v.minor === minor && v.currency === cur;

// --- A realistic monthly run for one employee (₹30000 BASIC, 30 paid days, ₹2000 loan recovery) ---
const typeBase = { vars: { BASIC: 'Money', attendance: 'Map', loanRecovery: 'Money' }, fns: {} };
const plan = compileFormulaCatalog([
  { code: 'DA', source: 'formula "DA" :: Money let b = BASIC in b * 20%' },
  { code: 'HRA', source: 'formula "HRA" :: Money let b = BASIC in b * 40%' },
  { code: 'GROSS', source: 'formula "GROSS" :: Money let b = BASIC in b + DA + HRA' },
  { code: 'EARNED', source: 'formula "EARNED" :: Money let g = GROSS in g * (attendance.paidDays / 30)' },
  { code: 'PF', source: 'formula "PF" :: Money let b = BASIC in b * 12%' },
  { code: 'LOAN', source: 'formula "LOAN" :: Money let r = loanRecovery in r' },
], typeBase);

const run = (paidDays) => computePayslip({
  plan,
  calc: {
    facts: {
      attendance: { paidDays, lopDays: 30 - paidDays, otHours: 0 },
      leave: [], loan: [{ loanId: 'L1', amountMinor: 200000 }],
      tax: { ytdByHead: {}, monthsRemaining: 6, regime: 'new' },
    },
    currency: 'INR',
    fixedComponents: { BASIC: makeMoney(3000000, 'INR') },
    fns: {},
  },
  aggregate: {
    classification: { DA: 'earning', HRA: 'earning', GROSS: 'info', EARNED: 'earning', PF: 'deduction', LOAN: 'deduction' },
    clamps: { HRA: { ceiling: 1000000 } }, // HRA capped at ₹10000
  },
});

// full month: DA 600000, HRA 1200000→clamped 1000000, GROSS 4800000(info), EARNED 4800000, PF 360000, LOAN 200000
const full = run(30);
ok(full.earnings.map((l) => l.code).join(',') === 'DA,HRA,EARNED', 'earnings are DA, HRA, EARNED (GROSS excluded as info)');
ok(money(full.earnings.find((l) => l.code === 'HRA').amount, 1000000), 'HRA clamped to ₹10000 ceiling');
ok(money(full.grossEarnings, 6400000), 'gross earnings = 600000 + 1000000(clamped) + 4800000 = 6400000');
ok(money(full.grossDeductions, 560000), 'gross deductions = PF 360000 + LOAN 200000 = 560000');
ok(money(full.netPay, 5840000), 'NET = 6400000 − 560000 = 5840000 (₹58400)');

// half month: EARNED prorated to 2400000, everything else same
const half = run(15);
ok(money(half.earnings.find((l) => l.code === 'EARNED').amount, 2400000), 'EARNED prorated to ₹24000 at 15 days');
ok(money(half.grossEarnings, 4000000) && money(half.netPay, 3440000), 'half-month gross 4000000, net 3440000');

// determinism: same inputs → identical payslip (replayability)
ok(JSON.stringify(run(30)) === JSON.stringify(full), 'same inputs produce an identical payslip (deterministic / replayable)');

// currency is single-sourced from calc.currency (no separate aggregate currency to disagree)
ok(full.currency === 'INR', 'payslip currency single-sourced from calc.currency');

// refusals propagate unchanged through the capstone
throws(() => computePayslip({
  plan,
  calc: { facts: { attendance: { paidDays: 30, lopDays: 0, otHours: 0 }, leave: [], loan: [], tax: { ytdByHead: {}, monthsRemaining: 6, regime: 'new' } }, currency: 'INR', fixedComponents: { BASIC: makeMoney(3000000, 'INR') }, fns: {} },
  aggregate: { classification: { DA: 'earning', HRA: 'earning', GROSS: 'info', EARNED: 'earning', PF: 'deduction' } }, // LOAN unclassified
}), /PAY-CAL-601.*'LOAN'/, 'an unclassified component still refuses through the engine');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay engine — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
