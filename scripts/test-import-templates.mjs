// Universal Importer — the four download templates and their validators, proven against the six REAL charts a new society receives.
//   1. an example row left in by mistake is REFUSED (never silently imported)
//   2. the same example rows, once the "(उदाहरण)" marker is removed, are VALID against every real chart (so they teach the right names)
//   3. an opening balance can never go on a GROUP account (the Opening Balances page already refuses it — the importer did not)
//   4. the example account names never duplicate a standard account
//   5. the voucher template's example dates fall inside the society's CURRENT financial year
//   6. the page uses the library (no stale copy left in it)
//
// Run: node scripts/test-import-templates.mjs   (npm run test:import-templates)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));

let S, L, O;
try { S = await import(abs('../src/lib/storage.ts')); L = await import(abs('../src/lib/importTemplates.ts')); O = await import(abs('../src/lib/openingBalances.ts')); }
catch (e) { console.error('import failed:', e.message); process.exit(1); }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗ FAIL:', m); } };

const TYPES = ['marketing_processing', 'pacs', 'consumer', 'dairy', 'housing', 'sugar'];
const chartOf = (t) => S.migrateAccounts(S.SOCIETY_TEMPLATES[t].map((a) => ({ ...a }))).accounts;
const MARK = '(उदाहरण) ';
const FY_START = '2026-04-01', FY_END = '2027-03-31';

// parse a template the way the page does: row 0 = headers, row 1 = hints, the rest = data rows
function rowsOf(csv) {
  const parsed = L.parseCSV(csv);
  const headers = parsed[0].map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
  return parsed.slice(2).map((cells, i) => ({ rowNum: i + 3, row: Object.fromEntries(headers.map((h, ix) => [h, (cells[ix] || '').trim()])) }));
}
const unmark = (row, field) => ({ ...row, [field]: row[field].replace(MARK, '') });

const T = {
  accounts: { csv: L.ACCOUNTS_TEMPLATE, field: 'account_name' },
  members: { csv: L.MEMBERS_TEMPLATE, field: 'member_id' },
  opening: { csv: L.OPENING_BALANCES_TEMPLATE, field: 'account_name' },
  vouchers: { csv: L.vouchersTemplate(FY_START), field: 'date' },
};

console.log('\n1. an example row left in by mistake is refused');
for (const chartType of ['marketing_processing', 'housing']) {
  const chart = chartOf(chartType);
  const run = (name, row, n) => ({
    accounts: () => L.validateAccountRow(row, n),
    members: () => L.validateMemberRow(row, n),
    opening: () => L.validateObRow(row, chart, n),
    vouchers: () => L.validateVoucherRow(row, chart, FY_START, FY_END, n),
  })[name]();
  for (const [name, t] of Object.entries(T)) {
    const rows = rowsOf(t.csv);
    ok(rows.length >= 2 && rows.every((r) => r.row[t.field].startsWith(MARK)), `${name}: ${rows.length} example rows, each marked "${MARK.trim()}"`);
    ok(rows.every((r) => run(name, r.row, r.rowNum).length > 0), `${name} (${chartType} chart): every example row left in is REFUSED, none is imported`);
  }
}

console.log('\n2. un-marked, the examples are valid against EVERY real chart');
for (const chartType of TYPES) {
  const chart = chartOf(chartType);
  const bad = [];
  for (const { rowNum, row } of rowsOf(T.accounts.csv)) { const e = L.validateAccountRow(unmark(row, 'account_name'), rowNum); if (e.length) bad.push('accounts r' + rowNum + ': ' + e[0].message); }
  for (const { rowNum, row } of rowsOf(T.members.csv)) { const e = L.validateMemberRow(unmark(row, 'member_id'), rowNum); if (e.length) bad.push('members r' + rowNum + ': ' + e[0].message); }
  for (const { rowNum, row } of rowsOf(T.opening.csv)) { const e = L.validateObRow(unmark(row, 'account_name'), chart, rowNum); if (e.length) bad.push('opening r' + rowNum + ': ' + e[0].message); }
  for (const { rowNum, row } of rowsOf(T.vouchers.csv)) { const e = L.validateVoucherRow(unmark(row, 'date'), chart, FY_START, FY_END, rowNum); if (e.length) bad.push('vouchers r' + rowNum + ': ' + e[0].message); }
  ok(bad.length === 0, `${chartType}: all example rows of all four templates validate${bad.length ? ' — ' + bad.join(' | ') : ''}`);
}

console.log('\n3. an opening balance can never go on a GROUP account');
for (const chartType of TYPES) {
  const chart = chartOf(chartType);
  const grp = L.validateObRow({ account_name: 'Share Capital', opening_balance: '500000', balance_type: 'Credit' }, chart, 3);
  const leaf = L.validateObRow({ account_name: 'Individual Share Capital', opening_balance: '500000', balance_type: 'Credit' }, chart, 3);
  ok(grp.length === 1 && /समूह/.test(grp[0].message) && leaf.length === 0, `${chartType}: "Share Capital" (group 1100) is refused with a clear message; "Individual Share Capital" (1102) is accepted`);
}
{
  const chart = chartOf('marketing_processing');
  const r = O.mapImportedOpenings([{ account_name: 'Share Capital', opening_balance: '500000', balance_type: 'Credit' }, { account_name: 'Individual Share Capital', opening_balance: '500000', balance_type: 'Credit' }], chart);
  ok(r.entries.length === 1 && r.entries[0].accountId === '1102' && r.unmatched.length === 1 && r.unmatched[0] === 'Share Capital', 'mapImportedOpenings: the group name is returned UNMATCHED (surfaced), the leaf is written to 1102');
  const dup = [{ id: 'g', name: 'Same Name', isGroup: true }, { id: 'l', name: 'Same Name' }];
  ok(O.mapImportedOpenings([{ account_name: 'Same Name', opening_balance: '10', balance_type: 'Debit' }], dup).entries[0].accountId === 'l', 'a group and a leaf with the same name: the LEAF gets the opening');
}

console.log('\n4. the example account names never duplicate a standard account');
{
  const names = rowsOf(T.accounts.csv).map((r) => r.row.account_name.replace(MARK, '').toLowerCase().trim());
  const std = new Set(TYPES.flatMap((t) => chartOf(t).map((a) => a.name.toLowerCase().trim())));
  const clash = names.filter((n) => std.has(n));
  ok(clash.length === 0, `none of ${names.length} example account names exists in any standard chart${clash.length ? ' — clash: ' + clash.join(', ') : ''}`);
}

console.log('\n5. the voucher template dates fall inside the CURRENT financial year');
for (const [start, end] of [['2026-04-01', '2027-03-31'], ['2027-04-01', '2028-03-31'], ['2025-04-01', '2026-03-31']]) {
  const dates = rowsOf(L.vouchersTemplate(start)).map((r) => r.row.date.replace(MARK, ''));
  ok(dates.length === 2 && dates.every((d) => d >= start && d <= end), `FY starting ${start}: example dates ${dates.join(', ')} are inside ${start}..${end}`);
}
{
  const d = rowsOf(L.vouchersTemplate('')).map((r) => r.row.date.replace(MARK, ''));
  ok(d.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)), 'a missing financial-year start falls back to a valid date (never "Invalid Date")');
}

console.log('\n5b. parent_group — the example groups exist in EVERY chart, and the resolver files accounts correctly');
{
  const ex = rowsOf(L.ACCOUNTS_TEMPLATE).map((r) => unmark(r.row, 'account_name'));
  ok(ex.length === 5 && ex.every((r) => r.parent_group), 'every example account row names a parent_group');
  for (const t of TYPES) {
    const ch = chartOf(t);
    const bad = ex.filter((r) => { const x = L.resolveParentGroup(r, ch); return x.error || !x.parentId; }).map((r) => r.parent_group);
    ok(bad.length === 0, `[${t}] all example groups resolve to a same-type group${bad.length ? ' — fail: ' + bad.join(', ') : ''}`);
    ok(ex.every((r) => L.validateAccountRow(r, 3, ch).length === 0), `[${t}] example rows validate with the chart supplied`);
    const def = Object.keys(L.DEFAULT_PARENT_BY_TYPE).filter((ty) => { const x = L.resolveParentGroup({ account_type: ty, parent_group: '' }, ch); return !x.parentId || !x.defaulted; });
    ok(def.length === 0, `[${t}] a blank parent_group gets the type's default group${def.length ? ' — missing: ' + def.join(', ') : ''}`);
  }
  const ch = chartOf('marketing_processing');
  const row = (g, ty = 'Asset') => ({ account_name: 'X', account_type: ty, opening_balance: '1', balance_type: 'Debit', parent_group: g });
  ok(L.resolveParentGroup(row('3100'), ch).parentId === '3100', 'a group id is accepted');
  ok(L.resolveParentGroup(row('fixed assets'), ch).parentId === '3100', 'the group name is matched case-insensitively');
  ok(/समूह नहीं/.test(L.resolveParentGroup(row('Cash in Hand'), ch).error || ''), 'a postable account named as parent is refused as "not a group"');
  ok(/प्रकार/.test(L.resolveParentGroup(row('Fixed Assets', 'Liability'), ch).error || ''), 'a group of a different type is refused (class-parent rule)');
  ok(/नहीं है/.test(L.resolveParentGroup(row('No Such Group'), ch).error || ''), 'an unknown group is refused, never silently ungrouped');
  ok(L.validateAccountRow(row('No Such Group'), 3, ch).some((e) => e.field === 'parent_group'), 'the row validator reports the bad group on field parent_group');
  ok(L.validateAccountRow(row(''), 3, ch).length === 0 && L.resolveParentGroup(row(''), ch).parentId === '3300', 'blank parent_group is valid and defaults to Current Assets 3300');
  ok(L.validateAccountRow(row('No Such Group'), 3).length === 0, 'without a chart (legacy callers) the validator behaves as before');
  const dupe = [...ch, { ...ch.find((a) => a.id === '3100'), id: 'g2' }];
  ok(/कोड/.test(L.resolveParentGroup(row('Fixed Assets'), dupe).error || ''), 'two same-name groups of the type: asks for the code, does not guess');
}

console.log('\n6. the account_type message names Equity, and the page uses the library');
{
  const e = L.validateAccountRow({ account_name: 'X', account_type: 'bogus', opening_balance: '1', balance_type: 'Debit' }, 3);
  ok(e.length === 1 && /Equity/.test(e[0].message), 'a wrong account_type is told the list WITH Equity (the type of share capital in the chart)');
  ok(L.validateAccountRow({ account_name: 'X', account_type: 'Equity', opening_balance: '1', balance_type: 'Credit' }, 3).length === 0, 'Equity is accepted');
  const page = readFileSync(pathResolve(HERE, '..', 'src/pages/UniversalImporter.tsx'), 'utf8');
  ok(/from '@\/lib\/importTemplates'/.test(page), 'the page imports the templates and validators from the library');
  ok(!/const (ACCOUNTS|MEMBERS|OPENING_BALANCES|VOUCHERS)_TEMPLATE\b/.test(page) && !/function validate(Account|Member|Ob|Voucher)Row/.test(page) && !/function parseCSV/.test(page), 'no stale copy of a template, validator or CSV parser is left in the page');
  ok((page.match(/vouchersTemplate\(society\.financialYearStart\)/g) || []).length === 2, 'both voucher-template downloads (CSV + Excel) are built from the society\'s own financial-year start');
  ok(/<span className="text-purple-600">Equity<\/span>/.test(page), 'the on-screen column help lists Equity');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
