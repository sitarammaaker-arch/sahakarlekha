// Payroll rule resolver (Phase-7 §3/§8/§10). Proves the combined ranking (scope → jurisdiction →
// when → recency → version), the sourced-only gate (PAY-CMP-501), refuse-over-guess for mandatory
// keys (PAY-CMP-510), and tie-as-defect (PAY-CMP-CONFLICT). Imports real .ts via type-stripping.
//
// Run: node scripts/test-pay-rule-resolver.mjs   (npm run test:pay-rule-resolver)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/pay/resolve/ruleResolver.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { resolvePayRule, resolveRequiredPayRule } = m;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

const chain = { orgType: 'pacs', orgId: 'o1', branchId: 'b1', departmentId: 'd1', cadreId: 'c1', designationId: 'g1', employeeId: 'e1' };
const ctx = (over = {}) => ({ chain, jurisdiction: 'IN-KA', asOf: '2026-05-01', ...over });
// candidate factory
const C = (value, scope, o = {}) => ({ value, scope, jurisdiction: o.j ?? '', when: o.when, effectiveFrom: o.from ?? '2026-01-01', version: o.ver, verified: o.verified, sourceCount: o.src });

// 1. most-specific scope wins
const s1 = [
  C(10, { level: 'global' }),
  C(20, { level: 'org', refId: 'o1' }),
  C(30, { level: 'department', refId: 'd1' }),
];
const r1 = resolvePayRule(s1, ctx());
ok(r1.value === 30 && r1.provenance.scope.level === 'department', 'department scope beats org/global');

// 2. jurisdiction: state overrides national at same scope; wrong state excluded
const s2 = [
  C(100, { level: 'org', refId: 'o1' }, { j: '' }),
  C(200, { level: 'org', refId: 'o1' }, { j: 'IN-KA' }),
];
ok(resolvePayRule(s2, ctx()).value === 200, 'state (IN-KA) beats national at same scope');
const s2b = [C(100, { level: 'org', refId: 'o1' }, { j: '' }), C(200, { level: 'org', refId: 'o1' }, { j: 'IN-MH' })];
ok(resolvePayRule(s2b, ctx()).value === 100, "other state's (IN-MH) rule excluded → national wins");

// 3. when: specific over default
const s3 = [
  C(1, { level: 'org', refId: 'o1' }),
  C(2, { level: 'org', refId: 'o1' }, { when: { regime: 'new' } }),
];
ok(resolvePayRule(s3, ctx({ attrs: { regime: 'new' } })).value === 2, 'when-specific (regime=new) beats default');
ok(resolvePayRule(s3, ctx({ attrs: { regime: 'old' } })).value === 1, 'non-matching when → default');

// 4. recency + version
const s4 = [C(1, { level: 'org', refId: 'o1' }, { from: '2026-01-01' }), C(2, { level: 'org', refId: 'o1' }, { from: '2026-04-01' })];
ok(resolvePayRule(s4, ctx()).value === 2, 'newer effectiveFrom wins');
const s5 = [C(1, { level: 'org', refId: 'o1' }, { from: '2026-04-01', ver: 1 }), C(2, { level: 'org', refId: 'o1' }, { from: '2026-04-01', ver: 3 })];
ok(resolvePayRule(s5, ctx()).value === 2, 'higher version wins at same date');

// 5. future not yet effective
ok(resolvePayRule([C(9, { level: 'org', refId: 'o1' }, { from: '2027-01-01' })], ctx()) === null, 'future-only → null');

// 6. no match → null; required → PAY-CMP-510
ok(resolvePayRule([C(1, { level: 'department', refId: 'dX' })], ctx()) === null, 'inapplicable → null');
throws(() => resolveRequiredPayRule([], ctx(), 'pf.rate'), /PAY-CMP-510/, 'mandatory + nothing → refuse (PAY-CMP-510)');

// 7. sourced-only gate
throws(() => resolvePayRule([C(12, { level: 'country' }, { verified: true, src: 0 })], ctx()), /PAY-CMP-501/, 'verified w/o source refused');
ok(resolvePayRule([C(12, { level: 'country' }, { verified: true, src: 1 })], ctx()).value === 12, 'verified WITH source is fine');
ok(resolvePayRule([C(12, { level: 'org', refId: 'o1' }, { verified: false, src: 0 })], ctx()).value === 12, 'unverified w/o source is fine (only verified needs a source)');

// 8. provenance
const p = resolvePayRule(s2, ctx()).provenance;
ok(p.scope.level === 'org' && p.jurisdiction === 'IN-KA' && p.version === 0 && p.verified === false, 'provenance recorded (scope/jurisdiction/version/verified)');

// 9. tie → defect
const tie = [C(1, { level: 'org', refId: 'o1' }, { from: '2026-04-01', ver: 2 }), C(2, { level: 'org', refId: 'o1' }, { from: '2026-04-01', ver: 2 })];
throws(() => resolvePayRule(tie, ctx()), /PAY-CMP-CONFLICT/, 'genuine tie surfaced as defect');

// 10. bad asOf
throws(() => resolvePayRule(s1, ctx({ asOf: 'nope' })), /asOf is not a valid/, 'bad asOf throws');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay rule-resolver — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
