#!/usr/bin/env node
// M1-4a · account deletes must survive the database REFUSING them (RULE 1), before account_roles
// is seeded. CI-safe: unit tests of src/lib/accounting/accountDelete.ts plus a static check that
// every accounts DELETE in the app goes through the rollback-aware paths.
// The real DB behaviour (23503, RLS 0-row delete, all-or-nothing reset) is covered against a
// restored backup by scripts/db-harness/tests/m1-4a-account-delete.mjs.
//
// Run: node scripts/test-m1-4a-account-delete.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { accountDeleteFailure, coaResetBlockers } = await import(pathToFileURL(pathResolve(HERE, '../src/lib/accounting/accountDelete.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

console.log('accountDeleteFailure');
ok('a delete that removed the row is not a failure', accountDeleteFailure('Cash', { error: null, deleted: 1 }) === null);
const fk = accountDeleteFailure('Cash', { error: { code: '23503', message: 'violates foreign key' }, deleted: null });
ok('23503 → Hindi message naming the role link, and says nothing was lost', /accounting role/.test(fk) && /वापस दिखा दिया/.test(fk) && fk.startsWith('"Cash"'));
const other = accountDeleteFailure('Cash', { error: { code: '42501', message: 'permission denied' }, deleted: null });
ok('any other error → Hindi message carrying the cloud error', /cloud पर नहीं मिटा/.test(other) && /permission denied/.test(other));
const zero = accountDeleteFailure('Cash', { error: null, deleted: 0 });
ok('0 rows deleted (RLS) counts as a failure', zero !== null && /अनुमति/.test(zero));

console.log('coaResetBlockers');
const tpl = new Set(['3301', '3302', '2101']);
const accounts = [{ id: '3301', name: 'Cash in Hand' }, { id: 'u-sbi', name: 'SBI Assandh' }, { id: 'u-sup', name: 'Ram Traders' }, { id: 'u-cus', name: 'Shyam' }, { id: 'u-free', name: 'Unused' }];
ok('nothing referenced outside the template → no blockers', coaResetBlockers(tpl, accounts, [{ debitAccountId: '3301', creditAccountId: '3302' }], [], []).length === 0);
const b = coaResetBlockers(tpl, accounts,
  [{ debitAccountId: '3301', creditAccountId: 'u-sbi' }, { lines: [{ accountId: '3302' }, { accountId: 'u-line' }] }],
  [{ name: 'Ram Traders', accountId: 'u-sup' }], [{ name: 'Shyam', accountId: 'u-cus' }]);
const ids = b.map((x) => x.id).sort();
ok('a voucher leg / line, a supplier and a customer outside the template all block', ids.join(',') === 'u-cus,u-line,u-sbi,u-sup', ids.join(','));
ok('blockers carry the account name (id when unknown) and the reason', b.find((x) => x.id === 'u-sbi').name === 'SBI Assandh' && b.find((x) => x.id === 'u-line').name === 'u-line'
  && b.find((x) => x.id === 'u-sup').reason === 'supplier' && b.find((x) => x.id === 'u-cus').reason === 'customer');
ok('an unused non-template account does not block', !ids.includes('u-free'));
ok('template ids never block (they come back with the same id)', !ids.includes('3301') && !ids.includes('3302'));

console.log('DataContext: every accounts DELETE is rollback-aware');
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');
const deletes = [...dc.matchAll(/from\('accounts'\)\.delete\(\)[^\n]*/g)].map((m) => m[0]);
ok('exactly two accounts DELETE call sites remain (deleteAccountRow + resetAccounts)', deletes.length === 2, deletes.join(' | '));
const rowFn = dc.slice(dc.indexOf('const deleteAccountRow = useCallback'), dc.indexOf('const deleteAccount = useCallback'));
ok('deleteAccountRow scopes by society and asks for the deleted rows', /\.eq\('id', account\.id\)\.eq\('society_id', societyIdRef\.current\)\.select\('id'\)/.test(rowFn));
ok('deleteAccountRow puts the account back on failure', /setAccountsState\(prev => prev\.some\(a => a\.id === account\.id\) \? prev : \[\.\.\.prev, account\]\)/.test(rowFn));
ok('deleteAccountRow shows a destructive toast and reports the error', /variant: 'destructive'/.test(rowFn) && /reportError\(/.test(rowFn));
const del = dc.slice(dc.indexOf('const deleteAccount = useCallback'), dc.indexOf('const mergeAccounts = useCallback'));
ok('deleteAccount uses deleteAccountRow and drops the journal zero-event on failure', /deleteAccountRow\(account,/.test(del) && /onFail: \(\) => \{ if \(zeroEvent\) ledgerEventsRef\.current = ledgerEventsRef\.current\.filter/.test(del));
const merge = dc.slice(dc.indexOf('const mergeAccounts = useCallback'), dc.indexOf('const resetAccounts = useCallback'));
ok('mergeAccounts deletes the emptied account through deleteAccountRow', /deleteAccountRow\(remove,/.test(merge) && /const remove = accounts\.find\(a => a\.id === removeId\)/.test(merge) && !/from\('accounts'\)\.delete\(\)/.test(merge));
for (const [who, key] of [['deleteSupplier', 'supAccount'], ['deleteCustomer', 'cusAccount']]) {
  const body = dc.slice(dc.indexOf(`const ${who} = useCallback`), dc.indexOf(`const ${who} = useCallback`) + 4000);
  ok(`${who} deletes its party account through deleteAccountRow`, new RegExp(`deleteAccountRow\\(${key},`).test(body));
  ok(`${who} renames the kept account within the society`, /\[(Supplier|Customer) deleted\]` \}\)\.eq\('id', (sup|cus)\.accountId\)\.eq\('society_id', societyIdRef\.current\)/.test(body));
}
const reset = dc.slice(dc.indexOf('const resetAccounts = useCallback'), dc.indexOf('const updateSociety = useCallback'));
ok('resetAccounts is async and returns a boolean', /useCallback\(async \(templateAccounts: LedgerAccount\[\]\): Promise<boolean>/.test(reset));
ok('resetAccounts refuses when non-template accounts are in use', /coaResetBlockers\(/.test(reset) && /if \(blockers\.length > 0\)/.test(reset));
ok('resetAccounts awaits the cloud delete and stops on its error', /const \{ error: delErr \} = await supabase\.from\('accounts'\)\.delete\(\)\.eq\('society_id', sid\)/.test(reset) && /if \(delErr\) \{/.test(reset));
ok('resetAccounts sets the template locally only after every insert succeeded', reset.lastIndexOf('setAccountsState(templateAccounts)') > reset.indexOf('if (insertErr)'));
ok('on a partial insert it re-reads the cloud chart instead of showing the template', /fetchAllPagedFor<LedgerAccount>\('accounts', sid\)/.test(reset));
ok('resetAccounts is permission- and FY-lock-guarded', /guardPermission\('delete'/.test(reset) && /guardFYLocked\(\)/.test(reset));
ok('context type: resetAccounts returns Promise<boolean>', /resetAccounts: \(templateAccounts: LedgerAccount\[\]\) => Promise<boolean>;/.test(dc));

console.log('SocietySetup: no false-success toasts');
const ss = readFileSync(pathResolve(HERE, '../src/pages/SocietySetup.tsx'), 'utf8');
ok('COA reset success is shown only after resetAccounts resolves true', /const ok = await resetAccounts\(template\);\s*if \(!ok\) return;/.test(ss));
ok('account delete success is shown only when deleteAccount started the delete', /if \(deleteAccount\(id\)\) toast\(/.test(ss));

console.log(`\nM1-4a account delete: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
