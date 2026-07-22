// ExecutionContext contract (Phase-5 §4 / Phase-8). Proves a complete context validates and that
// every gap or malformed slice is refused (refuse-over-guess — the kernel never runs on a partial
// context). Imports the real .ts via Node 24 type-stripping.
//
// Run: node scripts/test-pay-exec-context.mjs   (npm run test:pay-exec-context)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/pay/runtime/execContext.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { assertExecutionContext, isExecutionContextComplete } = m;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (mutate, re, msg) => {
  const ctx = valid();
  mutate(ctx);
  try { assertExecutionContext(ctx); fail++; console.error('  ✗ (did not throw)', msg); }
  catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } }
};

// a complete, valid context
const valid = () => ({
  identity: { employeeId: 'e1', pseudonymId: 'p1', period: '2026-04', fy: '2026-27' },
  placement: { orgId: 'o1', branchId: null, departmentId: 'd1', cadreId: null, designationId: 'g1', payLevel: null, employmentType: 'permanent' },
  facts: {
    attendance: { paidDays: 30, lopDays: 0, otHours: 0 },
    leave: [{ type: 'earned', balance: 12 }],
    loan: [],
    tax: { ytdByHead: { tds: 0 }, monthsRemaining: 12, regime: 'new' },
  },
  snapshotRefs: { snapshotId: 's1', schemaVersion: 1 },
  ruleView: {}, policyView: {}, configView: {}, formulaPlan: {},
  structure: { components: [{ componentId: 'c1', code: 'BASIC' }], bindings: [], overrides: [] },
  asOf: '2026-04-30',
});

// 1. valid passes
ok(assertExecutionContext(valid()) !== null, 'a complete context validates');
ok(isExecutionContextComplete(valid()) === true, 'isExecutionContextComplete(valid) = true');

// 2. identity / shape
throws((c) => { delete c.identity; }, /identity is required/, 'missing identity');
throws((c) => { c.identity.employeeId = ''; }, /employeeId is required/, 'missing employeeId');
throws((c) => { c.identity.pseudonymId = ''; }, /pseudonymId is required/, 'missing pseudonymId');
throws((c) => { c.identity.period = '2026-13'; }, /period must be YYYY-MM/, 'bad period');
throws((c) => { c.identity.fy = '2026'; }, /fy must be YYYY-YY/, 'bad fy');

// 3. placement
throws((c) => { c.placement.orgId = ''; }, /placement.orgId is required/, 'missing orgId');
throws((c) => { c.placement.departmentId = ''; }, /placement.departmentId is required/, 'missing departmentId');
throws((c) => { c.placement.employmentType = ''; }, /placement.employmentType is required/, 'missing employmentType');

// 4. facts
throws((c) => { c.facts.attendance.paidDays = -1; }, /paidDays must be a number >= 0/, 'negative paidDays');
throws((c) => { c.facts.leave = 'x'; }, /facts.leave must be an array/, 'leave not array');
throws((c) => { c.facts.loan = null; }, /facts.loan must be an array/, 'loan not array');
throws((c) => { delete c.facts.tax; }, /facts.tax is required/, 'missing tax');
throws((c) => { c.facts.tax.monthsRemaining = -1; }, /monthsRemaining must be a number >= 0/, 'bad monthsRemaining');
throws((c) => { c.facts.tax.regime = ''; }, /facts.tax.regime is required/, 'missing regime');

// 5. snapshot refs
throws((c) => { c.snapshotRefs.snapshotId = ''; }, /snapshotId is required/, 'missing snapshotId');
throws((c) => { c.snapshotRefs.schemaVersion = 0; }, /schemaVersion must be a number >= 1/, 'schemaVersion < 1');

// 6. frozen resolved slices (refuse-over-guess)
throws((c) => { c.ruleView = null; }, /ruleView is required/, 'missing ruleView');
throws((c) => { delete c.policyView; }, /policyView is required/, 'missing policyView');
throws((c) => { c.configView = undefined; }, /configView is required/, 'missing configView');
throws((c) => { delete c.formulaPlan; }, /formulaPlan is required/, 'missing formulaPlan');

// 7. structure + asOf
throws((c) => { c.structure.components = []; }, /structure.components must be a non-empty array/, 'empty components');
throws((c) => { c.asOf = ''; }, /asOf is required/, 'missing asOf');

// 8. isExecutionContextComplete on incomplete
const bad = valid(); delete bad.formulaPlan;
ok(isExecutionContextComplete(bad) === false, 'isExecutionContextComplete(incomplete) = false');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay exec-context — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
