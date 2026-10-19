// Transport Cooperative Society type (founder decision 2026-10-19).
//
// Guards: 'transport' is a real SocietyType with a label; its template is transport + GST + TDS + PF/ESI (no
// trading, no credit); its inferred activities reproduce that entitlement exactly (cutover parity, MR-1);
// it renders Income & Expenditure (a service society), never Trading/P&L; its chart = CMS chart + the
// transport heads, with unique ids, existing parents, and running costs kept out of direct_expense.
//
// Run: node scripts/test-transport-type.mjs   (npm run test:transport-type)

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
const TR = await import(abs('../src/lib/templates/transport.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const t = C.SOCIETY_TYPES.find(x => x.value === 'transport');
ok(t && t.labelHi === 'परिवहन सहकारी समिति', 'transport is in the type list with its Hindi label');
ok(C.SOCIETY_TYPES[C.SOCIETY_TYPES.length - 1].value === 'other', "'Other' stays last in the dropdown");

const tpl = STC.SOCIETY_TYPE_CAPABILITIES.transport;
ok(JSON.stringify([...tpl].sort()) === JSON.stringify(['gst', 'pf_esi', 'tds', 'transport']), 'template = transport + gst + tds + pf_esi');
const caps = R.resolveCapabilities('transport', [], undefined, 'hr');
ok(caps.has('transport') && !caps.has('inventory_sales') && !caps.has('lending') && !caps.has('labour'), 'transport society: transport module, no trading / credit / labour works');
ok(AI.hasCutoverParity('transport'), 'inferred activities reproduce the transport entitlement (cutover parity)');
ok(AI.hasCutoverParity('transport', [], undefined, undefined, 'hr'), 'parity holds in Haryana too');

ok(ST.profitLossStatement(caps).code === 'income_expenditure', 'transport renders Income & Expenditure, not Trading/P&L');

const chart = S.fullChartForType('transport');
const ids = chart.map(a => a.id);
ok(new Set(ids).size === ids.length, 'transport chart has unique account ids');
ok(chart.every(a => !a.parentId || ids.includes(a.parentId)), 'every parent in the transport chart exists');
const cms = S.fullChartForType('marketing_processing').map(a => a.id);
ok(cms.every(id => ids.includes(id)), 'transport chart keeps every CMS head');
ok(TR.TRANSPORT_EXTRA_ACCOUNTS.every(a => ids.includes(a.id) && !cms.includes(a.id)), 'transport heads are added and collide with no CMS head');
const byId = Object.fromEntries(chart.map(a => [a.id, a]));
ok(['4501', '4502', '5701', '5702', '5703', '5705'].every(id => byId[id] && !byId[id].isGroup), 'freight, hire, diesel, tyres, repairs, permit heads are posting ledgers');
ok(TR.TRANSPORT_EXTRA_ACCOUNTS.filter(a => !a.isGroup && a.type === 'expense').every(a => a.subtype === 'operational_expense'), 'running costs are operational_expense (not counted as purchases)');
ok(TR.TRANSPORT_EXTRA_ACCOUNTS.filter(a => !a.isGroup && a.type === 'income').every(a => a.subtype === 'commission_income'), 'freight / hire income is service income (not counted as sales)');
ok(TR.TRANSPORT_EXTRA_ACCOUNTS.every(a => (a.type === 'income') === (a.openingBalanceType === 'credit')), 'income heads credit, expense heads debit');

console.log(`\ntransport-type: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
