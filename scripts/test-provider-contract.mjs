// TEST-01 (product audit 2026-11-17) — provider contract: the REAL DataProvider (React + happy-dom) against a fake
// Supabase the test programs. Each case calls the shipped add* / update* / delete* and reads the shipped state + toasts:
//   · a refused cloud write puts the screen back (RULE 1) and shows exactly one destructive toast;
//   · an edit sends only the columns it changed (ARCH-04);
//   · a sale / purchase is ONE server call with no direct table writes (ARCH-03);
//   · a refused voucher is removed from the screen; an accepted one takes the server's official number.
// Run: node scripts/test-provider-contract.mjs
import { mountDataProvider } from './lib/provider-harness.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const quiet = console.error; const muted = [];
console.error = (...a) => { muted.push(a.join(' ')); };   // the provider logs every refused write — expected here
const report = (...a) => quiet(...a);

const SOC = 'SOC-H';
const h = await mountDataProvider({
  seed: {
    employees: [
      { id: 'e1', empNo: 'E001', name: 'Ram', phone: '1', basicSalary: 10000, status: 'active', society_id: SOC },
      { id: 'e2', empNo: 'E002', name: 'Shyam', phone: '2', basicSalary: 12000, status: 'active', society_id: SOC },
    ],
    stock_items: [{ id: 's1', name: 'Urea', unit: 'bag', openingStock: 0, currentStock: 0, purchaseRate: 100, saleRate: 120, purchaseAccountId: '5101', salesAccountId: '4101', society_id: SOC }],
  },
});
const ctx = () => h.ctx();
const run = async (fn) => { await h.act(async () => { fn(); }); await h.settle(); };
const refuse = (table, op, error = { message: 'harness: refused' }) => h.respond((q) => (q.table === table && q.op === op ? { data: null, error } : undefined));
ok(ctx() && ctx().employees.length === 2 && ctx().stockItems.length === 1, 'the real DataProvider mounted and loaded the seeded rows');

// ── update: refused → restored + one destructive toast; accepted → only the changed column ──
h.reset(); refuse('employees', 'update');
await run(() => ctx().updateEmployee('e1', { phone: '9' }));
ok(ctx().employees.find((e) => e.id === 'e1').phone === '1', 'updateEmployee refused: the old phone is back on screen (RULE 1)');
ok(h.destructive().length === 1, `updateEmployee refused: exactly one destructive toast (got ${h.destructive().length})`);

h.reset();
await run(() => ctx().updateEmployee('e1', { phone: '9' }));
const upd = h.writes('employees');
ok(ctx().employees.find((e) => e.id === 'e1').phone === '9' && h.destructive().length === 0, 'updateEmployee accepted: new phone stays, no error toast');
ok(upd.length === 1 && upd[0].op === 'update' && JSON.stringify(upd[0].payload) === '{"phone":"9"}', `ARCH-04: only the changed column is sent (got ${JSON.stringify(upd.map((q) => q.payload))})`);
ok(upd[0]?.filters.some(([m, col, v]) => m === 'eq' && col === 'id' && v === 'e1'), 'ARCH-04: the update is scoped to that one row');

h.reset(); h.respond((q) => (q.table === 'employees' && q.op === 'update' ? { data: [], error: null } : undefined));
await run(() => ctx().updateEmployee('e2', { phone: '7' }));
ok(ctx().employees.find((e) => e.id === 'e2').phone === '2' && h.destructive().length === 1, '0 rows updated (row gone / RLS) is treated as a failure: rolled back + toast');

h.reset();
await run(() => ctx().updateEmployee('e2', { name: 'Shyam' }));
ok(h.writes('employees').length === 0, 'an edit that changes nothing sends nothing');

// ── add: refused → the new row leaves the screen ──
h.reset(); refuse('employees', 'upsert'); h.respond((q) => (q.table === 'employees' && (q.op === 'upsert' || q.op === 'insert') ? { data: null, error: { message: 'harness: refused' } } : undefined));
await run(() => ctx().addEmployee({ name: 'Mohan', phone: '3', basicSalary: 9000, status: 'active', joinDate: '2024-06-01' }));
ok(!ctx().employees.some((e) => e.name === 'Mohan'), 'addEmployee refused: the row is removed from the screen');
ok(h.destructive().length === 1, `addEmployee refused: exactly one destructive toast (got ${h.destructive().length})`);

h.reset();
await run(() => ctx().addEmployee({ name: 'Mohan', phone: '3', basicSalary: 9000, status: 'active', joinDate: '2024-06-01' }));
ok(ctx().employees.some((e) => e.name === 'Mohan') && h.destructive().length === 0, 'addEmployee accepted: the row stays');

// ── delete: refused → the row comes back ──
h.reset(); h.respond((q) => (q.table === 'employees' && (q.op === 'delete' || q.op === 'update') ? { data: null, error: { message: 'harness: refused' } } : undefined));
await run(() => ctx().deleteEmployee('e2'));
const e2 = ctx().employees.find((e) => e.id === 'e2');
ok(e2 && !e2.isDeleted, 'deleteEmployee refused: the employee is back on screen');
ok(h.destructive().length === 1, `deleteEmployee refused: exactly one destructive toast (got ${h.destructive().length})`);

// ── voucher (posting service): refused → removed; accepted → official number ──
const led = ctx().accounts.filter((a) => !a.isGroup);
const cash = led.find((a) => /cash in hand/i.test(a.name));
const income = led.find((a) => a.type === 'income');
const fyStart = `20${ctx().society.financialYear.slice(2, 4)}-06-15`;
ok(ctx().usesPostingService() === true && !!cash && !!income, 'the society is on the posting service (ARCH-03 default ON) and has a cash and an income ledger');

h.reset(); h.respond((q) => (q.table === 'rpc:post_voucher' ? { data: null, error: { message: 'post_voucher:unbalanced' } } : undefined));
const before = ctx().vouchers.length;
await run(() => ctx().addVoucher({ type: 'receipt', date: fyStart, debitAccountId: cash.id, creditAccountId: income.id, amount: 500, narration: 'harness refused' }));
ok(ctx().vouchers.length === before, 'post_voucher refused: the voucher is removed from the screen');
ok(h.destructive().length === 1, `post_voucher refused: exactly one destructive toast (got ${h.destructive().length})`);
ok(h.calls.filter((q) => q.table === 'vouchers' && q.op !== 'select').length === 0, 'no direct write to vouchers (the 105 guard would refuse it)');

h.reset(); h.respond((q) => (q.table === 'rpc:post_voucher' ? { data: { status: 'posted', voucherNo: 'RCPT/H/777' }, error: null } : undefined));
let v;
await run(() => { v = ctx().addVoucher({ type: 'receipt', date: fyStart, debitAccountId: cash.id, creditAccountId: income.id, amount: 500, narration: 'harness accepted' }); });
const saved = ctx().vouchers.find((x) => x.id === v.id);
ok(saved && saved.voucherNo === 'RCPT/H/777' && h.destructive().length === 0, `post_voucher accepted: the voucher stays with the server's official number (got ${saved?.voucherNo})`);
const pv = h.calls.find((q) => q.table === 'rpc:post_voucher');
ok(pv && JSON.stringify(pv.payload).includes(cash.id) && JSON.stringify(pv.payload).includes(income.id), 'the posting payload carries both legs');

// ── purchase (ARCH-03): one server call, nothing written directly; refused → nothing left behind ──
const purchase = { date: fyStart, supplierName: 'Harness Supplier', items: [{ itemId: 's1', itemName: 'Urea', qty: 10, rate: 100, amount: 1000 }], totalAmount: 1000, netAmount: 1000, grandTotal: 1000, paymentMode: 'cash', taxAmount: 0, createdBy: 'h' };
h.reset(); h.respond((q) => (q.table === 'rpc:post_stock_document' ? { data: null, error: { message: 'post_voucher:closed_year' } } : undefined));
const vBefore = ctx().vouchers.filter((x) => !x.isDeleted).length;
await run(() => ctx().addPurchase(purchase));
ok(ctx().purchases.length === 0 && ctx().stockItems[0].currentStock === 0 && ctx().vouchers.filter((x) => !x.isDeleted).length === vBefore, 'post_stock_document refused: no purchase, no stock, no voucher left on screen');
ok(h.destructive().length === 1, `post_stock_document refused: exactly one destructive toast (got ${h.destructive().length})`);

h.reset();
await run(() => ctx().addPurchase(purchase));
const writes = h.calls.filter((q) => q.op !== 'select' && !/^rpc:(society_empty_tables|voucher_edit_capabilities)$/.test(q.table)).map((q) => q.table);
ok(ctx().purchases.length === 1 && ctx().stockItems[0].currentStock === 10, 'purchase accepted: the bill and its stock are on screen');
ok(writes.length === 1 && writes[0] === 'rpc:post_stock_document', `ARCH-03: exactly one server call, no direct table writes (got ${writes.join(', ')})`);
ok(h.toasts.some((t) => /PUR\//.test(String(t.title))), 'the success toast carries the purchase number');

console.error = quiet;
console.log(`Provider contract: ${pass} passed, ${fail} failed`);
if (fail) { report(muted.slice(-5).join('\n')); process.exit(1); }
process.exit(0);
