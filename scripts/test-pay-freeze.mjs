// Freeze resolved views (Phase-7 §7) + the resolver↔runtime seam. Proves freezeViews composes
// ruleView/policyView/configView, propagates the integrity gates, and — the capstone — that the
// frozen views fill a VALID runtime ExecutionContext. Imports real .ts via type-stripping.
//
// Run: node scripts/test-pay-freeze.mjs   (npm run test:pay-freeze)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let fz, ec;
try {
  fz = await import(abs('../src/lib/pay/resolve/freeze.ts'));
  ec = await import(abs('../src/lib/pay/runtime/execContext.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { freezeViews } = fz;
const { assertExecutionContext } = ec;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };

const chain = { orgType: 'pacs', orgId: 'o1', branchId: 'b1', departmentId: 'd1', cadreId: 'c1', designationId: 'g1', employeeId: 'e1' };
const ctx = { chain, jurisdiction: 'IN-KA', asOf: '2026-05-01' };
const RC = (value, scope, o = {}) => ({ value, scope, jurisdiction: o.j ?? '', when: o.when, effectiveFrom: o.from ?? '2026-01-01', version: o.ver, verified: o.verified, sourceCount: o.src });
const PC = (scope, config, o = {}) => ({ scope, config, effectiveFrom: o.from ?? '2026-01-01', version: o.ver });
const CC = (value, scope, o = {}) => ({ value, scope, effectiveFrom: o.from ?? '2026-01-01', version: o.ver });

const catalogs = {
  rules: {
    'pf.rate.employee': { candidates: [RC(12, { level: 'country' }, { verified: true, src: 1 })], required: true },
    'hra.pct': { candidates: [RC(40, { level: 'org', refId: 'o1' }), RC(50, { level: 'department', refId: 'd1' })] },
    'optional.x': { candidates: [RC(1, { level: 'department', refId: 'dX' })] }, // inapplicable → null
  },
  policies: {
    attendance: [PC({ level: 'global' }, { weekOff: 'sun', maxLop: 5 }), PC({ level: 'department', refId: 'd1' }, { maxLop: 3 })],
  },
  config: {
    rounding: [CC('half_up', { level: 'global' }), CC('half_even', { level: 'org', refId: 'o1' })],
    payBasis: [CC('accrual', { level: 'org', refId: 'o1' })],
  },
};

// 1. freeze composes the three views
const v = freezeViews(catalogs, ctx);
ok(v.ruleView['pf.rate.employee'].value === 12, 'ruleView: pf.rate resolved');
ok(v.ruleView['hra.pct'].value === 50 && v.ruleView['hra.pct'].provenance.scope.level === 'department', 'ruleView: most-specific (department) hra');
ok(v.ruleView['optional.x'] === null, 'ruleView: optional unresolved → null');
ok(v.policyView.attendance.weekOff === 'sun' && v.policyView.attendance.maxLop === 3, 'policyView: composed (dept overrides maxLop, global weekOff kept)');
ok(v.configView.rounding === 'half_even' && v.configView.payBasis === 'accrual', 'configView: most-specific settings');

// 2. required-rule gap → PAY-CMP-510
throws(() => freezeViews({ rules: { 'must.have': { candidates: [], required: true } }, policies: {}, config: {} }, ctx), /PAY-CMP-510/, 'required rule gap refused');

// 3. sourced-only propagates
throws(() => freezeViews({ rules: { r: { candidates: [RC(9, { level: 'country' }, { verified: true, src: 0 })], required: true } }, policies: {}, config: {} }, ctx), /PAY-CMP-501/, 'verified-unsourced refused through freeze');

// 4. CAPSTONE — frozen views fill a VALID runtime ExecutionContext (resolver ↔ runtime seam)
const exec = {
  identity: { employeeId: 'e1', pseudonymId: 'p1', period: '2026-04', fy: '2026-27' },
  placement: { orgId: 'o1', branchId: 'b1', departmentId: 'd1', cadreId: 'c1', designationId: 'g1', payLevel: null, employmentType: 'permanent' },
  facts: {
    attendance: { paidDays: 30, lopDays: 0, otHours: 0 },
    leave: [], loan: [],
    tax: { ytdByHead: { tds: 0 }, monthsRemaining: 12, regime: 'new' },
  },
  snapshotRefs: { snapshotId: 's1', schemaVersion: 1 },
  ruleView: v.ruleView,
  policyView: v.policyView,
  configView: v.configView,
  formulaPlan: {}, // Phase-6 fills this; a present (frozen) slice satisfies the contract
  structure: { components: [{ componentId: 'c1', code: 'BASIC' }], bindings: [], overrides: [] },
  asOf: '2026-04-30',
};
ok(assertExecutionContext(exec) !== null, 'CAPSTONE: frozen resolver views satisfy the runtime ExecutionContext contract');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay freeze — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
