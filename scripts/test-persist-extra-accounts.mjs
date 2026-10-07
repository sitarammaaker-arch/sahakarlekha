// Migration 114 persists ACCOUNTS_TO_ADD for existing societies. The SQL is GENERATED from the code's own list
// (scripts/gen-migration-114.mjs); this test fails if a committed file drifts from it, and pins the safety shape.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildFiles, valuesBlock } = await import('./gen-migration-114.mjs');
const S = await import(new URL('../src/lib/storage.ts', import.meta.url).href).catch(() => null);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const strip = (s) => s.replace(/--.*$/gm, '');

console.log('committed files == generated from ACCOUNTS_TO_ADD');
const gen = buildFiles();
for (const [f, text] of Object.entries(gen)) {
  const onDisk = readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  ok(onDisk === text, `${f} is up to date (run: node scripts/gen-migration-114.mjs)`);
}

const up = gen['supabase/migrations/114_persist_shared_extra_accounts.sql'];
const upCode = strip(up);
const down = strip(gen['supabase/migrations/114_persist_shared_extra_accounts_down.sql']);
const prev = strip(gen['supabase/diagnostics/preview_114_extra_accounts.sql']);

console.log('migration shape');
const rows = valuesBlock().split('\n').length;
ok(S && rows === S.ACCOUNTS_TO_ADD.length, `every ACCOUNTS_TO_ADD row is in the VALUES list (${rows} of ${S?.ACCOUNTS_TO_ADD?.length})`);
ok((upCode.match(/insert into public\.accounts/g) || []).length === 2, 'two inserts: groups, then ledgers');
ok(upCode.indexOf('where v."isGroup"') > 0 && upCode.indexOf('where v."isGroup"') < upCode.indexOf('where not v."isGroup"'), 'groups are inserted before ledgers');
ok((upCode.match(/on conflict do nothing/g) || []).length === 2, 'both inserts are "on conflict do nothing"');
ok(!/\b(update|delete|truncate|drop|alter)\b/i.test(upCode.replace(/'[^']*'/g, '')), 'the migration only inserts — it never updates, deletes or alters anything');
ok(!/create\s+(temp|temporary)\s+table/i.test(upCode), 'no temp tables (SQL Editor splits statements)');
ok((upCode.match(/not exists \(select 1 from public\.accounts a where a\.society_id = s\.society_id and a\.id = v\.id\)/g) || []).length === 2, 'skips an id the society already has');
ok((upCode.match(/lower\(trim\(a\.name\)\) = lower\(trim\(v\.name\)\) and a\.type = v\.type/g) || []).length === 2, 'skips a same name + type (the app rule — no duplicate heads)');
ok((upCode.match(/exists \(select 1 from public\.accounts p where p\.society_id = s\.society_id and p\.id = v\."parentId"\)/g) || []).length === 2, 'only where the parent group exists');
ok(/0, v\."openingBalanceType"/.test(upCode), 'opening balance is always 0');
ok(!/ledger_events|voucher_lines|vouchers\b/.test(upCode), 'touches no voucher or journal table');

console.log('preview / down');
ok(!/\b(insert|update|delete|drop|create|alter)\b/i.test(prev), 'preview is read-only');
ok(/not exists \(select 1 from public\.voucher_lines/.test(down) && /not exists \(select 1 from public\.stock_items/.test(down) && /not exists \(select 1 from public\.account_roles/.test(down), 'down keeps any account that is posted to or linked');
ok(/coalesce\(a\."openingBalance", 0\) = 0/.test(down), 'down never removes an account with an opening balance');

console.log('what the app merges on screen is exactly what the migration adds');
ok(!!(S && S.ACCOUNTS_TO_ADD), 'storage.ts loads and exports ACCOUNTS_TO_ADD');
if (S && S.ACCOUNTS_TO_ADD) {
  for (const a of S.ACCOUNTS_TO_ADD) ok(up.includes(`('${a.id}', '${a.name.replace(/'/g, "''")}'`), `${a.id} ${a.name} is in the SQL`);
}

console.log(`Persist extra accounts: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
