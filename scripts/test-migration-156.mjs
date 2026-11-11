// Migration 156 (head-wise GST ledgers, RM-17). The SQL is GENERATED from ACCOUNTS_TO_ADD_156
// (scripts/gen-migration-156.mjs); this test fails if a committed file drifts from it, and pins the safety shape:
// additive only — 2201 / 3310 and every other existing account stay exactly as they are.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildFiles, valuesBlock } = await import('./gen-migration-156.mjs');
const S = await import(new URL('../src/lib/storage.ts', import.meta.url).href);
const R = await import(new URL('../src/lib/accounting/roles.ts', import.meta.url).href);
const G = await import(new URL('../src/lib/accounting/gstLedgers.ts', import.meta.url).href);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const strip = (s) => s.replace(/--.*$/gm, '');

const gen = buildFiles();
for (const [f, text] of Object.entries(gen)) {
  const onDisk = readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  ok(onDisk === text, `${f} is up to date (run: node scripts/gen-migration-156.mjs)`);
}
const up = strip(gen['supabase/migrations/156_gst_headwise_ledgers.sql']);
const prev = strip(gen['supabase/diagnostics/preview_156_gst_headwise_ledgers.sql']);
const down = strip(gen['supabase/migrations/156_gst_headwise_ledgers_down.sql']);

ok(valuesBlock().split('\n').length === S.ACCOUNTS_TO_ADD_156.length, 'every ACCOUNTS_TO_ADD_156 row is in the VALUES list');
ok((up.match(/insert into public\.accounts/g) || []).length === 1 && /on conflict do nothing/.test(up), 'one insert, "on conflict do nothing"');
ok(!/\b(update|delete|truncate|drop|alter)\b/i.test(up.replace(/'[^']*'/g, '')), 'never updates, deletes, drops or alters anything');
ok(/a\.id = v\.id\)/.test(up) && /a\.code = v\.id\)/.test(up), 'skips an id the society has, and a code another account already shows');
ok(/lower\(trim\(a\.name\)\) = lower\(trim\(v\.name\)\) and a\.type = v\.type/.test(up), 'skips a same name + type (no duplicate heads)');
ok(/exists \(select 1 from public\.accounts p where p\.society_id = s\.society_id and p\.id = v\."parentId"\)/.test(up), 'only where the parent group exists');
ok(/0, v\."openingBalanceType"/.test(up), 'opening balance is always 0');
ok(!/ledger_events|voucher_lines|voucher_entries|\bvouchers\b/.test(up), 'touches no voucher or journal table');
ok(!/'2201'|'3310'/.test(up), 'does not mention the combined ledgers at all');
ok(!/create\s+(temp|temporary)\s+table/i.test(up), 'no temp tables');
ok(!/\b(insert|update|delete|drop|create|alter)\b/i.test(prev), 'preview is read-only');
ok(/not exists \(select 1 from public\.voucher_lines/.test(down) && /coalesce\(a\."openingBalance", 0\) = 0/.test(down), 'down keeps any account that is posted to or has an opening');

const add = S.ACCOUNTS_TO_ADD_156;
const ids = add.map((a) => a.id);
ok(JSON.stringify(ids) === JSON.stringify(['2291', '2292', '2293', '3391', '3392', '3393']), 'the six head-wise ledgers, and nothing else');
ok(JSON.stringify(ids) === JSON.stringify([...Object.values(G.GST_HEAD_ID.output), ...Object.values(G.GST_HEAD_ID.input)]), 'the same codes the posting rule uses (gstLedgers.GST_HEAD_ID)');
ok(add.slice(0, 3).every((a) => a.type === 'liability' && a.openingBalanceType === 'credit' && a.parentId === '2200' && a.subtype === 'statutory_liability'), 'output heads: credit-nature statutory liabilities under 2200 (beside 2201)');
ok(add.slice(3).every((a) => a.type === 'asset' && a.openingBalanceType === 'debit' && a.parentId === '3300' && a.subtype === 'current_asset'), 'input heads: debit-nature current assets under 3300 (beside 3310)');
ok(add.every((a) => !a.isGroup && !a.isSystem && a.openingBalance === 0), 'plain ledgers with no opening');
ok(add.every((a) => ![...S.ACCOUNTS_TO_ADD, ...S.ACCOUNTS_TO_ADD_115, ...S.ACCOUNTS_TO_ADD_154].some((x) => x.id === a.id || x.name === a.name)), 'no overlap with the 114 / 115 / 154 lists');

// The role catalog must read each new head as its head-wise role, and never as a combined (legacy) one.
const role = (r) => R.ROLE_CATALOG.find((x) => x.role === r);
for (const [side, heads] of Object.entries(G.GST_HEAD_ID)) for (const [head, id] of Object.entries(heads)) {
  const a = add.find((x) => x.id === id);
  ok(role(`gst.${side}.${head}`).match.test(a.name), `${a.name}: matches role gst.${side}.${head}`);
  ok(!role('gst.output.combined').match.test(a.name) && !role('gst.output.combined').match.test(a.nameHi)
    && !role('gst.input.combined').match.test(a.name) && !role('gst.input.combined').match.test(a.nameHi), `${a.name}: never mistaken for a combined GST ledger`);
  ok(!role('gst.rcm.payable').match.test(a.name), `${a.name}: never mistaken for the reverse-charge head`);
  ok(G.gstHeadAccountId(side, head, add) === id, `${a.name}: the posting rule resolves it`);
}

const TYPES = ['marketing_processing', 'pacs', 'consumer', 'dairy', 'housing', 'sugar', 'transport'];
for (const t of TYPES) {
  const tpl = S.SOCIETY_TEMPLATES[t];
  const chart = S.fullChartForType(t);
  const byId = new Map(chart.map((a) => [a.id, a]));
  ok(new Set(chart.map((a) => a.id)).size === chart.length, `${t}: no duplicate ids`);
  ok(tpl.every((a) => !ids.includes(a.id)), `${t}: the template itself does not use a new code`);
  ok(ids.every((id) => byId.has(id)), `${t}: seeded with all six heads`);
  ok(add.every((a) => byId.get(a.parentId)?.isGroup), `${t}: each new head hangs under an existing group`);
  ok(byId.has('2201') && byId.get('2201').name === 'GST Payable', `${t}: the combined GST Payable is still there, unrenamed`);
  // Additive only: every account the chart had before is still there, unchanged.
  const before = S.migrateAccounts(tpl.map((a) => ({ ...a }))).accounts.filter((a) => !ids.includes(a.id));
  ok(JSON.stringify(before) === JSON.stringify(chart.filter((a) => !ids.includes(a.id))), `${t}: no existing account renamed, retyped or moved`);
  ok(tpl.every((a) => byId.get(a.id)?.type === a.type), `${t}: every template account keeps its id and type`);
}
const once = S.fullChartForType('marketing_processing');
ok(S.migrateAccounts(once.map((a) => ({ ...a }))).newlyAdded.length === 0, 'second pass adds nothing');
// A society that already made its own account at one of the codes keeps it.
const own = S.migrateAccounts([{ id: '2291', name: 'Staff Welfare Payable', nameHi: '', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false }]).accounts;
ok(own.filter((a) => a.id === '2291').length === 1 && own.find((a) => a.id === '2291').name === 'Staff Welfare Payable', "a society's own account at a new code is left alone");

console.log(`Migration 156: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
