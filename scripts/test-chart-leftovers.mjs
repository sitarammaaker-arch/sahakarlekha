// Chart-work leftovers (open list of 2026-10-07, items 5 + 6) — closed 2026-10-09.
//   • a GROUP with accounts under it cannot be unticked back to a ledger (DataContext + Ledger Heads UI)
//   • the accounts importer reports success only from the cloud result (RULE 1), never before a save answers
//   • Ledger Heads export carries the parent group, in the form the importer's parent_group cell accepts
//   • no real login example in the public repo (supabase-app-login.sql)
// Source checks (house style); the parent-label form is checked against the REAL resolveParentGroup.
//
// Run: node scripts/test-chart-leftovers.mjs   (npm run test:chart-leftovers)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = resolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const { resolveParentGroup } = await import(pathToFileURL(resolve(SRC, 'lib', 'importTemplates.ts')).href);
const { accountCode } = await import(pathToFileURL(resolve(SRC, 'lib', 'accountCode.ts')).href);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

// 1. Group → ledger refused while it has children
const dc = read('src/contexts/DataContext.tsx');
ok(/if \(current && current\.isGroup && data\.isGroup !== undefined && !data\.isGroup\) \{\s*const childCount = accountsRef\.current\.filter\(a => a\.parentId === id\)\.length;\s*if \(childCount > 0\)[\s\S]{0,400}return false;/.test(dc), 'updateAccount refuses un-grouping a group that has accounts under it');
const lh = read('src/pages/LedgerHeads.tsx');
ok(/if \(editAccount\.isGroup\) return editGroupChildren > 0;/.test(lh), 'Ledger Heads locks the Group tick on a group with children');
ok(/इस ग्रुप के नीचे \$\{editGroupChildren\} खाते हैं/.test(lh), '…and says why, in Hindi');

// 2. Importer success from the cloud result
const imp = read('src/pages/UniversalImporter.tsx');
const body = imp.slice(imp.indexOf('function handleAccountImport()'), imp.indexOf('// ── Members ──'));
ok(/onSaved: \(\) => \{ saved\+\+; settle\(\); \}/.test(body) && /onFailed: \(\) => \{ failed\+\+; settle\(\); \}/.test(body), 'accounts import counts saves from onSaved / onFailed');
ok(!/imported\+\+/.test(body) && /if \(saved \+ failed < toSave\.length\) return;/.test(body), 'the summary toast waits until every save has answered');
ok(/सेव नहीं हुए/.test(body) && /variant: 'destructive'/.test(body), 'a partial failure is a destructive toast');
const addAcc = dc.slice(dc.indexOf('const addAccount = useCallback('), dc.indexOf('const addAccount = useCallback(') + 1200);
ok((addAcc.match(/opts\?\.onFailed\?\.\(\);/g) || []).length >= 2, 'every early refusal in addAccount answers onFailed (no stuck spinner)');

// 3. Export parent group round-trips through the importer
ok(/'Parent Group'/.test(lh) && (lh.match(/parentLabel\(acc\)/g) || []).length === 2, 'CSV + Excel export carry a Parent Group column');
const accounts = [
  { id: '5300', name: 'Indirect Expenses', type: 'expense', isGroup: true },
  { id: 'g-uuid', name: 'Office Expenses', type: 'expense', isGroup: true, code: '5310' },
];
const label = (p) => accountCode(p) || p.name;
ok(resolveParentGroup({ account_type: 'expense', parent_group: label(accounts[0]) }, accounts).parentId === '5300', 'an exported standard parent resolves back on import');
ok(resolveParentGroup({ account_type: 'expense', parent_group: label(accounts[1]) }, accounts).parentId === 'g-uuid', 'an exported custom parent (by its code) resolves back on import');

// 4. No real login example in the public repo
const sql = read('supabase-app-login.sql');
ok(!/app_login\('[^']*@(gmail|yahoo|hotmail|outlook|rediffmail)\.[a-z.]+'/i.test(sql), 'supabase-app-login.sql has no real-looking login example');

console.log(`Chart leftovers: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
