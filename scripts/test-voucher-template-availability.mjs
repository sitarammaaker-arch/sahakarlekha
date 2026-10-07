// Quick-entry voucher templates are shown only when BOTH their accounts exist (and are postable) in the society's chart.
// Proven on the six REAL charts a new society receives (template + migrateAccounts), not on invented data.
//
// Run: node scripts/test-voucher-template-availability.mjs   (npm run test:voucher-template-availability)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));

let S, V;
try { S = await import(abs('../src/lib/storage.ts')); V = await import(abs('../src/lib/voucherTemplateAvailability.ts')); }
catch (e) { console.error('import failed:', e.message); process.exit(1); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };

const BANK = S.ACCOUNT_IDS.BANK;
const T = S.VOUCHER_TEMPLATES;
const chartOf = (type) => S.migrateAccounts(S.SOCIETY_TEMPLATES[type].map((a) => ({ ...a }))).accounts;
const bankIdsOf = (chart) => S.getBankAccountIds(chart);

console.log('\n1. on every real chart: what is shown can be used, and what is hidden really cannot');
for (const type of Object.keys(S.SOCIETY_TEMPLATES)) {
  const chart = chartOf(type), byId = new Map(chart.map((a) => [a.id, a]));
  const bankIds = bankIdsOf(chart);
  const shown = V.availableTemplates(T, chart, bankIds, BANK), hidden = T.filter((t) => !shown.includes(t));
  const postable = (id) => (id === BANK && bankIds.length > 0) || (byId.has(id) && !byId.get(id).isGroup);
  ok(shown.every((t) => postable(t.debitAccountId) && postable(t.creditAccountId)), `${type}: all ${shown.length} shown templates resolve to postable accounts`);
  ok(hidden.every((t) => !(postable(t.debitAccountId) && postable(t.creditAccountId))), `${type}: the ${hidden.length} hidden template(s) each have a missing / group account${hidden.length ? ' — ' + hidden.map((t) => t.id).join(', ') : ''}`);
  ok(shown.length + hidden.length === T.length, `${type}: nothing lost or invented (${shown.length} + ${hidden.length} = ${T.length})`);
}

console.log('\n2. the known broken combinations are hidden, and a complete chart shows all fifteen');
{
  const cms = chartOf('marketing_processing');
  ok(V.availableTemplates(T, cms, bankIdsOf(cms), BANK).length === T.length, 'CMS chart: all 15 templates shown');
  const ids = (type) => V.availableTemplates(T, chartOf(type), bankIdsOf(chartOf(type)), BANK).map((t) => t.id);
  ok(!ids('pacs').includes('commission') && !ids('pacs').includes('rent_in'), 'PACS: commission and rent templates are hidden (no 4201 / 4401 in that chart)');
  ok(!ids('housing').includes('telephone') && !ids('sugar').includes('telephone'), 'housing and sugar: the telephone template is hidden (no 5304)');
  ok(!ids('consumer').includes('commission') && !ids('sugar').includes('commission'), 'consumer and sugar: the commission template is hidden (no 4201)');
  ok(ids('pacs').includes('salary') && ids('housing').includes('salary') && ids('housing').includes('electricity'), 'the common templates (salary, electricity …) stay everywhere');
}

console.log('\n3. the bank special case, and the edges');
{
  const tpl = { debitAccountId: '3301', creditAccountId: BANK };
  const cash = { id: '3301' };
  ok(V.templateAvailable(tpl, [cash], ['bank-uuid-1'], BANK), 'a template naming the default bank is usable when the society has ANY bank account (the page swaps in the real one)');
  ok(!V.templateAvailable(tpl, [cash], [], BANK), '…and not when it has no bank account at all');
  ok(!V.templateAvailable({ debitAccountId: '5201', creditAccountId: '3301' }, [{ id: '5201', isGroup: true }, cash], [], BANK), 'a GROUP account is never usable');
  ok(V.availableTemplates(T, [], [], BANK).length === T.length, 'an empty chart (not loaded yet) shows all templates instead of flashing an empty screen');
}

console.log('\n4. wiring in the Vouchers page');
{
  const src = readFileSync(pathResolve(HERE, '..', 'src/pages/Vouchers.tsx'), 'utf8');
  ok(/availableTemplates\(VOUCHER_TEMPLATES, accounts, bankIds, ACCOUNT_IDS\.BANK\)/.test(src), 'the page builds the usable list from the society\'s own accounts');
  ok(/usableTemplates\.filter\(t => t\.category === 'receipt'\)/.test(src) && /usableTemplates\.filter\(t => t\.category === 'payment'\)/.test(src), 'both the receipt and the payment grids use the usable list');
  ok(!/VOUCHER_TEMPLATES\.filter\(t => t\.category/.test(src), 'no grid still iterates the raw list of 15');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
