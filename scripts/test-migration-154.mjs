// Migration 154 (payable heads the chart lacked). The SQL is GENERATED from ACCOUNTS_TO_ADD_154
// (scripts/gen-migration-154.mjs); this test fails if a committed file drifts from it, and pins the safety shape:
// additive only — no existing account is renamed, retyped or moved, so no report figure can change.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildFiles, valuesBlock } = await import('./gen-migration-154.mjs');
const S = await import(new URL('../src/lib/storage.ts', import.meta.url).href).catch(() => null);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const strip = (s) => s.replace(/--.*$/gm, '');

const gen = buildFiles();
for (const [f, text] of Object.entries(gen)) {
  const onDisk = readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  ok(onDisk === text, `${f} is up to date (run: node scripts/gen-migration-154.mjs)`);
}
const up = strip(gen['supabase/migrations/154_statutory_payable_heads.sql']);
const prev = strip(gen['supabase/diagnostics/preview_154_statutory_payable_heads.sql']);
const down = strip(gen['supabase/migrations/154_statutory_payable_heads_down.sql']);

ok(S && valuesBlock().split('\n').length === S.ACCOUNTS_TO_ADD_154.length, 'every ACCOUNTS_TO_ADD_154 row is in the VALUES list');
ok((up.match(/insert into public\.accounts/g) || []).length === 1 && /on conflict do nothing/.test(up), 'one insert, "on conflict do nothing"');
ok(!/\b(update|delete|truncate|drop|alter)\b/i.test(up.replace(/'[^']*'/g, '')), 'never updates, deletes, drops or alters anything');
ok(/a\.id = v\.id\)/.test(up) && /a\.code = v\.id\)/.test(up), 'skips an id the society has, and a code another account already shows');
ok(/lower\(trim\(a\.name\)\) = lower\(trim\(v\.name\)\) and a\.type = v\.type/.test(up), 'skips a same name + type (no duplicate heads)');
ok(/v\.needs_id is null or exists \(select 1 from public\.accounts n where n\.society_id = s\.society_id and n\.id = v\.needs_id and lower\(trim\(n\.name\)\) = lower\(trim\(v\.needs_name\)\)\)/.test(up), 'a conditional head only where the account it needs exists (same id and name)');
ok(/exists \(select 1 from public\.accounts p where p\.society_id = s\.society_id and p\.id = v\."parentId"\)/.test(up), 'only where the parent group exists');
ok(/0, v\."openingBalanceType"/.test(up), 'opening balance is always 0');
ok(!/ledger_events|voucher_lines|\bvouchers\b/.test(up), 'touches no voucher or journal table');
ok(!/create\s+(temp|temporary)\s+table/i.test(up), 'no temp tables');
ok(!/\b(insert|update|delete|drop|create|alter)\b/i.test(prev), 'preview is read-only');
ok(/not exists \(select 1 from public\.voucher_lines/.test(down) && /coalesce\(a\."openingBalance", 0\) = 0/.test(down), 'down keeps any account that is posted to or has an opening');

if (S) {
  const add = S.ACCOUNTS_TO_ADD_154;
  const ids = add.map((a) => a.id);
  ok(['2196', '2197', '2198', '2296', '2297'].every((id) => ids.includes(id)) && ids.length === 5, 'the five payable heads, and nothing else');
  ok(add.every((a) => a.type === 'liability' && !a.isGroup && !a.isSystem && a.openingBalance === 0 && a.openingBalanceType === 'credit'), 'all are plain credit-nature liability ledgers with no opening');
  ok(add.every((a) => !S.ACCOUNTS_TO_ADD.some((x) => x.id === a.id) && !S.ACCOUNTS_TO_ADD_115.some((x) => x.id === a.id)), 'no overlap with the 114 / 115 lists (both already ran)');

  const TYPES = ['marketing_processing', 'pacs', 'consumer', 'dairy', 'housing', 'sugar', 'transport'];
  for (const t of TYPES) {
    const tpl = S.SOCIETY_TEMPLATES[t];
    const chart = S.fullChartForType(t);
    const byId = new Map(chart.map((a) => [a.id, a]));
    ok(new Set(chart.map((a) => a.id)).size === chart.length, `${t}: no duplicate ids`);
    ok(tpl.every((a) => !ids.includes(a.id)), `${t}: the template itself does not use a new code`);
    ok(['2196', '2197', '2198', '2297'].every((id) => byId.has(id)), `${t}: seeded with the four unconditional heads`);
    ok(!add.some((x) => /bonus payable/i.test(x.name) || x.nameHi.includes('देय बोनस')), `${t}: no new head can be mistaken for the dairy producers' Bonus Payable`);
    ok(add.filter((a) => byId.has(a.id)).every((a) => byId.get(a.parentId)?.isGroup), `${t}: each new head hangs under an existing group`);
    const hasMarketFee = chart.some((a) => a.id === '4202' && a.name === 'Market Fee');
    ok(byId.has('2296') === hasMarketFee, `${t}: Market Fee Payable ${hasMarketFee ? 'present' : 'absent'} (follows the 4202 Market Fee head)`);
    // Additive only: every account the chart had before is still there, unchanged.
    const before = S.migrateAccounts(tpl.map((a) => ({ ...a }))).accounts.filter((a) => !ids.includes(a.id));
    ok(JSON.stringify(before) === JSON.stringify(chart.filter((a) => !ids.includes(a.id))), `${t}: no existing account renamed, retyped or moved`);
  }
  ok(S.fullChartForType('marketing_processing').some((a) => a.id === '2296') && !S.fullChartForType('housing').some((a) => a.id === '2296'), 'Market Fee Payable: marketing yes, housing no');
  // A chart whose 4202 is a different head (housing: NOC Charges) must not get Market Fee Payable.
  const noc = S.migrateAccounts([{ id: '4202', name: 'NOC Charges', nameHi: '', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false }]).accounts;
  ok(!noc.some((a) => a.id === '2296'), 'a 4202 with another name does not count');
  ok(!add.some((x) => /^gst payable|देय gst/i.test(x.name) || /^gst payable|देय gst/i.test(x.nameHi)), 'the reverse-charge head cannot be mistaken for the ordinary GST Payable (role matcher)');
  // Idempotent: a second pass adds nothing.
  const once = S.fullChartForType('marketing_processing');
  ok(S.migrateAccounts(once.map((a) => ({ ...a }))).newlyAdded.length === 0, 'second pass adds nothing');
}

console.log(`Migration 154: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
