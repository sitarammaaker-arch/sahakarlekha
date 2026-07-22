// Payroll policy resolver (Phase-7 §4). Proves scope-chain composition (narrower overrides, array
// keys union), within-level latest-version selection, effective-dating, and tie-as-defect.
// Imports real .ts via Node 24 type-stripping.
//
// Run: node scripts/test-pay-policy-resolver.mjs   (npm run test:pay-policy-resolver)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/pay/resolve/policyResolver.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { resolvePolicy } = m;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

const chain = { orgType: 'pacs', orgId: 'o1', branchId: 'b1', departmentId: 'd1', cadreId: 'c1', designationId: 'g1', employeeId: 'e1' };
const ctx = { chain, asOf: '2026-05-01' };
const P = (scope, config, o = {}) => ({ scope, config, effectiveFrom: o.from ?? '2026-01-01', version: o.ver });

// 1. scalar override broad→narrow
const s1 = [
  P({ level: 'global' }, { maxDays: 20, weekOff: 'sun' }),
  P({ level: 'org', refId: 'o1' }, { maxDays: 22 }),
  P({ level: 'department', refId: 'd1' }, { maxDays: 25 }),
];
const r1 = resolvePolicy(s1, ctx);
ok(r1.config.maxDays === 25, 'narrowest (department) overrides maxDays → 25');
ok(r1.config.weekOff === 'sun', 'unoverridden broad key retained (weekOff)');
ok(r1.layers.length === 3 && r1.layers[0].scope.level === 'global' && r1.layers[2].scope.level === 'department', 'layers broad→narrow');

// 2. array keys union
const s2 = [
  P({ level: 'global' }, { allowedLeave: ['casual', 'earned'] }),
  P({ level: 'department', refId: 'd1' }, { allowedLeave: ['earned', 'sick'] }),
];
const u = resolvePolicy(s2, ctx).config.allowedLeave;
ok(Array.isArray(u) && u.length === 3 && ['casual', 'earned', 'sick'].every((x) => u.includes(x)), 'array keys union (casual/earned/sick)');

// 3. within-level latest version wins
const s3 = [
  P({ level: 'org', refId: 'o1' }, { rate: 1 }, { from: '2026-01-01', ver: 1 }),
  P({ level: 'org', refId: 'o1' }, { rate: 2 }, { from: '2026-04-01', ver: 1 }),
];
ok(resolvePolicy(s3, ctx).config.rate === 2, 'within a level, newer effectiveFrom wins');

// 4. future excluded, inapplicable excluded
const s4 = [
  P({ level: 'org', refId: 'o1' }, { x: 1 }),
  P({ level: 'department', refId: 'd1' }, { x: 2 }, { from: '2027-01-01' }), // future
  P({ level: 'department', refId: 'dX' }, { x: 9 }),                          // other dept
];
ok(resolvePolicy(s4, ctx).config.x === 1, 'future + wrong-dept excluded → org value stands');

// 5. empty → empty config
const empty = resolvePolicy([], ctx);
ok(Object.keys(empty.config).length === 0 && empty.layers.length === 0, 'no applicable policy → empty config');
ok(Object.keys(resolvePolicy([P({ level: 'department', refId: 'dX' }, { x: 1 })], ctx).config).length === 0, 'only inapplicable → empty');

// 6. tie within a level → defect
const tie = [
  P({ level: 'org', refId: 'o1' }, { x: 1 }, { from: '2026-04-01', ver: 2 }),
  P({ level: 'org', refId: 'o1' }, { x: 2 }, { from: '2026-04-01', ver: 2 }),
];
throws(() => resolvePolicy(tie, ctx), /PAY-CMP-CONFLICT/, 'tie within a scope level surfaced as defect');

// 7. bad asOf
throws(() => resolvePolicy(s1, { chain, asOf: 'x' }), /asOf is not a valid/, 'bad asOf throws');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay policy-resolver — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
