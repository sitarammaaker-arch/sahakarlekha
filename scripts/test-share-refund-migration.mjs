// Migration 100 (supabase/migrations/100_add_missing_standard_accounts.sql) and its read-only preview.
// Pins that the migration only ADDS accounts, that every account it adds is IDENTICAL to a definition a shipped chart
// already uses (it invents nothing), that its preview lists the same accounts, and that its down only removes unused rows.
// Run: node scripts/test-standard-accounts-migration.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
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

const MIG = readFileSync(path.join(ROOT, 'supabase/migrations/101_share_refund_payable_and_pacs_groups.sql'), 'utf8');
const DOWN = readFileSync(path.join(ROOT, 'supabase/migrations/101_share_refund_payable_and_pacs_groups_down.sql'), 'utf8');
const PREVIEW = readFileSync(path.join(ROOT, 'scripts/preview-101-share-refund-payable-and-pacs-groups.sql'), 'utf8');

const parseSpec = (sql) => {
  const rows = [];
  const re = /^\s*\((\d+),\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',\s*'(\w+)',\s*(null|'\w+'),\s*'(\w+)',\s*(true|false),\s*(true|false),\s*'(\d+)',\s*(null::text\[\]|array\[[^\]]*\])\)[,;]?\s*$/gm;
  let m;
  while ((m = re.exec(sql))) {
    rows.push({
      ord: Number(m[1]), id: m[2], name: m[3], nameHi: m[4], type: m[5],
      subtype: m[6] === 'null' ? undefined : m[6].slice(1, -1), nature: m[7], isGroup: m[8] === 'true', isSystem: m[9] === 'true', parentId: m[10],
      types: m[11].startsWith('null') ? null : [...m[11].matchAll(/'(\w+)'/g)].map((x) => x[1]),
    });
  }
  return rows;
};
const spec = parseSpec(MIG);
const prev = parseSpec(PREVIEW);
ok(spec.length === 3, `the migration lists 3 accounts (parsed ${spec.length})`);
ok(JSON.stringify(spec) === JSON.stringify(prev), 'the read-only preview lists exactly the same accounts, in the same order, as the migration');
ok(spec.map((r) => r.id).join() === '2111,4100,5100', 'adds Share Refund Payable and the two PACS trading groups, nothing else');

// identical to the definitions the templates use (it invents nothing)
const charts = Object.entries(S.SOCIETY_TEMPLATES).map(([t, tpl]) => [t, S.migrateAccounts(tpl.map((a) => ({ ...a }))).accounts]);
const same = (r, a) => a.id === r.id && a.name === r.name && a.nameHi === r.nameHi && a.type === r.type && (a.subtype || undefined) === r.subtype
  && a.openingBalanceType === r.nature && !!a.isGroup === r.isGroup && !!a.isSystem === r.isSystem && a.parentId === r.parentId;
for (const r of spec) ok(charts.some(([, c]) => c.some((a) => same(r, a))), `${r.id} ${r.name}: identical to a definition a shipped chart already uses`);
ok(charts.every(([, c]) => c.some((a) => same(spec[0], a))), '2111 is in every shipped chart (new societies get it from the template)');
ok(spec[0].types === null && spec[1].types?.join() === 'pacs' && spec[2].types?.join() === 'pacs', '2111 applies to all society types; the groups only to pacs');
ok(spec.every((r) => r.isSystem === false), 'none is isSystem');

// the migration only adds, and uses no temp table (the SQL Editor once lost m100_spec between statements)
const code = MIG.replace(/--.*$/gm, '');
ok(/insert into public\.accounts/i.test(code), 'inserts into accounts');
ok(!/update\s+public\.accounts/i.test(code) && !/delete\s+from\s+public\.accounts/i.test(code) && !/drop\s+table\s+public\.accounts/i.test(code) && !/alter\s+table\s+public\.accounts/i.test(code), 'never updates / deletes / alters accounts');
ok(!/voucher|ledger_events|account_roles/i.test(code.replace(/public\.account_seed_log/gi, '')), 'does not touch vouchers, ledger events or role mappings');
ok(!/create\s+temp/i.test(code), 'no temporary table');
ok(/not exists \(select 1 from public\.accounts x where x\.society_id::text = s\.sid and x\.id = r\.id\)/.test(code), 'inserts only when the id is absent in that society');
ok(/lower\(x\.name\) = lower\(r\.name\) and x\.type = r\.type/.test(code), 'skips a same-name + same-type account');
ok(/p\."isGroup"/.test(code) && /p\.id = r\.parent_id/.test(code), 'inserts only under an existing parent group');
ok(/account_seed_log/.test(code) && /select '101', society_id, id from ins/.test(code), 'logs every inserted (society, account)');
ok(/values \('101', 'share_refund_payable_and_pacs_groups'\)/.test(code) && /on conflict \(version\) do nothing/.test(code), 'records itself in app_migrations');
ok(/^begin;/m.test(code) && /^commit;/m.test(code), 'runs in one transaction');
ok(/0, r\.nature/.test(code), 'new accounts have a zero opening balance');

// the down only removes unused rows
const down = DOWN.replace(/--.*$/gm, '');
for (const ref of ['voucher_entries', 'voucher_lines', 'vouchers', 'suppliers', 'customers', 'stock_items', 'account_roles']) ok(new RegExp(`public\\.${ref}\\b`).test(down), `the down checks ${ref} before deleting`);
ok(/ch\."parentId" = r\.account_id/.test(down) && /openingBalance/.test(down), 'the down also checks child accounts and a non-zero balance');
ok(/where migration = '101'/.test(down) && /delete from public\.accounts a where a\.society_id::text = r\.society_id and a\.id = r\.account_id/.test(down), 'the down deletes only logged (society, account) rows');
ok(/delete from public\.app_migrations where version = '101'/.test(down) && !/'100'/.test(down), 'the down clears only its own app_migrations row');

const files = readdirSync(path.join(ROOT, 'supabase/migrations')).filter((f) => /^101_/.test(f));
ok(files.length === 2, `only this migration claims number 101 (${files.join(', ')})`);

console.log(`share-refund migration 101: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;   // not process.exit(): it races the register() loader worker on Windows (#670)
