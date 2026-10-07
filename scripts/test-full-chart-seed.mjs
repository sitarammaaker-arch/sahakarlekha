// A new or reset society is seeded with the COMPLETE chart (standard chart + the shared extras), so what the
// screen shows is what the database holds. Before this, the extras (purchase / sales heads, Closing Stock,
// Wages Payable …) were merged into local state on every load but never written (RM-01) — the server then
// refused the first voucher on them (account_not_found). Rania 2026-10-07: 16 accounts; 13 of 31 societies.
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
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
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

console.log('every society type');
const types = Object.keys(S.SOCIETY_TEMPLATES);
for (const t of types) {
  const full = S.fullChartForType(t);
  const ids = new Set(full.map((a) => a.id));
  ok(ids.size === full.length, `${t}: ids unique`);
  const extra = S.migrateAccounts(full.map((a) => ({ ...a }))).newlyAdded;
  ok(extra.length === 0, `${t}: screen == seed — migrateAccounts adds nothing more (${extra.map((a) => a.id).join(',')})`);
  ok(full.every((a) => !a.parentId || ids.has(a.parentId)), `${t}: every parent exists`);
  ok(full.length >= S.SOCIETY_TEMPLATES[t].length, `${t}: never smaller than the bare template`);
  ok(S.SOCIETY_TEMPLATES[t].every((a) => ids.has(a.id)), `${t}: keeps every template account`);
}
console.log('the accounts that were screen-only are now seeded');
const cms = new Set(S.fullChartForType('marketing_processing').map((a) => a.id));
for (const id of ['5150', '5110', '5111', '5112', '5113', '5114', '5115', '5116', '4104', '4105', '4106', '4107', '4108', '2109', '2211', '5209']) ok(cms.has(id), `marketing_processing seeds ${id}`);
ok(S.fullChartForType('no-such-type').length === S.fullChartForType('marketing_processing').length, 'an unknown type falls back to the CMS chart');
ok(S.fullChartForType(undefined).length === S.fullChartForType('marketing_processing').length, 'no type falls back to the CMS chart');
ok(S.fullChartForType('pacs').some((a) => a.id === '3303' && /KCC/i.test(a.name) && !a.isGroup), 'pacs keeps 3303 as the KCC loan ledger');

console.log('registration and reset both use it');
const reg = read('src/pages/Register.tsx'), setup = read('src/pages/SocietySetup.tsx');
ok(/fullChartForType\(societyType\)/.test(reg) && !/SOCIETY_TEMPLATES|CMS_SOCIETY_ACCOUNTS/.test(reg), 'Register seeds fullChartForType(societyType), not the bare template');
ok(/resetAccounts\(template\)/.test(setup) && /const template = fullChartForType\(type\)/.test(setup) && !/SOCIETY_TEMPLATES/.test(setup), 'the COA reset seeds fullChartForType(type)');

console.log(`Full chart seed: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
