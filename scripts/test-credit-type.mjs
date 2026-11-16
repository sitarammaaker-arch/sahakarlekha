// Credit Cooperative Society + Thrift & Credit Cooperative Society types (2026-11-16).
//
// Two types for non-agricultural credit (founder decision: a customer must find its own name in the list):
//   credit        — Credit Cooperative Society (urban / citizens' credit societies)
//   thrift_credit — Thrift & Credit Cooperative Society (employees' / salary earners' societies)
// The National Cooperative Database counts both in one sector, "Credit & Thrift Society". Guards:
//   - both are real SocietyTypes with their own labels, and 'Other' stays last;
//   - both templates are lending + deposits + TDS: no goods, no GST, and NO farm credit;
//   - the KCC register and the NABARD report need 'agri_credit' and are therefore hidden for both, while every
//     type that had them before (pacs, multistate, multipurpose, other) still has them — and so does a society
//     that was GRANTED lending by a row (a grant implies agri_credit);
//   - inferred activities reproduce the entitlement (cutover parity);
//   - both render Income & Expenditure; Credit uses the CMS chart as it is, Thrift & Credit adds the
//     compulsory-deposit head; the heads the loan and deposit screens post to are there in both.
//
// Run: node scripts/test-credit-type.mjs   (npm run test:credit-type)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

const C = await import(abs('../src/lib/constants.ts'));
const STC = await import(abs('../src/lib/navigation/societyTypeCapabilities.ts'));
const R = await import(abs('../src/lib/navigation/capabilityResolver.ts'));
const AI = await import(abs('../src/lib/navigation/activityInference.ts'));
const ST = await import(abs('../src/lib/reports/statements.ts'));
const S = await import(abs('../src/lib/storage.ts'));
const CR = await import(abs('../src/lib/templates/credit.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const credit = C.SOCIETY_TYPES.find((x) => x.value === 'credit');
const thrift = C.SOCIETY_TYPES.find((x) => x.value === 'thrift_credit');
ok(credit && credit.label === 'Credit Cooperative Society' && /साख/.test(credit.labelHi) && !/बचत/.test(credit.labelHi), 'credit is in the type list as "Credit Cooperative Society"');
ok(thrift && thrift.label === 'Thrift & Credit Cooperative Society' && /बचत एवं साख/.test(thrift.labelHi), 'thrift_credit is in the type list as "Thrift & Credit Cooperative Society"');
ok(credit && thrift && credit.labelHi !== thrift.labelHi, 'the two types have different Hindi names');
ok(C.SOCIETY_TYPES[C.SOCIETY_TYPES.length - 1].value === 'other', "'Other' stays last in the dropdown");

const cms = S.fullChartForType('marketing_processing').map((a) => a.id);
for (const type of ['credit', 'thrift_credit']) {
  const tpl = STC.SOCIETY_TYPE_CAPABILITIES[type];
  ok(JSON.stringify([...tpl].sort()) === JSON.stringify(['deposit_ledger', 'lending', 'tds']), `${type}: template = lending + deposit_ledger + tds`);
  const caps = R.resolveCapabilities(type, [], undefined, 'hr');
  ok(caps.has('lending') && caps.has('deposit_ledger'), `${type}: loans and deposits`);
  ok(!caps.has('agri_credit') && !caps.has('inventory_sales') && !caps.has('gst') && !caps.has('procurement_msp'), `${type}: no farm credit, no goods, no GST, no procurement`);
  ok(AI.hasCutoverParity(type), `${type}: inferred activities reproduce the entitlement (cutover parity)`);
  ok(AI.hasCutoverParity(type, [], undefined, undefined, 'hr'), `${type}: parity holds in Haryana too`);
  ok(ST.profitLossStatement(caps).code === 'income_expenditure', `${type}: renders Income & Expenditure, not Trading/P&L`);

  const chart = S.fullChartForType(type);
  const ids = chart.map((a) => a.id);
  ok(new Set(ids).size === ids.length, `${type}: chart has unique account ids`);
  ok(chart.every((a) => !a.parentId || ids.includes(a.parentId)), `${type}: every parent in the chart exists`);
  ok(cms.every((id) => ids.includes(id)), `${type}: chart keeps every CMS head`);
  const byId = Object.fromEntries(chart.map((a) => [a.id, a]));
  ok(['2107', '2108', '3304', '3313', '4408', '5604'].every((id) => byId[id] && !byId[id].isGroup), `${type}: the heads the loan and deposit screens post to exist as posting ledgers`);
}

// The chart is where the two differ: only Thrift & Credit has the compulsory-deposit head.
const creditIds = S.fullChartForType('credit').map((a) => a.id);
const thriftChart = S.fullChartForType('thrift_credit');
const thriftIds = thriftChart.map((a) => a.id);
ok(creditIds.length === cms.length && !creditIds.includes('2112'), 'Credit uses the CMS chart as it is (no compulsory-deposit head)');
ok(CR.THRIFT_CREDIT_EXTRA_ACCOUNTS.every((a) => thriftIds.includes(a.id) && !cms.includes(a.id)), 'Thrift & Credit adds the compulsory-deposit head, colliding with no CMS head');
const cd = thriftChart.find((a) => a.id === '2112');
ok(cd && cd.type === 'liability' && cd.subtype === 'deposit' && cd.openingBalanceType === 'credit' && !cd.isGroup, 'compulsory (thrift) deposit is a postable deposit liability');

// Which capability a type must hold for the farm-credit screens: every type that had KCC / NABARD before still
// resolves agri_credit, and no other type gains lending.
for (const type of ['pacs', 'multistate', 'multipurpose', 'other']) {
  const c = R.resolveCapabilities(type);
  ok(c.has('lending') && c.has('agri_credit'), `${type} still holds lending + agri_credit (KCC register, NABARD report)`);
  ok(AI.hasCutoverParity(type), `${type}: inferred activities still reproduce its entitlement`);
}
for (const type of ['marketing_processing', 'consumer', 'dairy', 'housing', 'sugar', 'labour', 'producer', 'transport']) {
  const c = R.resolveCapabilities(type);
  ok(!c.has('lending') && !c.has('agri_credit'), `${type} has no lending, as before`);
}
// A society GRANTED lending by a row keeps what that grant always opened (KCC + NABARD).
const granted = R.resolveCapabilities('marketing_processing', [{ capability: 'lending', source: 'plan', mode: 'grant' }]);
ok(granted.has('lending') && granted.has('agri_credit'), 'a granted lending row implies agri_credit');
// An admin can hide farm credit alone on a type that has it.
const hidden = R.resolveCapabilities('pacs', [{ capability: 'agri_credit', source: 'admin', mode: 'revoke' }]);
ok(hidden.has('lending') && !hidden.has('agri_credit'), 'hiding agri_credit keeps lending');

console.log(`\ncredit-type: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
