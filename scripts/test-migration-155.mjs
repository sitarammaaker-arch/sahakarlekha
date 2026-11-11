// Migration 155 (chart corrections from the 2026-11-11 comparison with the official texts). The SQL is GENERATED
// from ACCOUNTS_TO_ADD_155 + CHART_CORRECTIONS_155 (scripts/gen-migration-155.mjs); this test fails if a committed
// file drifts from it, and pins the safety shape and what the charts now hold.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildFiles, valuesBlock } = await import('./gen-migration-155.mjs');
const S = await import(new URL('../src/lib/storage.ts', import.meta.url).href).catch(() => null);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const strip = (s) => s.replace(/--.*$/gm, '');

const gen = buildFiles();
for (const [f, text] of Object.entries(gen)) {
  const onDisk = readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  ok(onDisk === text, `${f} is up to date (run: node scripts/gen-migration-155.mjs)`);
}
const up = strip(gen['supabase/migrations/155_chart_fact_corrections.sql']);
const prev = strip(gen['supabase/diagnostics/preview_155_chart_fact_corrections.sql']);
const down = strip(gen['supabase/migrations/155_chart_fact_corrections_down.sql']);
const noStrings = (s) => s.replace(/'[^']*'/g, "''");

// ── SQL shape ────────────────────────────────────────────────────────────────────────────────────────────────
ok(S && valuesBlock().split('\n').length === S.ACCOUNTS_TO_ADD_155.length, 'every ACCOUNTS_TO_ADD_155 row is in the VALUES list');
ok(!/create\s+(temp|temporary)\s+table/i.test(up), 'no temp tables');
ok(!/ledger_events|\binsert into public\.voucher|\bupdate public\.voucher|\bdelete from public\.voucher/.test(up), 'writes to no voucher or journal table');
ok(!/"openingBalance"\s*=/.test(up.replace(/coalesce\(a\."openingBalance", 0\) (=|<>) 0/g, '')), 'never sets an opening balance');
ok(!/\b(truncate|drop)\b/i.test(noStrings(up)), 'no truncate / drop');
const updates = up.match(/update public\.accounts a[\s\S]*?;/g) || [];
const deletes = up.match(/delete from public\.accounts a[\s\S]*?;/g) || [];
const logs = up.match(/insert into public\.account_reclass_log[\s\S]*?;/g) || [];
ok(updates.length === 1 && deletes.length === 2, 'exactly one reclassification and two removals');
ok(logs.length === 3, 'every reclassification and removal logs the old row first');
ok(up.indexOf('account_reclass_log (migration') < up.indexOf('update public.accounts a'), 'the log insert comes before the first change');
ok(updates.every((u) => /set type = /.test(u) && !/"openingBalance" =/.test(u) && /a\.id = '\d{4}' and a\.name = '[^']+' and a\.type = '[a-z]+'/.test(u)), 'each update is tied to one id + name + type and changes classification only');
ok(deletes.every((d) => /a\.id = '\d{4}' and a\.name = '[^']+' and a\.type = 'income'/.test(d)
  && /coalesce\(a\."openingBalance", 0\) = 0/.test(d) && /not exists \(select 1 from public\.voucher_lines/.test(d) && /not exists \(select 1 from public\.voucher_entries/.test(d)
  && /public\.account_roles/.test(d) && /public\.procurement_deduction_rules/.test(d) && /public\.stock_items/.test(d) && /c\."parentId" = a\.id/.test(d)),
  'a head is removed only when it has no opening, no posting, no role, no record pointing at it and no child');
ok(/raise exception '155:/.test(up) && /a\.id = '5311'[^)]*\)\) and coalesce\(a\."openingBalance", 0\) <> 0/.test(up), 'aborts if a 5311 row carries an opening balance');
// The log predicate and the change predicate of each pair are the same text, so exactly the logged rows change.
const whereOf = (s) => s.slice(s.indexOf(' where ') + 7).replace(/;\s*$/, '').trim();
ok([...updates, ...deletes].every((c) => logs.some((l) => whereOf(l) === whereOf(c))), 'each change uses the same WHERE as its log insert');
ok(!/\b(insert|update|delete|drop|create|alter)\b/i.test(noStrings(prev)), 'preview is read-only');
ok(/'keep \(in use\)'/.test(prev), 'preview lists the heads that stay because they are in use');
ok(/jsonb_populate_record\(null::public\.accounts, l\.old_row\)/.test(down) && /l\.migration = '155'/.test(down), 'down restores removed and reclassified rows from the log');

// ── What the app now shows ───────────────────────────────────────────────────────────────────────────────────
if (S) {
  const TYPES = ['marketing_processing', 'pacs', 'consumer', 'dairy', 'housing', 'sugar', 'transport'];
  const C = S.CHART_CORRECTIONS_155;
  for (const t of TYPES) {
    const chart = S.fullChartForType(t);
    const byId = new Map(chart.map((a) => [a.id, a]));
    ok(new Set(chart.map((a) => a.id)).size === chart.length, `${t}: no duplicate ids`);
    ok(chart.every((a) => !a.parentId || byId.get(a.parentId)?.isGroup), `${t}: every account hangs under an existing group`);
    ok(byId.has('2295') && byId.has('5299'), `${t}: has the Labour Welfare Fund payable and contribution heads`);
    ok(!chart.some((a) => a.type === 'income' && (a.name === 'Market Fee' || a.name === 'HRDF')), `${t}: no Market Fee / HRDF income head`);
    const edu = chart.find((a) => a.id === '5311');
    ok(edu && edu.type === 'equity' && edu.parentId === '1200' && edu.openingBalanceType === 'debit' && /Appropriation/.test(edu.name), `${t}: 5311 is an appropriation under 1200, not an expense`);
    ok(!chart.some((a) => a.type === 'expense' && /education fund/i.test(a.name)), `${t}: no education-fund expense head`);
    ok(chart.some((a) => a.id === '1203' && a.type === 'equity'), `${t}: 1203 Education Fund still there`);
  }
  for (const t of ['marketing_processing', 'transport']) {
    const chart = S.fullChartForType(t);
    ok(chart.some((a) => a.id === '2296' && a.name === 'Market Fee Payable' && a.type === 'liability'), `${t}: Market Fee Payable is in the chart without the old income head`);
    ok(chart.some((a) => a.id === '2205' && a.name === 'HRDF Payable'), `${t}: HRDF Payable is in the chart`);
    ok(!chart.some((a) => a.id === '4202' || a.id === '4204'), `${t}: codes 4202 / 4204 are free`);
  }
  const housing = S.fullChartForType('housing');
  // Housing fund heads are deliberately unchanged: the only texts read were another State's, and one code (4105)
  // must keep one type across charts (test:template-integrity id-type).
  ok(housing.some((a) => a.id === '4105' && a.name === 'Sinking Fund Contribution' && a.type === 'income'), 'housing: 4105 Sinking Fund Contribution unchanged');
  ok(housing.some((a) => a.id === '4201' && a.type === 'income') && housing.some((a) => a.id === '4407' && a.type === 'income'), 'housing: Transfer Fee and Admission Fee are unchanged (sources conflict)');
  // Other charts' 4105 is a sales head and must stay one.
  ok(S.fullChartForType('marketing_processing').some((a) => a.id === '4105' && a.name === 'Animal Feed Sales' && a.type === 'income'), 'marketing: 4105 Animal Feed Sales untouched');

  // The reclass definitions equal what the app applies.
  const r5311 = C.reclass.find((r) => r.id === '5311');
  const app5311 = S.fullChartForType('pacs').find((a) => a.id === '5311');
  ok(['type', 'parentId', 'subtype', 'openingBalanceType', 'name', 'nameHi'].every((k) => r5311.to[k] === app5311[k]), '5311: the SQL target equals the app patch');
  ok(C.reclass.length === 1 && r5311.onlyIfUnused === false, 'only 5311 is reclassified, following the app patch');

  // An EXISTING society (chart as the database held it before 155): the patch reclassifies 5311 on load, a used
  // 4202 stays as it is, and a chart that reuses 5311 for another head is left alone.
  const old = [
    { id: '5000', name: 'Expenses', nameHi: '', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: true },
    { id: '5300', name: 'Admin Expenses', nameHi: '', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: true, parentId: '5000' },
    { id: '5311', name: 'Education Fund Contribution', nameHi: '', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5300', subtype: 'admin_expense' },
    { id: '4202', name: 'Market Fee', nameHi: '', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4200' },
  ];
  const after = S.migrateAccounts(old.map((a) => ({ ...a }))).accounts;
  ok(after.find((a) => a.id === '5311').type === 'equity', 'existing society: 5311 shows as an appropriation on load');
  ok(after.find((a) => a.id === '4202').type === 'income', 'existing society: a 4202 it still has is not touched by the app');
  const reused = S.migrateAccounts([{ ...old[2], name: 'Some Other Expense' }]).accounts.find((a) => a.id === '5311');
  ok(reused.type === 'expense' && reused.name === 'Some Other Expense', 'a 5311 with another name is not patched');
  const twice = S.fullChartForType('marketing_processing');
  ok(S.migrateAccounts(twice.map((a) => ({ ...a }))).newlyAdded.length === 0, 'second pass adds nothing');
  ok(S.ACCOUNTS_TO_ADD_155.every((a) => ![...S.ACCOUNTS_TO_ADD, ...S.ACCOUNTS_TO_ADD_115, ...S.ACCOUNTS_TO_ADD_154].some((x) => x.id === a.id)), 'no overlap with the 114 / 115 / 154 lists (all already ran)');
}

console.log(`Migration 155: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
