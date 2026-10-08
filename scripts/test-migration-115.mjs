// Migration 115 (round off + cash discount). The SQL is GENERATED from ACCOUNTS_TO_ADD_115 (scripts/gen-migration-115.mjs);
// this test fails if a committed file drifts from it, and pins the safety shape.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildFiles, valuesBlock } = await import('./gen-migration-115.mjs');
const S = await import(new URL('../src/lib/storage.ts', import.meta.url).href).catch(() => null);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const strip = (s) => s.replace(/--.*$/gm, '');

const gen = buildFiles();
for (const [f, text] of Object.entries(gen)) {
  const onDisk = readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  ok(onDisk === text, `${f} is up to date (run: node scripts/gen-migration-115.mjs)`);
}
const up = strip(gen['supabase/migrations/115_round_off_cash_discount.sql']);
const prev = strip(gen['supabase/diagnostics/preview_115_round_off_cash_discount.sql']);
const down = strip(gen['supabase/migrations/115_round_off_cash_discount_down.sql']);

ok(S && valuesBlock().split('\n').length === S.ACCOUNTS_TO_ADD_115.length, 'every ACCOUNTS_TO_ADD_115 row is in the VALUES list');
ok(/add column if not exists "roundOff"/.test(up) && /add column if not exists "cashDiscount"/.test(up), 'adds the round-off / cash-discount columns (idempotent)');
ok((up.match(/insert into public\.accounts/g) || []).length === 1 && /on conflict do nothing/.test(up), 'one insert, "on conflict do nothing"');
ok(!/\b(update|delete|truncate|drop)\b/i.test(up.replace(/'[^']*'/g, '')), 'never updates, deletes or drops anything');
ok(/a\.id = v\.id\)/.test(up) && /a\.code = v\.id\)/.test(up), 'skips an id the society has, and a code another account already shows');
ok(/lower\(trim\(a\.name\)\) = lower\(trim\(v\.name\)\) and a\.type = v\.type/.test(up), 'skips a same name + type (no duplicate heads)');
ok(/exists \(select 1 from public\.accounts p where p\.society_id = s\.society_id and p\.id = v\."parentId"\)/.test(up), 'only where the parent group exists');
ok(/0, v\."openingBalanceType"/.test(up), 'opening balance is always 0');
ok(!/ledger_events|voucher_lines|\bvouchers\b/.test(up), 'touches no voucher or journal table');
ok(!/create\s+(temp|temporary)\s+table/i.test(up), 'no temp tables');
ok(!/\b(insert|update|delete|drop|create|alter)\b/i.test(prev), 'preview is read-only');
ok(/not exists \(select 1 from public\.voucher_lines/.test(down) && /coalesce\(a\."openingBalance", 0\) = 0/.test(down), 'down keeps any account that is posted to or has an opening');

if (S) {
  const ids = S.ACCOUNTS_TO_ADD_115.map((a) => a.id);
  ok(ids.includes('4499') && ids.includes('5499'), '4499 Discount Received + 5499 Round Off');
  ok(S.ACCOUNTS_TO_ADD_115.every((a) => !S.ACCOUNTS_TO_ADD.some((x) => x.id === a.id)), 'no overlap with ACCOUNTS_TO_ADD (114 already ran — its list must not grow)');
  const chart = S.fullChartForType('marketing_processing');
  ok(ids.every((id) => chart.some((a) => a.id === id)), 'new / reset societies are seeded with both (fullChartForType)');
  ok(S.migrateAccounts([]).accounts.some((a) => a.id === '5499'), 'merged on screen for existing societies (migrateAccounts)');
}

console.log(`Migration 115: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
