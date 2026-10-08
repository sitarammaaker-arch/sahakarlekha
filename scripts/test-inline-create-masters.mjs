// Inline "create" from pickers (2026-10-08) — the rules and the wiring.
//   • who may create = who may open that master's page (the sidebar's own role gate)
//   • duplicate names are offered instead of created; GSTIN always yields a state
//   • a new record is used only once SAVED (voucher lines are FK-bound to accounts)
//   • party (customer/supplier) + its ledger are saved together and rolled back together
//   • every entry screen that was planned actually has the option; view-only pages do not
// Imports the REAL src/lib files via an '@/'-resolving loader; wiring is checked in the source (house style).
//
// Run: node scripts/test-inline-create-masters.mjs   (npm run test:inline-create-masters)
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const abs = (p) => pathToFileURL(pathResolve(HERE, p)).href;
const { roleCanCreateMaster, findDuplicateByName, normName } = await import(abs('../src/lib/masterCreate.ts'));
const { validateQuickParty, stateFromGstin } = await import(abs('../src/lib/partyValidation.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const read = (p) => readFileSync(pathResolve(SRC, p), 'utf8');

// 1. Permission — the same gate as the pages (founder: "same as Ledger Heads")
ok(roleCanCreateMaster('admin', 'ledgerHeads') && roleCanCreateMaster('accountant', 'ledgerHeads'), 'admin + accountant may create ledgers');
ok(!roleCanCreateMaster('viewer', 'ledgerHeads') && !roleCanCreateMaster('auditor', 'ledgerHeads'), 'viewer / auditor may not');
ok(!roleCanCreateMaster('cashier', 'ledgerHeads'), 'a cashier (no Ledger Heads page) cannot create a ledger from a voucher');
ok(roleCanCreateMaster('manager', 'ledgerHeads'), 'a manager (all business domains) can');
ok(roleCanCreateMaster('salesOperator', 'customers') && !roleCanCreateMaster('salesOperator', 'inventory'), 'sales operator: customers yes, items no');
ok(roleCanCreateMaster('storeKeeper', 'inventory'), 'store keeper may create items');
ok(!roleCanCreateMaster(null, 'ledgerHeads') && !roleCanCreateMaster('', 'customers'), 'no role → no create');

// 2. Duplicates
const accs = [{ name: 'Electricity', nameHi: 'बिजली', type: 'expense' }, { name: 'Bank Accounts', type: 'asset', isGroup: true }];
ok(findDuplicateByName(accs, '  electricity ', { type: 'expense' })?.name === 'Electricity', 'same name (case/space-insensitive) and type → offered');
ok(findDuplicateByName(accs, 'बिजली', { type: 'expense' })?.name === 'Electricity', 'Hindi name matches too');
ok(!findDuplicateByName(accs, 'Electricity', { type: 'income' }), 'a different type is not a duplicate (same rule as Ledger Heads)');
ok(!findDuplicateByName(accs, 'Bank Accounts', { type: 'asset' }), 'a GROUP is never offered as the account to use');
ok(normName(' Ram  Traders ') === 'ram traders', 'names normalised');

// 3. Party validation — never weaker than the Customers page
ok(validateQuickParty({ name: '' }) !== null, 'name required');
ok(validateQuickParty({ name: 'A', mobile: '12345' }) !== null && validateQuickParty({ name: 'A', mobile: '9876543210' }) === null, 'mobile: 10 digits starting 6-9');
ok(validateQuickParty({ name: 'A', gstin: '06AABCU9603R1ZX' }) === null && stateFromGstin('06AABCU9603R1ZX') === 'Haryana', 'GSTIN → state (place of supply)');
ok(validateQuickParty({ name: 'A', gstin: 'BAD' }) !== null && validateQuickParty({ name: 'A', gstin: '99AABCU9603R1ZX' }) !== null, 'bad GSTIN / unknown state code refused');

// 4. DataContext — saved-before-use, party + ledger together, codes, journal opening
const dc = read('contexts/DataContext.tsx');
ok(/opts\?\.onSaved\?\.\(newAccount\)/.test(dc) && /addAccount: \(data: Omit<LedgerAccount, 'id'>, opts\?: \{ id\?: string; onSaved\?/.test(dc), 'addAccount reports onSaved once the row is in the cloud');
ok((dc.match(/supabase\.from\('accounts'\)\.upsert\(withSoc\(baseAccount\)\)\.then/g) || []).length >= 2, 'supplier + customer save their ledger FIRST and wait for it');
ok((dc.match(/deleteAccountRow\(newAccount, \{ context: 'party-create-rollback'/g) || []).length === 2, 'a party whose row fails takes its new ledger down too, via the rollback-aware delete (no orphan ledger)');
ok((dc.match(/onBaseSuccess: \(\) => opts\?\.onSaved\?\.\((supplier|customer)\)/g) || []).length === 2, 'party onSaved only after BOTH are saved');
ok((dc.match(/nextAccountCode\(accountsRef\.current, '(2101|3303)', false/g) || []).length === 2, 'party ledgers get a readable code');
ok((dc.match(/if \(postingServiceRef\.current\) syncOpeningOnServer\(accountId\);/g) || []).length === 2, 'a party opening balance reaches the journal');
const body = (name) => { const i = dc.indexOf(`const ${name} = useCallback(`); return i < 0 ? '' : dc.slice(i, dc.indexOf('}, []);', i)); };
ok(['addSupplier', 'addCustomer'].every((f) => body(f) && !/title: 'Save failed'/.test(body(f))), 'no English "Save failed" toast left on the party ledger path');
ok(/onBaseSuccess: \(\) => opts\?\.onSaved\?\.\(newItem\)/.test(dc), 'addStockItem reports onSaved');

// 5. The dialogs hand a record back only from onSaved
const qcm = read('components/QuickCreateMaster.tsx');
ok(/onSaved: \(a\) => done\(/.test(qcm) && /onSaved: \(x\) => done\(/.test(qcm), 'QuickCreateMaster selects the new record only in onSaved');
ok(/addCustomer\(/.test(qcm) && /addSupplier\(/.test(qcm), 'customers / suppliers go through addCustomer / addSupplier (party record + ledger), never a bare ledger');
ok(/if \(kind === 'general' && !parentId\)/.test(qcm), 'a parent group is required');
ok(/openingBalance: 0/.test(qcm), 'opening is always ₹0 here');
const qid = read('components/QuickItemDialog.tsx');
ok(/if \(!salesAccountId\)/.test(qid) && /if \(!purchaseAccountId\)/.test(qid) && /onSaved: \(i\) =>/.test(qid), 'new item: Sales + Purchase A/c required, used only once saved');

// 6. Every planned screen has it; view-only Ledger does not
const has = (f, re, n = 1) => (read(f).match(re) || []).length >= n;
ok(has('pages/Vouchers.tsx', /<AccountPicker allowCreate/g, 4), 'vouchers: entry lines + edit dialog');
ok(has('pages/CashBook.tsx', /<AccountPicker allowCreate/g) && has('pages/BankBook.tsx', /<AccountPicker allowCreate/g) && has('pages/CompoundVoucher.tsx', /<AccountPicker allowCreate/g), 'cash book, bank book, compound voucher');
ok(!/allowCreate/.test(read('pages/Ledger.tsx')), 'Ledger (view-only) has no create');
ok(has('pages/Vouchers.tsx', /<BankAccountSelect/g, 2) && has('pages/SaleManagement.tsx', /<BankAccountSelect/g) && has('pages/PurchaseManagement.tsx', /<BankAccountSelect/g) && has('components/BillWiseSettlement.tsx', /<BankAccountSelect/g), 'bank selects (vouchers ×2, sale, purchase, receive/make payment)');
ok(has('pages/SaleManagement.tsx', /<QuickItemDialog/g) && has('pages/PurchaseManagement.tsx', /<QuickItemDialog/g) && has('pages/consumer/PurchaseOrders.tsx', /<QuickItemDialog/g), 'new item on sale, purchase, purchase order');
ok(!/qaName|addStockItem\(\{/.test(read('pages/SaleManagement.tsx') + read('pages/PurchaseManagement.tsx')), 'the old account-less quick-add is gone');
ok(has('pages/SaleManagement.tsx', /kinds=\{\['customer'\]\}/g) && has('pages/PurchaseManagement.tsx', /kinds=\{\['supplier'\]\}/g) && has('components/BillWiseSettlement.tsx', /kinds=\{\[isPay \? 'supplier' : 'customer'\]\}/g) && has('pages/consumer/PurchaseOrders.tsx', /kinds=\{\['supplier'\]\}/g), 'new customer / supplier on sale, purchase, receive/make payment, purchase order');
ok(has('pages/OpeningBalances.tsx', /<QuickCreateMaster/g), 'opening balances: + new account');
ok(has('components/MemberPicker.tsx', /href="\/members"/g) && has('pages/LoanRegister.tsx', /href="\/members"/g) && !/QuickCreateMaster/.test(read('components/MemberPicker.tsx')), 'members: a link to the Members page, never an inline member');

console.log(`Inline create (masters): ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
