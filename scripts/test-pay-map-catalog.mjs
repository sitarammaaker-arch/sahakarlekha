// Config → calc mapping (orchestrator, pure). Proves the ratified mapping: component_kind →
// earning/deduction/info; calc_method routing (formula/attendance_derived → sources; fixed →
// per-employee override; rule → ruleView by component-code convention); clamp passthrough; and the
// refuse-over-guess gaps. Imports real .ts across orchestrator/ + resolve/ + formula/ + calc/.
//
// Run: node scripts/test-pay-map-catalog.mjs   (npm run test:pay-map-catalog)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mc;
try {
  mc = await import(abs('../src/lib/pay/orchestrator/mapCatalog.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { mapCatalog, KIND_TO_SIDE } = mc;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };
const money = (v, minor, cur = 'INR') => v && v.kind === 'money' && v.minor === minor && v.currency === cur;
const R = (value) => ({ value, provenance: { scope: { level: 'country' } } }); // minimal ResolvedRule

// ruleView: BASIC resolves by component-code convention to ₹30000 (minor)
const ruleView = { BASIC: R(3000000), MISSING_VAL: R('nan') };

const comp = (code, kind, calcMethod, extra = {}) => ({ code, kind, calcMethod, ...extra });
const input = {
  currency: 'INR',
  ruleView,
  clamps: { HRA: { ceiling: 1000000 } },
  components: [
    comp('BASIC', 'earning', 'rule'),                                             // → fixedComponents from ruleView
    comp('DA', 'earning', 'formula', { formulaSource: 'formula "DA" :: Money let b = BASIC in b * 20%' }),
    comp('HRA', 'earning', 'attendance_derived', { formulaSource: 'formula "HRA" :: Money let b = BASIC in b * 40%' }),
    comp('SPECIAL', 'earning', 'fixed', { overrideFixedMinor: 500000 }),          // per-employee override ₹5000
    comp('PF', 'deduction', 'formula', { formulaSource: 'formula "PF" :: Money let b = BASIC in b * 12%' }),
    comp('LOAN', 'loan_recovery', 'fixed', { overrideFixedMinor: 200000 }),
    comp('EPF_ER', 'employer_contrib', 'formula', { formulaSource: 'formula "EPF_ER" :: Money let b = BASIC in b * 12%' }),
  ],
};
const spec = mapCatalog(input);

// 1. classification per ratified table
ok(spec.classification.BASIC === 'earning' && spec.classification.PF === 'deduction', 'earning + deduction kinds');
ok(spec.classification.LOAN === 'deduction', 'loan_recovery → deduction');
ok(spec.classification.EPF_ER === 'info', 'employer_contrib → info');
ok(KIND_TO_SIDE.reimbursement === 'earning' && KIND_TO_SIDE.arrear === 'earning' && KIND_TO_SIDE.terminal_benefit === 'earning', 'reimbursement/arrear/terminal_benefit → earning');

// 2. rule component resolved by component-code convention
ok(money(spec.fixedComponents.BASIC, 3000000), "'rule' BASIC resolved from ruleView by code convention (₹30000)");

// 3. fixed component from per-employee override
ok(money(spec.fixedComponents.SPECIAL, 500000) && money(spec.fixedComponents.LOAN, 200000), "'fixed' from assignment_override amounts");

// 4. formula + attendance_derived → sources (attendance_derived is a formula alias)
const codes = spec.formulaSources.map((s) => s.code).sort();
ok(JSON.stringify(codes) === JSON.stringify(['DA', 'EPF_ER', 'HRA', 'PF']), 'formula + attendance_derived components → formula sources');
ok(spec.formulaSources.find((s) => s.code === 'HRA').source.includes('40%'), 'attendance_derived HRA carried its formula source');

// 5. only fixed/rule land in fixedComponents (not formula ones)
ok(!('DA' in spec.fixedComponents) && !('HRA' in spec.fixedComponents), 'formula components are NOT fixed inputs');

// 6. clamps passthrough
ok(spec.clamps.HRA && spec.clamps.HRA.ceiling === 1000000, 'clamp passed through for HRA');

// 7. refusals (refuse-over-guess)
throws(() => mapCatalog({ ...input, components: [comp('X', 'mystery_kind', 'fixed', { overrideFixedMinor: 1 })] }), /PAY-MAP-701.*'X'/, 'unknown component kind refuses');
throws(() => mapCatalog({ ...input, components: [comp('X', 'earning', 'formula')] }), /PAY-MAP-702/, 'formula component with no source refuses');
throws(() => mapCatalog({ ...input, components: [comp('X', 'earning', 'fixed')] }), /PAY-MAP-703/, "'fixed' with no override refuses");
throws(() => mapCatalog({ ...input, components: [comp('NOPE', 'earning', 'rule')] }), /PAY-MAP-704.*'NOPE'/, "'rule' with no resolved rule refuses");
throws(() => mapCatalog({ ...input, components: [comp('MISSING_VAL', 'earning', 'rule')] }), /PAY-MAP-705/, 'rule that resolves to a non-number refuses');
throws(() => mapCatalog({ ...input, components: [comp('X', 'earning', 'fixed', { overrideFixedMinor: 100, overrideCurrency: 'USD' })] }), /PAY-MAP-706/, 'currency mismatch on a fixed override refuses');

// 8. empty catalog
const empty = mapCatalog({ currency: 'INR', ruleView: {}, components: [] });
ok(empty.formulaSources.length === 0 && Object.keys(empty.fixedComponents).length === 0, 'empty catalog → empty spec');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay map-catalog — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
