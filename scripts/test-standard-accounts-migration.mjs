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

const MIG = readFileSync(path.join(ROOT, 'supabase/migrations/100_add_missing_standard_accounts.sql'), 'utf8');
const DOWN = readFileSync(path.join(ROOT, 'supabase/migrations/100_add_missing_standard_accounts_down.sql'), 'utf8');
const PREVIEW = readFileSync(path.join(ROOT, 'scripts/preview-100-add-missing-standard-accounts.sql'), 'utf8');

// ── parse the VALUES rows ─────────────────────────────────────────────────────────────────────────────
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
ok(spec.length === 15, `the migration lists 15 accounts (parsed ${spec.length})`);
ok(JSON.stringify(spec) === JSON.stringify(prev), 'the read-only preview lists exactly the same accounts, in the same order, as the migration');
ok(new Set(spec.map((r) => r.id)).size === spec.length, 'no account id is listed twice');
ok(spec.every((r, i) => r.ord === i + 1), 'ord is 1..N in order');

// ── identical to a shipped definition (it invents nothing) ─────────────────────────────────────────────
const charts = Object.values(S.SOCIETY_TEMPLATES).map((tpl) => S.migrateAccounts(tpl.map((a) => ({ ...a }))).accounts);
const same = (r, a) => a.id === r.id && a.name === r.name && a.nameHi === r.nameHi && a.type === r.type && (a.subtype || undefined) === r.subtype
  && a.openingBalanceType === r.nature && !!a.isGroup === r.isGroup && !!a.isSystem === r.isSystem && a.parentId === r.parentId;
for (const r of spec) {
  ok(charts.some((c) => c.some((a) => same(r, a))), `${r.id} ${r.name}: identical to a definition a shipped chart already uses`);
}

// ── applicability ─────────────────────────────────────────────────────────────────────────────────────
const KNOWN_TYPES = new Set([...Object.keys(S.SOCIETY_TEMPLATES), 'multipurpose']);
ok(spec.every((r) => r.types === null || r.types.every((t) => KNOWN_TYPES.has(t))), 'every society type named is a real society type');
ok(!spec.some((r) => r.id === '2108'), 'FD 2108 is NOT added by id (housing uses 2108 for Advance Maintenance) — handled on demand');
ok(spec.filter((r) => r.types === null).map((r) => r.id).sort().join() === '3104,5503,5504', 'only the fixed-asset / depreciation heads apply to every society type');
const byId = new Map(spec.map((r) => [r.id, r]));
for (const r of spec) {
  const p = byId.get(r.parentId);
  if (p) ok(p.ord < r.ord && p.isGroup, `${r.id}: its parent ${r.parentId} (also added here) is added first and is a group`);
}
ok(spec.every((r) => r.isGroup === false || r.id === '3400'), 'the only group added is 3400 Inventory');
ok(spec.filter((r) => r.isSystem).map((r) => r.id).join() === '5150', 'only 5150 Closing Stock is isSystem (as in storage.ts)');

// ── the migration only adds ────────────────────────────────────────────────────────────────────────────
const code = MIG.replace(/--.*$/gm, '');
ok(/insert into public\.accounts/i.test(code), 'inserts into accounts');
ok(!/update\s+public\.accounts/i.test(code) && !/delete\s+from\s+public\.accounts/i.test(code) && !/drop\s+table\s+public\.accounts/i.test(code) && !/alter\s+table\s+public\.accounts/i.test(code), 'never updates / deletes / alters accounts');
ok(!/voucher|ledger_events|account_roles/i.test(code.replace(/public\.account_seed_log/gi, '')), 'does not touch vouchers, ledger events or role mappings');
ok(/not exists \(select 1 from public\.accounts x where x\.society_id::text = s\.sid and x\.id = r\.id\)/.test(code), 'inserts only when the id is absent in that society');
ok(/lower\(x\.name\) = lower\(r\.name\) and x\.type = r\.type/.test(code), 'skips a same-name + same-type account (mirrors migrateAccounts)');
ok(/p\."isGroup"/.test(code) && /p\.id = r\.parent_id/.test(code), 'inserts only under an existing parent group');
ok(/account_seed_log/.test(code) && /'100'/.test(code), 'logs every inserted (society, account)');
ok(/values \('100', 'add_missing_standard_accounts'\)/.test(code) && /on conflict \(version\) do nothing/.test(code), 'records itself in app_migrations');
ok(/^begin;/m.test(code) && /^commit;/m.test(code), 'runs in one transaction');
ok(/0, r\.nature/.test(code), 'new accounts have a zero opening balance');

// ── the down only removes unused rows ─────────────────────────────────────────────────────────────────
const down = DOWN.replace(/--.*$/gm, '');
for (const ref of ['voucher_entries', 'voucher_lines', 'vouchers', 'suppliers', 'customers', 'stock_items', 'account_roles']) {
  ok(new RegExp(`public\\.${ref}\\b`).test(down), `the down checks ${ref} before deleting`);
}
ok(/ch\."parentId" = r\.account_id/.test(down) && /openingBalance/.test(down), 'the down also checks child accounts and a non-zero balance');
ok(/where migration = '100'/.test(down) && /delete from public\.accounts a where a\.society_id::text = r\.society_id and a\.id = r\.account_id/.test(down), 'the down deletes only logged (society, account) rows');
ok(/delete from public\.app_migrations where version = '100'/.test(down), 'the down clears its app_migrations row');
ok(/not exists \(select 1 from public\.account_seed_log\)/.test(down), 'the down drops the log only when it is empty');

// ── numbering ─────────────────────────────────────────────────────────────────────────────────────────
const files = readdirSync(path.join(ROOT, 'supabase/migrations')).filter((f) => /^100_/.test(f));
ok(files.length === 2 && files.every((f) => f.startsWith('100_add_missing_standard_accounts')), `only this migration claims number 100 (${files.join(', ')})`);

console.log(`standard-accounts migration 100: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
