// Duplicate ledger names (2026-11-12 chart audit, F-01 / F-02 / F-23), in two halves:
//   1. the importers never guess between two ledgers of one name (lib/importAccountMatch);
//   2. the standard charts no longer ship such names (ACCOUNT_RENAMES_163), and migration 163 — GENERATED from
//      that list by scripts/gen-migration-163.mjs — renames them for existing societies, name only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { buildFiles, valuesBlock } = await import('./gen-migration-163.mjs');   // registers the '@/…' loader
const imp = (p) => import(new URL('../src/' + p, import.meta.url).href);
const S = await imp('lib/storage.ts');
const M = await imp('lib/importAccountMatch.ts');
const T = await imp('lib/importTemplates.ts');
const O = await imp('lib/openingBalances.ts');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const strip = (s) => s.replace(/--.*$/gm, '');
const src = (p) => readFileSync(path.join(ROOT, 'src', p), 'utf8');

// ── 1. The match rule ────────────────────────────────────────────────────────────────────────────────────────
const A = (id, name, type, extra = {}) => ({ id, name, nameHi: '', type, openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, ...extra });
// A chart as an OLD society still has it in the database: duplicate names present.
const old = [
  A('3100', 'Fixed Assets', 'asset', { isGroup: true }),
  A('3102', 'Building', 'asset'), A('5501', 'Building', 'expense'),
  A('4401', 'Rent', 'income'), A('5308', 'Rent', 'expense'),
  A('3301', 'Cash in Hand', 'asset'), A('1102', 'Individual Share Capital', 'equity'),
  A('uuid-1', 'Kisan Traders', 'liability', { code: '2101-07' }),
];
const m = (t) => M.matchImportAccount(t, old);
ok(m('Cash in Hand').status === 'ok' && m('Cash in Hand').account.id === '3301', 'a name one ledger carries resolves');
ok(m('  cash IN hand ').status === 'ok', 'case and surrounding spaces are ignored');
ok(m('Building').status === 'ambiguous' && m('Building').candidates.map((a) => a.id).join() === '3102,5501', 'a name two ledgers carry is AMBIGUOUS, with both candidates');
ok(m('3102').status === 'ok' && m('3102').account.type === 'asset' && m('5501').account.type === 'expense', 'the code picks the one meant');
ok(m('2101-07').status === 'ok' && m('2101-07').account.id === 'uuid-1', 'a readable code of a UUID-keyed account works');
ok(m('Fixed Assets').status === 'group' && m('3100').status === 'group', 'a group is never a posting target, by name or by code');
ok(m('No Such Head').status === 'missing' && m('').status === 'missing' && m(undefined).status === 'missing', 'unknown / empty → missing');
ok(M.candidateList(m('Rent').candidates) === '4401 (income), 5308 (expense)', 'the refusal names the codes and types');

// Opening-balance import: preview refuses, commit refuses — and the old "last one wins" is gone.
const obErr = (name) => T.validateObRow({ account_name: name, opening_balance: '100000', balance_type: 'Debit' }, old, 2);
ok(obErr('Building').length === 1 && /कोड लिखें: 3102 \(asset\), 5501 \(expense\)/.test(obErr('Building')[0].message), 'opening preview: an ambiguous name is an error that lists the codes');
ok(obErr('3102').length === 0 && obErr('Cash in Hand').length === 0, 'opening preview: a code or a unique name passes');
ok(obErr('Fixed Assets').length === 1 && /समूह/.test(obErr('Fixed Assets')[0].message), 'opening preview: a group is still refused');
ok(obErr('Nope').length === 1 && /नहीं मिला/.test(obErr('Nope')[0].message), 'opening preview: unknown is still refused');
const mapped = O.mapImportedOpenings([
  { account_name: 'Building', opening_balance: '100000', balance_type: 'debit' },
  { account_name: '3102', opening_balance: '100000', balance_type: 'debit' },
  { account_name: 'Cash in Hand', opening_balance: '500', balance_type: 'debit' },
], old);
ok(mapped.unmatched.join() === 'Building', 'opening commit: the ambiguous row is returned unmatched');
ok(mapped.entries.map((e) => e.accountId).join() === '3102,3301' && !mapped.entries.some((e) => e.accountId === '5501'), 'opening commit: nothing lands on the depreciation head');

// Bulk voucher import.
const vErr = (dr, cr) => T.validateVoucherRow({ date: '2026-05-01', type: 'payment', debit_account: dr, credit_account: cr, amount: '500' }, old, '2026-04-01', '2027-03-31', 2);
ok(vErr('Rent', 'Cash in Hand').some((e) => e.field === 'debit_account' && /कोड लिखें: 4401 \(income\), 5308 \(expense\)/.test(e.message)), 'voucher preview: "Rent" is refused with the two codes');
ok(vErr('5308', 'Cash in Hand').length === 0, 'voucher preview: the code passes');
ok(vErr('5308', '5308').some((e) => /एक ही नहीं/.test(e.message)) && vErr('3301', 'Cash in Hand').some((e) => /एक ही नहीं/.test(e.message)), 'voucher preview: same ledger on both sides is caught even when one is a code');
const ui = src('pages/UniversalImporter.tsx');
ok(/matchImportAccount\(row\.data\.debit_account, accounts\)/.test(ui) && /matchImportAccount\(row\.data\.credit_account, accounts\)/.test(ui)
  && !/accounts\.find\(a => !a\.isGroup && a\.name\.toLowerCase\(\)\.trim\(\) === row\.data\./.test(ui), 'voucher commit uses the same rule, no first-match lookup left');

// ── 2. The charts and the rename ─────────────────────────────────────────────────────────────────────────────
const TYPES = ['marketing_processing', 'pacs', 'consumer', 'dairy', 'housing', 'sugar', 'transport'];
for (const t of TYPES) {
  const chart = S.fullChartForType(t);
  const seen = new Map();
  for (const a of chart.filter((x) => !x.isGroup)) { const k = a.name.trim().toLowerCase(); seen.set(k, (seen.get(k) || 0) + 1); }
  const dups = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  ok(dups.length === 0, `${t}: no two ledgers share a name${dups.length ? ' — ' + dups.join(', ') : ''}`);
  ok(chart.every((a) => M.matchImportAccount(a.name, chart).status !== 'ambiguous'), `${t}: every ledger can be imported by its name`);
}
const R = S.ACCOUNT_RENAMES_163;
ok(R.length === 10 && new Set(R.map((r) => r.id)).size === 10, 'ten renames, one per id');
ok(R.every((r) => r.type === 'expense' || r.type === 'income'), 'only expense / income heads are renamed — the asset keeps its name');
// An existing society: old names in, new names out; nothing else about the account moves.
const cmsOld = S.SOCIETY_TEMPLATES.marketing_processing.map((a) => { const r = R.find((x) => x.id === a.id && x.to === a.name); return r ? { ...a, name: r.from } : { ...a }; });
ok(cmsOld.filter((a) => R.some((r) => r.id === a.id && r.from === a.name)).length === 10, 'fixture: the marketing template carries all ten heads under their old names');
const cmsNew = S.migrateAccounts(cmsOld.map((a) => ({ ...a }))).accounts;
for (const r of R) {
  const before = cmsOld.find((a) => a.id === r.id) ?? S.ACCOUNTS_TO_ADD.find((a) => a.id === r.id);
  const after = cmsNew.find((a) => a.id === r.id);
  const { name: _n1, ...b } = before; const { name: _n2, ...c } = after;
  ok(after.name === r.to && JSON.stringify(b) === JSON.stringify(c), `${r.id}: "${r.from}" → "${r.to}", and only the name changed`);
}
ok(cmsNew.find((a) => a.id === '3102').name === 'Building' && cmsNew.find((a) => a.id === '3104').name === 'Vehicle', 'the assets keep their names');
// A chart that uses one of these codes for another head is left alone (housing 4402 = Interest on Defaulters).
const housing = S.fullChartForType('housing');
ok(housing.find((a) => a.id === '4402').name === 'Interest on Defaulters' && housing.find((a) => a.id === '5502').name === 'Dep. - Lift', 'a code with another name is not renamed');
// Never create a duplicate: a society that already made its own "Rent Expense" keeps its 5308 "Rent".
const own = S.migrateAccounts([...old.map((a) => ({ ...a })), A('x9', 'Rent Expense', 'expense')]).accounts;
ok(own.find((a) => a.id === '5308').name === 'Rent' && own.find((a) => a.id === '4401').name === 'Rent Income', 'the rename is skipped where the new name is already taken, applied where it is free');
ok(S.migrateAccounts(cmsNew.map((a) => ({ ...a }))).accounts.every((a, i) => a.name === cmsNew[i].name), 'second pass changes nothing');

// ── Migration SQL ────────────────────────────────────────────────────────────────────────────────────────────
const gen = buildFiles();
for (const [f, text] of Object.entries(gen)) {
  const onDisk = readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  ok(onDisk === text, `${f} is up to date (run: node scripts/gen-migration-163.mjs)`);
}
const up = strip(gen['supabase/migrations/163_rename_duplicate_named_heads.sql']);
const prev = strip(gen['supabase/diagnostics/preview_163_rename_duplicate_named_heads.sql']);
const down = strip(gen['supabase/migrations/163_rename_duplicate_named_heads_down.sql']);
ok(valuesBlock().split('\n').length === R.length, 'every rename is in the VALUES list');
const upd = up.match(/update public\.accounts a[\s\S]*?;/g) || [];
ok(upd.length === 1 && /^update public\.accounts a\s+set name = v\.new_name\s+from/.test(upd[0]), 'one update, and it sets the NAME only');
ok(!/\b(delete|truncate|drop)\b/i.test(up.replace(/'[^']*'/g, "''")) && !/insert into public\.accounts/.test(up), 'deletes and adds no account');
ok(/a\.id = v\.id and trim\(a\.name\) = v\.old_name and a\.type = v\.type/.test(upd[0]), 'only a row that still has the old name and type');
ok(/not exists \(select 1 from public\.accounts o[\s\S]*lower\(trim\(o\.name\)\) = lower\(v\.new_name\)\)/.test(upd[0]), 'never where another ledger of that type already has the new name');
ok(up.indexOf('insert into public.account_reclass_log') < up.indexOf('update public.accounts a') && /to_jsonb\(a\)/.test(up), 'the old row is logged before the change');
ok(!/ledger_events|voucher_lines|\bvouchers\b/.test(up) && !/create\s+(temp|temporary)\s+table/i.test(up), 'touches no voucher or journal table; no temp tables');
ok(!/\b(insert|update|delete|drop|create|alter)\b/i.test(prev.replace(/'[^']*'/g, "''")), 'preview is read-only');
ok(/set name = l\.old_row->>'name'/.test(down) && /l\.migration = '163'/.test(down), 'down restores the old name from the log');

console.log(`Duplicate names + migration 163: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
