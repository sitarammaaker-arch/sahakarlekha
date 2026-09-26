// Chart integrity across every shipped society template (found by the NABARD CAS mapping, G1/G2):
// - the sale / purchase fallback heads (RULE 4: '4101' / '5101') exist in every trading chart,
//   so an item without its own account never posts to a head the society does not have;
// - after migrateAccounts, no account points to a parent group the chart lacks;
// - an accumulated-depreciation head never exists without its asset head (3110 → Vehicle 3104);
// - adding the PACS heads to ACCOUNTS_TO_ADD never renames / duplicates another chart's heads.
// Run: node scripts/test-chart-integrity.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const S = await import(pathToFileURL(path.join(SRC, 'lib/storage.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const TRADING = ['marketing_processing', 'pacs', 'consumer', 'dairy', 'sugar'];
for (const [type, tpl] of Object.entries(S.SOCIETY_TEMPLATES)) {
  const { accounts } = S.migrateAccounts(tpl.map((a) => ({ ...a })));
  const ids = new Set(accounts.map((a) => a.id));
  const orphans = accounts.filter((a) => a.parentId && !ids.has(a.parentId)).map((a) => `${a.id}→${a.parentId}`);
  ok(orphans.length === 0, `${type}: no account under a missing parent group (${orphans.join(', ') || 'none'})`);
  if (TRADING.includes(type)) {
    ok(ids.has('4101') && ids.has('5101'), `${type}: sale / purchase fallback heads 4101 + 5101 exist (RULE 4)`);
    const a4101 = accounts.find((a) => a.id === '4101'), a5101 = accounts.find((a) => a.id === '5101');
    ok(a4101?.type === 'income' && !a4101.isGroup && a5101?.type === 'expense' && !a5101.isGroup, `${type}: 4101 is an income head, 5101 an expense head`);
  }
  if (ids.has('3110')) ok(ids.has('3104'), `${type}: Accum. Dep. - Vehicle (3110) has a Vehicle asset head (3104)`);
  const dup = accounts.map((a) => a.id).filter((id, i, arr) => arr.indexOf(id) !== i);
  ok(dup.length === 0, `${type}: no duplicate ids (${dup.join(', ') || 'none'})`);
}

// Other charts keep THEIR names for these ids (skip-by-id — never renamed to fertiliser/seed).
const names = (tpl) => Object.fromEntries(S.migrateAccounts(tpl.map((a) => ({ ...a }))).accounts.map((a) => [a.id, a.name]));
const consumer = names(S.SOCIETY_TEMPLATES.consumer), sugar = names(S.SOCIETY_TEMPLATES.sugar), housing = names(S.SOCIETY_TEMPLATES.housing), dairy = names(S.SOCIETY_TEMPLATES.dairy);
ok(consumer['4101'] === 'Grocery Sales' && sugar['4101'] === 'Sugar Sales' && dairy['4101'] === 'Sales — General' && housing['4101'] === 'Maintenance Charges', 'other charts keep their own 4101 name');
ok(housing['5101'] === 'Water Supply Charges' && housing['3104'] === 'Lift / Elevator', 'housing keeps its own 5101 / 3104');

// PACS: the trading heads the CAS Trading Account needs.
const pacs = names(S.SOCIETY_TEMPLATES.pacs);
ok(pacs['4101'] === 'Fertilizer Sales' && pacs['4102'] === 'Seed Sales' && pacs['5101'] === 'Purchase' && pacs['3104'] === 'Vehicle', 'PACS has Fertilizer / Seed Sales, Purchase, Vehicle');
ok(pacs['3400'] && pacs['4100'] && pacs['5100'], 'PACS has the Inventory / Trading Income / Direct Expenses groups');

console.log(`chart integrity: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
