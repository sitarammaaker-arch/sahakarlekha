// Payslip aggregation (Phase-8). Proves the FULL calc pipeline end-to-end: compile a catalog →
// runComponents (facts + fixed) → aggregatePayslip classifies each component, applies statutory
// clamps at value-use, and derives net = gross earnings − gross deductions (decision B: net is NOT
// a formula). Refuse rules: unclassified component, non-money line. Imports real .ts across the
// whole subsystem.
//
// Run: node scripts/test-pay-payslip.mjs   (npm run test:pay-payslip)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ps, comp, cc, ex;
try {
  ps = await import(abs('../src/lib/pay/calc/payslip.ts'));
  comp = await import(abs('../src/lib/pay/calc/components.ts'));
  cc = await import(abs('../src/lib/pay/formula/compile.ts'));
  ex = await import(abs('../src/lib/pay/formula/evaluator.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { aggregatePayslip } = ps;
const { runComponents } = comp;
const { compileFormulaCatalog } = cc;
const { makeMoney } = ex;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };
const money = (v, minor, cur = 'INR') => v && v.kind === 'money' && v.minor === minor && v.currency === cur;

const facts = {
  attendance: { paidDays: 30, lopDays: 0, otHours: 0 },
  leave: [{ type: 'EL', balance: 12 }],
  loan: [{ loanId: 'L1', amountMinor: 200000 }], // ₹2000
  tax: { ytdByHead: {}, monthsRemaining: 6, regime: 'new' },
};

// A realistic catalog: earnings DA/HRA + a running GROSS (info) + deductions PF/loan.
const typeBase = { vars: { BASIC: 'Money', loanRecovery: 'Money' }, fns: {} };
const catalog = [
  { code: 'DA', source: 'formula "DA" :: Money let b = BASIC in b * 20%' },
  { code: 'HRA', source: 'formula "HRA" :: Money let b = BASIC in b * 40%' },
  { code: 'GROSS', source: 'formula "GROSS" :: Money let b = BASIC in b + DA + HRA' },
  { code: 'PF', source: 'formula "PF" :: Money let b = BASIC in b * 12%' },
  { code: 'LOAN', source: 'formula "LOAN" :: Money let r = loanRecovery in r' },
];
const set = compileFormulaCatalog(catalog, typeBase);
const values = runComponents(set, { facts, currency: 'INR', fixedComponents: { BASIC: makeMoney(3000000, 'INR') }, fns: {} }).values;
// BASIC 3000000 → DA 600000, HRA 1200000, GROSS 4800000, PF 360000, LOAN 200000

const classification = { BASIC: 'earning', DA: 'earning', HRA: 'earning', GROSS: 'info', PF: 'deduction', LOAN: 'deduction' };
// NOTE: BASIC isn't in `values` (it's a fixed input, not a computed component), so it's never aggregated here.

// 1. full aggregation
const slip = aggregatePayslip(values, { currency: 'INR', classification });
ok(slip.earnings.length === 2 && slip.deductions.length === 2, '2 earnings (DA, HRA), 2 deductions (PF, LOAN); GROSS excluded as info');
ok(money(slip.grossEarnings, 1800000), 'gross earnings = DA 600000 + HRA 1200000 = 1800000');
ok(money(slip.grossDeductions, 560000), 'gross deductions = PF 360000 + LOAN 200000 = 560000');
ok(money(slip.netPay, 1240000), 'net = 1800000 − 560000 = 1240000 (aggregated, not a formula)');

// 2. lines carry their side + code, in plan order
ok(slip.earnings[0].code === 'DA' && slip.earnings[1].code === 'HRA', 'earnings in plan order');
ok(slip.earnings.every((l) => l.clamped === 'none'), 'no clamp applied when no bounds given');

// 3. an unclassified computed component refuses (no silent drop)
throws(() => aggregatePayslip(values, { currency: 'INR', classification: { DA: 'earning', HRA: 'earning', GROSS: 'info', PF: 'deduction' } }),
  /PAY-CAL-601.*'LOAN'/, 'unclassified LOAN refuses (PAY-CAL-601)');

// 4. statutory clamp applied at value-use — HRA ceilinged
const capped = aggregatePayslip(values, { currency: 'INR', classification, clamps: { HRA: { ceiling: 1000000 } } });
const hraLine = capped.earnings.find((l) => l.code === 'HRA');
ok(money(hraLine.amount, 1000000) && hraLine.clamped === 'ceiling', 'HRA 1200000 clamped down to ceiling 1000000');
ok(money(capped.grossEarnings, 1600000), 'gross earnings reflect the clamped HRA (600000 + 1000000)');
ok(money(capped.netPay, 1040000), 'net reflects the clamp (1600000 − 560000)');

// 5. a floor clamp raises a value
const floored = aggregatePayslip(values, { currency: 'INR', classification, clamps: { PF: { floor: 500000 } } });
ok(floored.deductions.find((l) => l.code === 'PF').clamped === 'floor' && money(floored.grossDeductions, 700000), 'PF 360000 raised to floor 500000');

// 6. non-money earning refuses
throws(() => aggregatePayslip({ RATE: 5 }, { currency: 'INR', classification: { RATE: 'earning' } }), /PAY-CAL-602/, 'a non-money earning refuses (PAY-CAL-602)');

// 7. wrong-currency line refuses
throws(() => aggregatePayslip({ USD: makeMoney(100, 'USD') }, { currency: 'INR', classification: { USD: 'earning' } }), /PAY-CAL-603/, 'wrong-currency line refuses (PAY-CAL-603)');

// 8. empty payslip
const empty = aggregatePayslip({}, { currency: 'INR', classification: {} });
ok(money(empty.netPay, 0) && empty.earnings.length === 0, 'empty values → zero net, no lines');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay payslip — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
