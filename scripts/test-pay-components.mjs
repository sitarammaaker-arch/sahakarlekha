// Component calc seam (Phase-8). Proves the THREE payroll subsystems compose: runtime FACTS +
// formula PLAN → payslip component paise. factsToEnv money-types facts correctly; runComponents runs
// a compiled catalog that references both facts (attendance.paidDays, loanRecovery) and an injected
// fixed component (BASIC); proration works; a declared-but-unprovided input refuses at run time.
// Imports real .ts across formula/ + runtime/ + calc/.
//
// Run: node scripts/test-pay-components.mjs   (npm run test:pay-components)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let comp, cc, ex;
try {
  comp = await import(abs('../src/lib/pay/calc/components.ts'));
  cc = await import(abs('../src/lib/pay/formula/compile.ts'));
  ex = await import(abs('../src/lib/pay/formula/evaluator.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { factsToEnv, runComponents } = comp;
const { compileFormulaCatalog } = cc;
const { makeMoney } = ex;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };
const money = (v, minor, cur = 'INR') => v && v.kind === 'money' && v.minor === minor && v.currency === cur;

const facts = (paidDays) => ({
  attendance: { paidDays, lopDays: 30 - paidDays, otHours: 0 },
  leave: [{ type: 'EL', balance: 12 }],
  loan: [{ loanId: 'L1', amountMinor: 200000 }, { loanId: 'L2', amountMinor: 50000 }], // ₹2000 + ₹500
  tax: { ytdByHead: { '92B': 500000 }, monthsRemaining: 6, regime: 'new' },
});

// 1. factsToEnv — money-typing + shapes
const env = factsToEnv(facts(30), 'INR');
ok(env.attendance.paidDays === 30 && env.attendance.lopDays === 0, 'attendance counts stay Numbers');
ok(money(env.loanRecovery, 250000), 'loanRecovery = total of loan recoveries, as Money (₹2500)');
ok(env.loanRecoveries.length === 2 && money(env.loanRecoveries[0].amount, 200000), 'per-loan recoveries as Money');
ok(money(env.tax.ytd['92B'], 500000), 'YTD tax head lifted to Money');
ok(env.tax.monthsRemaining === 6 && env.tax.regime === 'new', 'tax scalars pass through');
ok(env.leaveBalance.EL === 12, 'leave balance by type');

// 2. compile a realistic catalog: BASIC (fixed) + formula components referencing facts
const typeBase = {
  vars: { BASIC: 'Money', attendance: 'Map', loanRecovery: 'Money' },
  fns: {},
};
const catalog = [
  { code: 'DA', source: 'formula "DA" :: Money let b = BASIC in b * 20%' },
  { code: 'GROSS', source: 'formula "GROSS" :: Money let b = BASIC in b + DA' },
  { code: 'EARNED', source: 'formula "EARNED" :: Money let g = GROSS in g * (attendance.paidDays / 30)' },
  { code: 'NET', source: 'formula "NET" :: Money let e = EARNED in e - loanRecovery' },
];
const set = compileFormulaCatalog(catalog, typeBase);
const inputs = (paidDays) => ({ facts: facts(paidDays), currency: 'INR', fixedComponents: { BASIC: makeMoney(3000000, 'INR') }, fns: {} });

// 3. full month (paidDays = 30): no proration
const full = runComponents(set, inputs(30)).values;
ok(money(full.DA, 600000), 'DA = 20% of ₹30000 = ₹6000');
ok(money(full.GROSS, 3600000), 'GROSS = BASIC + DA = ₹36000');
ok(money(full.EARNED, 3600000), 'EARNED = GROSS * 30/30 = full GROSS');
ok(money(full.NET, 3350000), 'NET = EARNED − loanRecovery(₹2500) = ₹33500');

// 4. half month (paidDays = 15): proration flows through the fact
const half = runComponents(set, inputs(15)).values;
ok(money(half.EARNED, 1800000), 'EARNED = GROSS * 15/30 = ₹18000 (fact-driven proration)');
ok(money(half.NET, 1550000), 'NET = ₹18000 − ₹2500 = ₹15500');

// 5. a declared-but-unprovided input refuses at RUN time (no silent 0)
const needsSpecial = compileFormulaCatalog(
  [{ code: 'X', source: 'formula "X" :: Money let b = BASIC in b + SPECIAL' }],
  { vars: { BASIC: 'Money', SPECIAL: 'Money' }, fns: {} },
);
throws(
  () => runComponents(needsSpecial, { facts: facts(30), currency: 'INR', fixedComponents: { BASIC: makeMoney(3000000, 'INR') }, fns: {} }),
  /PAY-DSL-REF-020/,
  'SPECIAL declared at compile but not provided at run → REF-020',
);

// 6. money-safety survives the seam: a fixed component + a money fact compose; Money+number still refuses
const mix = compileFormulaCatalog([{ code: 'Z', source: 'formula "Z" :: Money let b = BASIC in b - loanRecovery' }], typeBase);
ok(money(runComponents(mix, inputs(30)).values.Z, 2750000), 'BASIC − loanRecovery = ₹30000 − ₹2500 = ₹27500 (Money−Money)');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay components — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
