// SFL formula-catalog compiler (Phase-6 capstone). Proves the ONE entry point ties all five bricks
// together: a whole catalog of component formulas compiles to a topologically-ordered, type-checked
// set (the runtime's formulaPlan), and EVERY class of config error is caught here at compile time —
// each re-thrown with the offending component code. Imports real .ts.
//
// Run: node scripts/test-pay-compile.mjs   (npm run test:pay-compile)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let cc;
try {
  cc = await import(abs('../src/lib/pay/formula/compile.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { compileFormulaCatalog } = cc;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

// Base env: BASIC is a FIXED component (an input here), attendance is a fact, round() a whitelisted fn.
const base = {
  vars: { BASIC: 'Money', attendance: 'Map' },
  fns: { round: { params: ['Money'], ret: 'Money' } },
};
const idx = (order, name) => order.indexOf(name);

// 1. a real catalog compiles — defined OUT of dependency order (HRA before its type is used by GROSS)
const catalog = [
  { code: 'GROSS', source: 'formula "GROSS" :: Money let x = BASIC in x + DA + HRA' },
  { code: 'HRA', source: 'formula "HRA" :: Money let x = BASIC in x * 40%' },
  { code: 'DA', source: 'formula "DA" :: Money let x = BASIC in x * 20%' },
];
const set = compileFormulaCatalog(catalog, base);
ok(set.order.length === 3, 'all 3 components compiled');
ok(idx(set.order, 'HRA') < idx(set.order, 'GROSS') && idx(set.order, 'DA') < idx(set.order, 'GROSS'), 'HRA + DA ordered before GROSS (topological)');
ok(set.formulas['HRA'].type === 'Money', 'HRA output type inferred as Money');
ok(JSON.stringify(set.formulas['GROSS'].deps.sort()) === JSON.stringify(['BASIC', 'DA', 'HRA']), 'GROSS deps (external + components), local x excluded');
ok(set.plan.order === set.order, 'plan.order is the execution order');

// 2. cross-component reference resolves regardless of definition order (forward ref)
const fwd = [
  { code: 'NET', source: 'formula "NET" :: Money let x = GROSS in x - PF' },
  { code: 'GROSS', source: 'formula "GROSS" :: Money let x = BASIC in x' },
  { code: 'PF', source: 'formula "PF" :: Money let x = BASIC in x * 12%' },
];
const fset = compileFormulaCatalog(fwd, base);
ok(idx(fset.order, 'GROSS') < idx(fset.order, 'NET') && idx(fset.order, 'PF') < idx(fset.order, 'NET'), 'forward references resolve (GROSS/PF before NET)');

// 3. every error class is caught at compile — WITH the component code
throws(() => compileFormulaCatalog([{ code: 'BAD', source: 'formula "BAD" :: Money let x = BASIC in x +' }], base), /component 'BAD'.*PAY-DSL-SYN/, 'syntax error → SYN, tagged with component');
throws(() => compileFormulaCatalog([{ code: 'HRA', source: 'formula "HRA" :: Money let x = BASIC in x + 5' }], base), /component 'HRA'.*PAY-DSL-TYPE-010/, 'money+number → TYPE-010 at compile, tagged');
throws(() => compileFormulaCatalog([{ code: 'REF', source: 'formula "REF" :: Money let x = MISSING in x' }], base), /component 'REF'.*PAY-DSL-REF-020/, 'unknown symbol → REF-020, tagged');
throws(() => compileFormulaCatalog([{ code: 'SEC', source: 'formula "SEC" :: Money let x = evil(BASIC) in x' }], base), /component 'SEC'.*PAY-DSL-SEC-060/, 'non-whitelisted fn → SEC-060, tagged');
throws(() => compileFormulaCatalog([{ code: 'ANN', source: 'formula "ANN" :: Money let x = 1 in x + 2' }], base), /component 'ANN'.*PAY-DSL-TYPE-016/, 'body vs :: annotation mismatch → TYPE-016, tagged');

// 4. a dependency cycle across the catalog is caught (PAY-DSL-DEP-CYCLE)
const cyc = [
  { code: 'A', source: 'formula "A" :: Money let x = B in x' },
  { code: 'B', source: 'formula "B" :: Money let x = A in x' },
];
throws(() => compileFormulaCatalog(cyc, base), /PAY-DSL-DEP-CYCLE/, 'catalog dependency cycle A↔B rejected');

// 5. duplicate component code in the catalog rejected
throws(() => compileFormulaCatalog([{ code: 'X', source: 'formula "X" :: Money let a = BASIC in a' }, { code: 'X', source: 'formula "X" :: Money let a = BASIC in a' }], base), /PAY-DSL-COMPILE.*duplicate/, 'duplicate component code rejected');

// 6. a whitelisted call compiles cleanly
const withFn = compileFormulaCatalog([{ code: 'R', source: 'formula "R" :: Money let x = BASIC in round(x * 40%)' }], base);
ok(withFn.formulas['R'].type === 'Money', 'whitelisted round(Money) → Money compiles');

// 7. empty catalog
ok(compileFormulaCatalog([], base).order.length === 0, 'empty catalog → empty plan');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay compile — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
