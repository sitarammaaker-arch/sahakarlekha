// Scope resolution (Phase-7 §3/§8). Proves the org-scope specificity ranking, applicability, and
// most-specific selection (narrower scope → recency → version) with tie-as-defect. Imports the real
// .ts via Node 24 type-stripping.
//
// Run: node scripts/test-pay-scope.mjs   (npm run test:pay-scope)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/pay/resolve/scope.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { SCOPE_LEVELS, scopeSpecificity, scopeApplies, selectMostSpecific } = m;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

const chain = { orgType: 'pacs', orgId: 'o1', branchId: 'b1', departmentId: 'd1', cadreId: 'c1', designationId: 'g1', employeeId: 'e1' };

// 1. levels + specificity
ok(SCOPE_LEVELS.length === 10, '10 scope levels');
ok(scopeSpecificity('global') === 0 && scopeSpecificity('employee') === 9, 'global=0, employee=9');
ok(scopeSpecificity('employee') > scopeSpecificity('department') && scopeSpecificity('department') > scopeSpecificity('org'), 'employee > department > org');
throws(() => scopeSpecificity('planet'), /unknown level/, 'unknown level throws');

// 2. applicability
ok(scopeApplies({ level: 'global' }, chain), 'global applies to everyone');
ok(scopeApplies({ level: 'state' }, chain), 'state applies (jurisdiction handled separately)');
ok(scopeApplies({ level: 'department', refId: 'd1' }, chain), 'department#d1 applies to a d1 employee');
ok(!scopeApplies({ level: 'department', refId: 'd2' }, chain), 'department#d2 does NOT apply');
ok(scopeApplies({ level: 'employee', refId: 'e1' }, chain), 'employee#e1 applies to e1');
ok(!scopeApplies({ level: 'employee', refId: 'e2' }, chain), 'employee#e2 does NOT apply to e1');
ok(!scopeApplies({ level: 'org', refId: null }, chain), 'org with null refId does not apply');

const asOf = '2026-05-01';
const cand = (level, refId, effectiveFrom, version) => ({ scope: { level, refId }, effectiveFrom, version, tag: `${level}:${effectiveFrom}:${version ?? 0}` });

// 3. most-specific wins
const set1 = [
  cand('global', null, '2026-01-01', 1),
  cand('org', 'o1', '2026-01-01', 1),
  cand('department', 'd1', '2026-01-01', 1),
];
ok(selectMostSpecific(set1, chain, asOf).tag === 'department:2026-01-01:1', 'narrowest scope (department) wins over org/global');

// 4. non-applicable filtered out (wrong department), falls to org
const set2 = [cand('global', null, '2026-01-01', 1), cand('org', 'o1', '2026-01-01', 1), cand('department', 'dX', '2026-01-01', 1)];
ok(selectMostSpecific(set2, chain, asOf).tag === 'org:2026-01-01:1', 'inapplicable department ignored → org wins');

// 5. future effectiveFrom excluded
const set3 = [cand('org', 'o1', '2026-01-01', 1), cand('department', 'd1', '2026-09-01', 1)];
ok(selectMostSpecific(set3, chain, asOf).tag === 'org:2026-01-01:1', 'future department not yet effective → org wins');

// 6. recency then version tiebreak WITHIN the same scope
const set4 = [cand('department', 'd1', '2026-01-01', 1), cand('department', 'd1', '2026-04-01', 1)];
ok(selectMostSpecific(set4, chain, asOf).tag === 'department:2026-04-01:1', 'same scope → newer effectiveFrom wins');
const set5 = [cand('department', 'd1', '2026-04-01', 1), cand('department', 'd1', '2026-04-01', 3)];
ok(selectMostSpecific(set5, chain, asOf).tag === 'department:2026-04-01:3', 'same scope+date → higher version wins');

// 7. no applicable → null
ok(selectMostSpecific([cand('department', 'dX', '2026-01-01', 1)], chain, asOf) === null, 'nothing applicable → null');
ok(selectMostSpecific([], chain, asOf) === null, 'empty → null');

// 8. genuine tie → catalog defect
const tie = [cand('department', 'd1', '2026-04-01', 2), cand('department', 'd1', '2026-04-01', 2)];
throws(() => selectMostSpecific(tie, chain, asOf), /PAY-CMP-CONFLICT/, 'a real tie is surfaced as a defect');

// 9. bad asOf
throws(() => selectMostSpecific(set1, chain, 'not-a-date'), /asOf is not a valid/, 'bad asOf throws');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay scope — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
