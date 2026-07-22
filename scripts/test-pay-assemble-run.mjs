// Run assembly (orchestrator pure core). Proves the single artifact the impure shell persists is
// built by composing EVERY subsystem: resolve.freezeViews + formula.compileFormulaCatalog +
// calc.computePayslip (per employee) + runtime.buildPayEvent. Deterministic; ids/time injected.
// Imports real .ts across resolve/ + formula/ + calc/ + runtime/ + orchestrator/.
//
// Run: node scripts/test-pay-assemble-run.mjs   (npm run test:pay-assemble-run)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let ar, ex;
try {
  ar = await import(abs('../src/lib/pay/orchestrator/assembleRun.ts'));
  ex = await import(abs('../src/lib/pay/formula/evaluator.ts'));
} catch (e) {
  console.error('import failed:', e.message);
  process.exit(1);
}
const { assembleRun } = ar;
const { makeMoney } = ex;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, re, msg) => { try { fn(); fail++; console.error('  ✗ (did not throw)', msg); } catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error('  ✗ (wrong error)', msg, '::', e.message); } } };
const money = (v, minor, cur = 'INR') => v && v.kind === 'money' && v.minor === minor && v.currency === cur;

// resolver catalogs (minimal, from the freeze test's shapes)
const chain = { orgType: 'pacs', orgId: 'o1', branchId: 'b1', departmentId: 'd1', cadreId: 'c1', designationId: 'g1', employeeId: 'e1' };
const RC = (value, scope, o = {}) => ({ value, scope, jurisdiction: o.j ?? '', effectiveFrom: o.from ?? '2026-01-01', verified: o.verified, sourceCount: o.src });
const CC = (value, scope, o = {}) => ({ value, scope, effectiveFrom: o.from ?? '2026-01-01' });
const freeze = {
  catalogs: {
    rules: { 'pf.rate.employee': { candidates: [RC(12, { level: 'country' }, { verified: true, src: 1 })], required: true } },
    policies: {},
    config: { rounding: [CC('half_up', { level: 'global' })] },
  },
  ctx: { chain, jurisdiction: 'IN-KA', asOf: '2026-05-01' },
};

// formula catalog (shared plan): DA/HRA/GROSS/PF, net aggregated
const formula = {
  sources: [
    { code: 'DA', source: 'formula "DA" :: Money let b = BASIC in b * 20%' },
    { code: 'HRA', source: 'formula "HRA" :: Money let b = BASIC in b * 40%' },
    { code: 'GROSS', source: 'formula "GROSS" :: Money let b = BASIC in b + DA + HRA' },
    { code: 'PF', source: 'formula "PF" :: Money let b = BASIC in b * 12%' },
  ],
  typeBase: { vars: { BASIC: 'Money' }, fns: {} },
};
const classification = { DA: 'earning', HRA: 'earning', GROSS: 'info', PF: 'deduction' };
const emp = (id, basicMinor) => ({
  employeeId: id,
  calc: {
    facts: { attendance: { paidDays: 30, lopDays: 0, otHours: 0 }, leave: [], loan: [], tax: { ytdByHead: {}, monthsRemaining: 6, regime: 'new' } },
    currency: 'INR',
    fixedComponents: { BASIC: makeMoney(basicMinor, 'INR') },
    fns: {},
  },
  aggregate: { classification },
});

const input = {
  societyId: 's1',
  runId: 'run-2026-04',
  sequence: 2, // e.g. after an 'initiated' event
  freeze,
  formula,
  employees: [emp('e1', 3000000), emp('e2', 5000000)], // ₹30000, ₹50000
  producer: { kind: 'human', actorEmail: 'hr@society.test' },
};
const evCtx = { eventId: 'evt-uuid-1', occurredAt: '2026-05-01T10:00:00.000Z' };

const run = assembleRun(input, evCtx);

// 1. frozen views produced (→ run_snapshot)
ok(run.frozenViews.ruleView['pf.rate.employee'].value === 12 && run.frozenViews.configView.rounding === 'half_up', 'frozen views composed for the run');

// 2. shared plan compiled once, topologically
ok(run.plan.order.includes('GROSS') && run.plan.order.indexOf('DA') < run.plan.order.indexOf('GROSS'), 'formula plan compiled + ordered once for the run');

// 3. per-employee payslips (e1: BASIC 3000000 → DA 600000 + HRA 1200000 = gross 1800000, PF 360000, net 1440000)
ok(run.payslips.length === 2, 'a payslip per employee');
const e1 = run.payslips.find((p) => p.employeeId === 'e1').payslip;
ok(money(e1.grossEarnings, 1800000) && money(e1.netPay, 1440000), 'e1 payslip: gross 18000, net 14400 (aggregated)');
const e2 = run.payslips.find((p) => p.employeeId === 'e2').payslip;
ok(money(e2.netPay, 2400000), 'e2 payslip: net = 3000000 − 600000(PF) = 2400000');

// 4. the 'calculated' WORM event
ok(run.event.eventType === 'calculated' && run.event.aggregateType === 'pay_run', "a 'calculated' pay_run event");
ok(run.event.eventId === 'evt-uuid-1' && run.event.occurredAt === '2026-05-01T10:00:00.000Z', 'event carries injected id + occurredAt (pure)');
ok(run.event.sequence === 2 && run.event.societyId === 's1' && run.event.aggregateId === 'run-2026-04', 'event envelope: sequence + society + aggregate');
ok(run.event.producerKind === 'human' && run.event.actorEmail === 'hr@society.test', 'event producer recorded');
ok(run.event.payload.employeeCount === 2 && run.event.payload.nets.find((n) => n.employeeId === 'e2').netMinor === 2400000, 'event payload summarises nets per employee');

// 5. determinism — same inputs → identical assembled run (replayability)
ok(JSON.stringify(assembleRun(input, evCtx)) === JSON.stringify(run), 'assembly is deterministic (replayable)');

// 6. a pipeline refusal propagates (unclassified component → PAY-CAL-601)
const badEmp = emp('e3', 3000000); badEmp.aggregate = { classification: { DA: 'earning', HRA: 'earning', GROSS: 'info' } }; // PF missing
throws(() => assembleRun({ ...input, employees: [badEmp] }, evCtx), /PAY-CAL-601.*'PF'/, 'unclassified component refuses through the whole assembly');

// 7. a required-rule gap in the freeze refuses the whole run
throws(() => assembleRun({ ...input, freeze: { catalogs: { rules: { 'must.have': { candidates: [], required: true } }, policies: {}, config: {} }, ctx: freeze.ctx } }, evCtx), /PAY-CMP-510/, 'required-rule gap refuses the run');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  pay assemble-run — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
