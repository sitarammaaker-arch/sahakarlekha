// 3302 Bank Accounts / 2101 Sundry Creditors / 3303 Sundry Debtors are GROUPS with a postable catch-all child
// (3302-01 / 2101-01 / 3303-01). Pins: the shipped charts, the "where does an unspecified party post"
// helpers (never the first child = never some customer's ledger), the Dairy resolver, the role
// preferences, and the shape of migration 113 (children → roles → flag, nothing deleted, history untouched).
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
const D = await import(pathToFileURL(path.join(SRC, 'lib/dairy/accounts.ts')).href);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} — got ${JSON.stringify(a)}`);
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

console.log('shipped charts');
const KIND = (t, tpl) => ({ t, byId: new Map(tpl.map((a) => [a.id, a])) });
const charts = Object.entries(S.SOCIETY_TEMPLATES).map(([t, tpl]) => KIND(t, tpl));
for (const { t, byId } of charts) {
  for (const [head, child] of [['3302', '3302-01'], ['2101', '2101-01']]) {
    const h = byId.get(head), c = byId.get(child);
    ok(h && h.isGroup, `${t}: ${head} is a group`);
    ok(c && !c.isGroup && c.parentId === head && c.type === h.type, `${t}: ${child} is a postable child of ${head}, same type`);
  }
  const h3 = byId.get('3303'), c3 = byId.get('3303-01');
  if (t === 'pacs') {
    ok(h3 && !h3.isGroup && /KCC/i.test(h3.name) && !c3, 'pacs: 3303 is still the KCC loan LEDGER (a different head — never a group)');
  } else {
    ok(h3 && h3.isGroup, `${t}: 3303 is a group`);
    ok(c3 && !c3.isGroup && c3.parentId === '3303' && c3.type === 'asset', `${t}: 3303-01 is a postable child of 3303`);
  }
  ok(!byId.get('3302-01')?.isSystem, `${t}: the default bank may be replaced (not a system account)`);
  ok(byId.get('2101-01')?.isSystem && (t === 'pacs' || byId.get('3303-01')?.isSystem), `${t}: the creditors / debtors catch-all is protected`);
}

console.log('where an unspecified party posts');
const acc = (id, extra = {}) => ({ id, name: id, ...extra });
const legacy = [acc('3303'), acc('2101'), acc('3302')];
eq(S.defaultDebtorsAccountId(legacy), '3303', 'legacy chart (3303 a ledger) → 3303 itself, nothing already booked moves');
eq(S.defaultCreditorsAccountId(legacy), '2101', 'legacy chart → 2101 itself');
const current = [acc('3303', { isGroup: true }), acc('3303-01', { parentId: '3303' }), acc('cust-1', { parentId: '3303' }), acc('2101', { isGroup: true }), acc('2101-01', { parentId: '2101' }), acc('sup-1', { parentId: '2101' })];
eq(S.defaultDebtorsAccountId(current), '3303-01', 'current chart → the catch-all child');
eq(S.defaultCreditorsAccountId(current), '2101-01', 'current chart → the catch-all child');
const noCatchAll = [acc('3303', { isGroup: true }), acc('cust-1', { parentId: '3303' }), acc('2101', { isGroup: true }), acc('sup-1', { parentId: '2101' })];
eq(S.defaultDebtorsAccountId(noCatchAll), '3303', 'catch-all deleted → the GROUP id (addVoucher then refuses it), never customer #1');
eq(S.defaultCreditorsAccountId(noCatchAll), '2101', 'catch-all deleted → the GROUP id, never supplier #1');
eq(S.defaultCreditorsAccountId([acc('2101', { isGroup: true }), acc('2101-01', { parentId: '2101', isGroup: true })]), '2101', 'a catch-all that is itself a group is not postable');
eq(S.defaultBankAccountId([acc('3302', { isGroup: true }), acc('3302-01', { parentId: '3302' })]), '3302-01', 'bank group → its child');

console.log('Dairy resolver never returns a group');
const dairy = [{ id: '3303', name: 'Sundry Debtors', nameHi: 'विविध देनदार', isGroup: true }, { id: '3303-01', name: 'Sundry Debtors — General', nameHi: 'विविध देनदार — सामान्य', isGroup: false }];
eq(D.resolveUnionReceivableAccountId(dairy), '3303-01', 'union receivable → the catch-all child');
eq(D.resolveUnionReceivableAccountId([{ id: '3303', name: 'Sundry Debtors', nameHi: 'विविध देनदार', isGroup: false }]), '3303', 'legacy leaf 3303 still resolves');
eq(D.resolveUnionReceivableAccountId([dairy[0]]), null, 'only the group exists → null (caller shows "देनदार खाता नहीं मिला"), never the group');

console.log('role preferences');
const roles = read('src/lib/accounting/roles.ts');
ok(/role: 'bank\.default'[^\n]*preferIds: \['3302-01', '3302'\]/.test(roles), 'bank.default prefers 3302-01');
ok(/role: 'customer\.receivable'[^\n]*preferIds: \['3303-01', '3303'\]/.test(roles), 'customer.receivable prefers 3303-01');
ok(/role: 'supplier\.payable'[^\n]*preferIds: \['2101-01', '2101'\]/.test(roles), 'supplier.payable prefers 2101-01');

console.log('no hard-coded party fallback left in the posting paths');
for (const f of ['src/contexts/DataContext.tsx', 'src/contexts/ConsumerDataContext.tsx', 'src/contexts/HousingDataContext.tsx', 'src/contexts/DairyDataContext.tsx', 'src/contexts/MarketingDataContext.tsx', 'src/pages/KccLoan.tsx', 'src/pages/LoanRegister.tsx', 'src/pages/ProfitDistribution.tsx']) {
  const code = read(f).replace(/\/\/.*$/gm, '');
  ok(!/\|\|\s*'(3302|2101|3303)'/.test(code) && !/\?\s*'(2101|3303)'\s*:\s*'(2101|3303)'/.test(code) && !/:\s*'3303'\s*\)/.test(code), `${f}: no \`|| '3302'/'2101'/'3303'\` fallback`);
}

console.log('migration 113');
const up = read('supabase/migrations/113_party_heads_become_groups.sql');
const code = up.replace(/--.*$/gm, '');
const at = (re) => code.search(re);
ok(at(/insert into public\.accounts/) > 0 && at(/insert into public\.accounts/) < at(/update public\.account_roles/) && at(/update public\.account_roles/) < at(/set "isGroup" = true/), 'order: children first, then roles, then the group flag');
ok(!/\b(delete\s+from|truncate|drop\s+table)\b/i.test(code), 'deletes nothing');
ok(!/create\s+(temp|temporary)\s+table/i.test(code), 'no temp tables (SQL Editor splits statements)');
ok(/has_postings/.test(code) && /voucher_lines/.test(code) && /ledger_events/.test(code) && /voucher_entries/.test(code), 'a head with ANY posting (lines, entries, journal) is never flipped');
ok(/a\.name in \('Sundry Debtors', 'Maintenance Receivable'\)/.test(code), '3303 only where it is Sundry Debtors / Maintenance Receivable (PACS 3303 is a loan ledger)');
ok(/abs\(p\.ob\) < 0\.005/.test(code), 'a head with an opening balance is never flipped');
ok(/x\.role not in \('bank\.default', 'supplier\.payable', 'customer\.receivable'\)/.test(code), 'any OTHER role on the head blocks the flip');
ok(/where p\.eligible and p\.add_child/.test(code), 'children only for eligible heads');
ok(/exists \(select 1 from public\.accounts c\s+where c\.society_id = a\.society_id and c\."parentId" = a\.id/.test(code), 'the flag needs a postable child to exist');
ok(/revoke execute on function public\.parent_group_plan\(\) from public, anon, authenticated/.test(code), 'plan function not callable by app users');
const down = read('supabase/migrations/113_party_heads_become_groups_down.sql');
ok(/auto \(migration 113\)/.test(down) && !/delete\s+from\s+public\.accounts/i.test(down), 'down only reverses what 113 did; never deletes accounts');
const prev = read('supabase/diagnostics/preview_113_party_heads.sql').replace(/--.*$/gm, '');
ok(!/\b(insert|update|delete|drop|create)\b/i.test(prev), 'preview is read-only');

console.log(`Party heads: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
