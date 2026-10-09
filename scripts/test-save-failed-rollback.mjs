// RULE 1 sweep (2026-10-09) — the last English "Save failed" toasts in DataContext.
//   • a delete / save whose cloud write fails puts the record BACK on screen (it used to stay gone
//     locally and come back on F5) and says so in Hindi, destructive, ≥ 10 s
//   • a delete with a cascade (linked vouchers, stock, movements, party ledger) runs the cascade only
//     AFTER the parent row is saved — a failed delete leaves nothing half-done
// Source checks (house style).
//
// Run: node scripts/test-save-failed-rollback.mjs   (npm run test:save-failed-rollback)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const dc = readFileSync(resolve(HERE, '..', 'src', 'contexts', 'DataContext.tsx'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const body = (name) => {
  const i = dc.indexOf(`const ${name} = useCallback(`);
  return i < 0 ? '' : dc.slice(i, dc.indexOf('\n  }, ', i));
};

// 1. Nothing English / rollback-less is left
ok(!/title: 'Save failed'/.test(dc), 'no English "Save failed" toast left in DataContext');

// 2. The helper: restore, then a loud Hindi toast
const h = dc.slice(dc.indexOf('const failedCloudWrite = '), dc.indexOf('// ── Voucher persistence helper'));
ok(/restore\(\);/.test(h) && /variant: 'destructive', duration: 10000/.test(h) && /क्लाउड में सेव नहीं हुआ/.test(h), 'failedCloudWrite restores, then a Hindi destructive toast for 10 s');
ok(/reportError\('db-sync'/.test(h), 'failures still reach error_log');
ok(/function putBack</.test(dc), 'putBack helper re-inserts a removed row');

// 3. Every site restores its record
const SITES = [
  ['cancelVoucher', 'वाउचर रद्द करना', /setVouchersState\(prev => prev\.map\(v => v\.id === id \? current : v\)\)/],
  ['deleteAuditObjection', 'ऑडिट आपत्ति हटाना', /putBack\(prev, removed\)/],
  ['deleteRecoverable', 'वसूली मद हटाना', /putBack\(prev, removed\)/],
  ['deleteKachiAaratEntry', 'कच्ची आढ़त एंट्री हटाना', /putBack\(prev, removed\)/],
  ['upsertP7Entry', 'P7 एंट्री सेव करना', /existing \? \[\.\.\.list\.filter\(e => e\.id !== id\), existing\] : list\.filter\(e => e\.id !== id\)/],
  ['deleteP7Entry', 'P7 एंट्री हटाना', /putBack\(prev, removed\)/],
  ['deleteMember', 'सदस्य हटाना', /putBack\(prev, removed\)/],
  ['deleteLoan', 'ऋण हटाना', /putBack\(prev, loan\)/],
  ['deleteAsset', 'संपत्ति हटाना', /putBack\(prev, asset\)/],
  ['deleteStockItem', 'स्टॉक मद हटाना', /prev\.map\(i => i\.id === id \? item : i\)/],
  ['deleteSale', 'बिक्री हटाना', /putBack\(prev, sale\)/],
  ['deletePurchase', 'खरीद हटाना', /putBack\(prev, purchase\)/],
  ['deleteEmployee', 'कर्मचारी हटाना', /putBack\(prev, removed\)/],
  ['deleteSalaryRecord', 'वेतन पर्ची हटाना', /putBack\(prev, record\)/],
  ['deleteSupplier', 'आपूर्तिकर्ता हटाना', /putBack\(prev, sup\)/],
  ['deleteCustomer', 'ग्राहक हटाना', /putBack\(prev, cus\)/],
];
for (const [fn, what, restore] of SITES) {
  const b = body(fn);
  ok(b.includes(`failedCloudWrite('${what}', error`) && restore.test(b), `${fn}: a failed cloud write restores the record`);
}

// 4. Cascades run only after the parent write succeeded (inside its .then, after the failure return)
const after = (fn, marker) => {
  const b = body(fn);
  const f = b.indexOf('failedCloudWrite(');
  const m = b.indexOf(marker);
  return f > 0 && m > f;
};
ok(after('deleteMember', 'cancelLinkedVouchers('), 'member: linked vouchers cancelled only after the member row is saved');
ok(after('deleteLoan', 'cancelLinkedVouchers('), 'loan: disbursement voucher cancelled only after the loan row is saved');
ok(after('deleteAsset', 'cancelLinkedVouchers('), 'asset: capitalisation / depreciation vouchers cancelled only after the asset row is saved');
ok(after('deleteSalaryRecord', 'cancelLinkedVouchers('), 'salary slip: accrual + payment cancelled only after the slip row is deleted');
ok(after('deleteSale', 'cancelLinkedVouchers(') && after('deleteSale', "supabase.from('stock_movements').delete()"), 'sale (legacy path): vouchers + movements only after the sale row is saved');
ok(after('deletePurchase', 'cancelLinkedVouchers(') && after('deletePurchase', "supabase.from('stock_movements').delete()"), 'purchase (legacy path): vouchers + movements only after the purchase row is saved');
ok(after('deleteStockItem', 'addVoucher(') && after('deleteStockItem', "supabase.from('stock_movements').delete()"), 'stock item: write-off + movement clean-up only after the item row is saved');
ok(after('deleteSupplier', 'deleteAccountRow(') && after('deleteCustomer', 'deleteAccountRow('), 'party: its ledger is removed / renamed only after the party row is deleted');
ok(!/setSalesState\(prev => \{\s*const sale = prev\.find/.test(dc) && !/setPurchasesState\(prev => \{\s*const purchase = prev\.find/.test(dc), 'no cascade side effects inside a state updater (sale / purchase)');

console.log(`Save-failed rollback: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
