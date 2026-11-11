// Migration 157 (PACS only: the heads NABARD's Common Accounting System names). The SQL is GENERATED from
// ACCOUNTS_TO_ADD_157 (scripts/gen-migration-157.mjs); this test fails if a committed file drifts from it, and
// pins: PACS charts only, additive only, the CAS statements place each head on its CAS line, and a PACS books a
// disposal gain to Capital Reserve while every other chart keeps 4410.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildFiles, valuesBlock } = await import('./gen-migration-157.mjs');
const S = await import(new URL('../src/lib/storage.ts', import.meta.url).href);
const D = await import(new URL('../src/lib/assetDisposal.ts', import.meta.url).href);
const C = await import(new URL('../src/lib/cas/pacsCas.ts', import.meta.url).href);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const strip = (s) => s.replace(/--.*$/gm, '');

const gen = buildFiles();
for (const [f, text] of Object.entries(gen)) {
  const onDisk = readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  ok(onDisk === text, `${f} is up to date (run: node scripts/gen-migration-157.mjs)`);
}
const up = strip(gen['supabase/migrations/157_pacs_cas_heads.sql']);
const prev = strip(gen['supabase/diagnostics/preview_157_pacs_cas_heads.sql']);
const down = strip(gen['supabase/migrations/157_pacs_cas_heads_down.sql']);

// ── SQL shape ────────────────────────────────────────────────────────────────────────────────────────────────
ok(valuesBlock().split('\n').length === S.ACCOUNTS_TO_ADD_157.length, 'every ACCOUNTS_TO_ADD_157 row is in the VALUES list');
ok((up.match(/insert into public\.accounts/g) || []).length === 1 && /on conflict do nothing/.test(up), 'one insert, "on conflict do nothing"');
ok(!/\b(update|delete|truncate|drop|alter)\b/i.test(up.replace(/'[^']*'/g, '')), 'never updates, deletes, drops or alters anything');
ok(/a\.id = v\.id\)/.test(up) && /a\.code = v\.id\)/.test(up), 'skips an id the society has, and a code another account already shows');
ok(/lower\(trim\(a\.name\)\) = lower\(trim\(v\.name\)\) and a\.type = v\.type/.test(up), 'skips a same name + type');
ok(/n\.id = v\.needs_id and lower\(trim\(n\.name\)\) = lower\(trim\(v\.needs_name\)\)/.test(up), 'only where the PACS marker head exists (same id and name)');
ok(valuesBlock().split('\n').every((l) => /'4303', 'Govt Subsidy \/ NABARD Grant', \d+\)/.test(l)), 'every row carries the PACS marker — none is added to a non-PACS chart');
ok(/p\.id = v\."parentId"\)/.test(up), 'only where the parent group exists');
ok(!/ledger_events|voucher_lines|\bvouchers\b/.test(up) && !/create\s+(temp|temporary)\s+table/i.test(up), 'touches no voucher or journal table; no temp tables');
ok(!/\b(insert|update|delete|drop|create|alter)\b/i.test(prev), 'preview is read-only');
ok(/not exists \(select 1 from public\.voucher_lines/.test(down) && /coalesce\(a\."openingBalance", 0\) = 0/.test(down), 'down keeps any account that is posted to or has an opening');

// ── Charts ───────────────────────────────────────────────────────────────────────────────────────────────────
const add = S.ACCOUNTS_TO_ADD_157;
const ids = add.map((a) => a.id);
ok(ids.join() === '1297,1298,2194,2195,2199,5498', 'the six PACS heads, and nothing else');
ok(Object.keys(S.ACCOUNTS_TO_ADD_157_REQUIRES).sort().join() === ids.join() && Object.values(S.ACCOUNTS_TO_ADD_157_REQUIRES).every((n) => n.id === '4303' && n.name === 'Govt Subsidy / NABARD Grant'), 'every head carries the PACS marker condition');
ok(add.every((a) => !a.isGroup && !a.isSystem && a.openingBalance === 0), 'plain ledgers with no opening');
ok(add.every((a) => ![...S.ACCOUNTS_TO_ADD, ...S.ACCOUNTS_TO_ADD_115, ...S.ACCOUNTS_TO_ADD_154, ...S.ACCOUNTS_TO_ADD_155, ...S.ACCOUNTS_TO_ADD_156].some((x) => x.id === a.id)), 'no overlap with the earlier lists');
// Name-based resolvers must not mistake a new head for another account (the 154 lesson).
ok(!add.some((a) => /bonus payable|^gst payable|sundry|msp |tds payable|salary payable|dividend payable/i.test(a.name)), 'no new head matches a role / domain name hint');

const TYPES = ['marketing_processing', 'pacs', 'consumer', 'dairy', 'housing', 'sugar', 'transport'];
for (const t of TYPES) {
  const tpl = S.SOCIETY_TEMPLATES[t];
  const chart = S.fullChartForType(t);
  const byId = new Map(chart.map((a) => [a.id, a]));
  ok(new Set(chart.map((a) => a.id)).size === chart.length, `${t}: no duplicate ids`);
  ok(tpl.every((a) => !ids.includes(a.id)), `${t}: the template does not use a new code`);
  if (t === 'pacs') {
    ok(ids.every((id) => byId.has(id)), 'pacs: seeded with all six heads');
    ok(add.every((a) => byId.get(a.parentId)?.isGroup), 'pacs: each new head hangs under an existing group');
  } else {
    ok(!ids.some((id) => byId.has(id)), `${t}: gets none of the PACS heads`);
  }
  const before = chart.filter((a) => !ids.includes(a.id));
  const without = S.migrateAccounts(tpl.map((a) => ({ ...a }))).accounts.filter((a) => !ids.includes(a.id));
  ok(JSON.stringify(before) === JSON.stringify(without), `${t}: no existing account renamed, retyped or moved`);
}
const pacs = S.fullChartForType('pacs');
ok(S.migrateAccounts(pacs.map((a) => ({ ...a }))).newlyAdded.length === 0, 'second pass adds nothing');

// ── Disposal gain: PACS → Capital Reserve, everyone else → 4410 ──────────────────────────────────────────────
ok(D.disposalGainAccountId(pacs) === '1298', 'pacs: a disposal gain is credited to 1298 Capital Reserve');
for (const t of TYPES.filter((x) => x !== 'pacs')) ok(D.disposalGainAccountId(S.fullChartForType(t)) === '4410', `${t}: a disposal gain stays in 4410`);
ok(D.disposalGainAccountId([{ id: '1298', name: 'Some Other Reserve', type: 'equity' }]) === '4410', 'a 1298 with another name does not count');
ok(D.disposalGainAccountId([{ id: '1298', name: 'Capital Reserve', type: 'equity', isGroup: true }]) === '4410', 'a group is never a posting target');
const gain = D.assetDisposalPosting({ category: 'Vehicle', cost: 100000, accumDep: 60000, saleProceeds: 55000, cashBankAccount: '3301', gainAccount: D.disposalGainAccountId(pacs) });
const dr = gain.lines.filter((l) => l.type === 'Dr').reduce((s, l) => s + l.amount, 0), cr = gain.lines.filter((l) => l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
ok(gain.gainLoss === 15000 && gain.lines.some((l) => l.accountId === '1298' && l.type === 'Cr' && l.amount === 15000) && !gain.lines.some((l) => l.accountId === '4410'), 'pacs gain posting credits Capital Reserve, not income');
ok(dr === cr, 'pacs gain posting balances');
const loss = D.assetDisposalPosting({ category: 'Vehicle', cost: 100000, accumDep: 60000, saleProceeds: 30000, cashBankAccount: '3301', gainAccount: '1298' });
ok(loss.lines.some((l) => l.accountId === '5406' && l.type === 'Dr' && l.amount === 10000) && !loss.lines.some((l) => l.accountId === '1298'), 'a loss is still an expense (5406)');
const plain = D.assetDisposalPosting({ category: 'Vehicle', cost: 100000, accumDep: 60000, saleProceeds: 55000, cashBankAccount: '3301' });
ok(plain.lines.some((l) => l.accountId === '4410' && l.type === 'Cr'), 'without a gain account the posting is unchanged (4410)');

// ── CAS statements: each head lands on its CAS line ──────────────────────────────────────────────────────────
const acc = (id) => pacs.find((a) => a.id === id);
const bal = (id, net) => ({ account: acc(id), openingDebit: 0, openingCredit: 0, transactionDebit: 0, transactionCredit: 0, netBalance: net });
const bs = C.buildCasBalanceSheet({
  capLiabLeaves: [bal('1102', -100000), bal('1298', -15000), bal('1297', -20000), bal('2199', -5000), bal('2195', -1000), bal('2194', -4000), bal('2197', -700), bal('2198', -300)],
  assetLeaves: [bal('3303', 80000), bal('3301', 66000)],
  unpostedStock: 0, netProfit: 0, overdueInterestReceivable: 0,
});
const row = (side, id) => bs[side].flatMap((s) => s.rows).find((r) => r.id === id);
ok(row('liabilities', 'L2ii').amount === 15000, 'CAS BS: Capital Reserve at L2 ii');
ok(row('liabilities', 'L4iv').amount === 20000 && row('liabilities', 'L4v').amount === 5000, 'CAS BS: subsidies at L4 iv / v');
ok(row('liabilities', 'L10ii').amount === 1000, 'CAS BS: Provision for Standard Assets at L10 ii');
ok(row('liabilities', 'L10i').amount === 1000, 'CAS BS: gratuity + bonus provisions at L10 i');
ok(row('assets', 'A5b').amount === -4000, 'CAS BS: Provision for NPAs is "Less:" under Loans and Advances');
ok(!bs.liabilities.flatMap((s) => s.rows).some((r) => r.heads.some((h) => h.id === '2194')), 'CAS BS: the NPA provision is not on the liability side');
ok(bs.totalLiabilities === bs.totalAssets && bs.totalAssets === 142000, 'CAS BS balances with the provision netted (both sides 1,42,000)');
const pl = C.buildCasProfitLoss([bal('5498', 5000), bal('4408', -9000)], { hasTrading: false, grossProfit: 0 });
ok(pl.expenditure.flatMap((s) => s.rows).find((r) => r.id === 'E15').amount === 5000, 'CAS P&L: loan loss provisions at item 15');

console.log(`Migration 157: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
