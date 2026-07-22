// SFL plan runner (Phase-6 → Phase-8 seam). Proves the FIRST end-to-end computation: a formula
// catalog compiles, then evaluatePlan runs it in topological order and produces real paise —
// dependents read already-computed dependencies, binding scopes match the type checker, and a
// missing input refuses exactly as the checker did. Imports real .ts (compile + evalPlan + evaluator).
//
// Run: node scripts/test-pay-evalplan.mjs   (npm run test:pay-evalplan)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let cc, ep, ex;
try {
  cc = await import(abs('../src/lib/pay/formula/compile.ts'));
  ep = await import(abs('../src/lib/pay/formula/evalPlan.ts'));
  ex = await import(abs('../src/lib/pay/formula/evaluator.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { compileFormulaCatalog } = cc;
const { evaluatePlan, evaluateFormula } = ep;
const { makeMoney } = ex;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };
const money = (v, minor, cur = 'INR') => v && v.kind === 'money' && v.minor === minor && v.currency === cur;

// BASIC is a fixed component supplied as an input; the rest are formula-defined.
const typeBase = { vars: { BASIC: 'Money' }, fns: {} };
const catalog = [
  { code: 'GROSS', source: 'formula "GROSS" :: Money let z = BASIC in z + DA + HRA' },
  { code: 'DA', source: 'formula "DA" :: Money let z = BASIC in z * 20%' },
  { code: 'HRA', source: 'formula "HRA" :: Money let z = BASIC in z * 40%' },
];
const set = compileFormulaCatalog(catalog, typeBase);

// ₹1000.00 = 100000 paise
const inputs = { vars: { BASIC: makeMoney(100000, 'INR') }, fns: {} };
const { values } = evaluatePlan(set, inputs);

// 1. dependencies computed correctly, in paise
ok(money(values.DA, 20000), 'DA = 20% of ₹1000 = ₹200 (20000 paise)');
ok(money(values.HRA, 40000), 'HRA = 40% of ₹1000 = ₹400 (40000 paise)');

// 2. a dependent reads already-computed dependencies (GROSS = BASIC + DA + HRA)
ok(money(values.GROSS, 160000), 'GROSS = 100000 + 20000 + 40000 = 160000 paise (₹1600)');

// 3. only the plan's components are returned
ok(Object.keys(values).sort().join(',') === 'DA,GROSS,HRA', 'result holds exactly the 3 components (inputs not echoed)');

// 4. deeper chain: NET depends on GROSS and PF, both computed earlier
const chain = compileFormulaCatalog([
  { code: 'PF', source: 'formula "PF" :: Money let z = BASIC in z * 12%' },
  { code: 'GROSS', source: 'formula "GROSS" :: Money let z = BASIC in z * 150%' },
  { code: 'NET', source: 'formula "NET" :: Money let z = GROSS in z - PF' },
], typeBase);
const nv = evaluatePlan(chain, inputs).values;
ok(money(nv.PF, 12000) && money(nv.GROSS, 150000), 'PF = 12000, GROSS = 150000');
ok(money(nv.NET, 138000), 'NET = GROSS(150000) - PF(12000) = 138000 paise');

// 5. binding scope: a later binding sees an earlier one (mirrors the type checker)
const f = compileFormulaCatalog([
  { code: 'X', source: 'formula "X" :: Money let a = BASIC * 50% let b = a in b + a' },
], typeBase);
ok(money(evaluatePlan(f, inputs).values.X, 100000), 'X: a=50000, b=a; b+a = 100000 (chained bindings evaluate)');

// 6. a whitelisted function is available at run time
const withFn = compileFormulaCatalog(
  [{ code: 'CAP', source: 'formula "CAP" :: Money let z = BASIC in min2(z, HALF)' }],
  { vars: { BASIC: 'Money', HALF: 'Money' }, fns: { min2: { params: ['Money', 'Money'], ret: 'Money' } } },
);
const capVals = evaluatePlan(withFn, {
  vars: { BASIC: makeMoney(100000, 'INR'), HALF: makeMoney(50000, 'INR') },
  fns: { min2: (a, b) => (a.minor <= b.minor ? a : b) },
}).values;
ok(money(capVals.CAP, 50000), 'CAP = min2(₹1000, ₹500) = ₹500 (function applied at run time)');

// 7. a missing input refuses exactly like the checker (REF-020)
const needsX = compileFormulaCatalog([{ code: 'Y', source: 'formula "Y" :: Money let z = BASIC in z' }], typeBase);
throws(() => evaluatePlan(needsX, { vars: {}, fns: {} }), /PAY-DSL-REF-020/, 'missing input BASIC refuses at run time (no silent 0)');

// 8. evaluateFormula is usable standalone (bindings + body)
const single = set.formulas.HRA.formula;
ok(money(evaluateFormula(single, inputs), 40000), 'evaluateFormula runs one formula standalone');

// 9. empty plan → empty values
ok(Object.keys(evaluatePlan(compileFormulaCatalog([], typeBase), inputs).values).length === 0, 'empty plan → no values');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay evalPlan — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
