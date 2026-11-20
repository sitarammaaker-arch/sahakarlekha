// TEST-01 slice 2 (product audit 2026-11-17) — provider contract for members, loans, ledger accounts, customers and
// the full sale life-cycle, on the real DataProvider (scripts/lib/provider-harness.mjs).
//   · refused cloud write → screen restored (RULE 1) + exactly one destructive toast
//   · accepted edit → only the changed columns go out (ARCH-04)
//   · a sale edit / delete is ONE server call; refused → stock, items and vouchers exactly as before (ARCH-03, RULE 3)
//   · a customer whose row is refused takes its new sub-ledger account with it (no orphan account in the cloud)
// Run: node scripts/test-provider-contract-2.mjs
import { mountDataProvider } from './lib/provider-harness.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };
const quiet = console.error; const qlog = console.log; const qinfo = console.info;
console.error = () => {}; console.info = () => {};   // the provider logs every refused write / audit-delete — expected
const say = (...a) => qlog(...a);

const S = 'SOC-H';
const h = await mountDataProvider({
  seed: {
    members: [{ id: 'm1', memberId: 'M001', name: 'Ram', phone: '1', shareCapital: 500, status: 'active', approvalStatus: 'approved', joinDate: '2024-04-10', society_id: S }],
    loans: [{ id: 'l1', loanNo: 'LN/001', memberId: 'm1', memberName: 'Ram', amount: 10000, purpose: 'Crop', status: 'active', interestRate: 12, disbursementDate: '2024-05-01', society_id: S }],
    stock_items: [{ id: 's1', name: 'Urea', unit: 'bag', openingStock: 50, currentStock: 50, purchaseRate: 100, saleRate: 120, purchaseAccountId: '5101', salesAccountId: '4101', society_id: S }],
  },
});
const c = () => h.ctx();
const run = async (fn) => { await h.act(async () => { fn(); }); await h.settle(); };
const refuse = (table, ops) => h.respond((q) => (q.table === table && ops.includes(q.op) ? { data: null, error: { message: 'harness: refused' } } : undefined));
const oneRed = (what) => ok(h.destructive().length === 1, `${what}: exactly one destructive toast (got ${h.destructive().length})`);
const sent = () => h.calls.filter((q) => q.op !== 'select' && !/^rpc:(society_empty_tables|voucher_edit_capabilities)$/.test(q.table));
ok(c().members.length === 1 && c().loans.length === 1 && c().stockItems.length === 1, 'the real DataProvider mounted with the seeded member, loan and item');

// ── members ──
h.reset(); refuse('members', ['update']);
await run(() => c().updateMember('m1', { phone: '9' }));
ok(c().members[0].phone === '1', 'updateMember refused: the old phone is back'); oneRed('updateMember refused');
h.reset();
await run(() => c().updateMember('m1', { phone: '9' }));
const mu = h.writes('members');
ok(c().members[0].phone === '9' && mu.length === 1 && JSON.stringify(mu[0].payload) === '{"phone":"9"}', `updateMember accepted: only the phone is sent — the stale share capital is not (got ${JSON.stringify(mu.map((q) => q.payload))})`);
h.reset(); refuse('members', ['upsert', 'insert']);
await run(() => c().addMember({ name: 'Shyam', phone: '2', shareCapital: 100, status: 'active', approvalStatus: 'approved', joinDate: '2024-06-10' }));
ok(c().members.length === 1 && !c().members.some((m) => m.name === 'Shyam'), 'addMember refused: the new member is removed from the screen'); oneRed('addMember refused');

// ── loans ──
h.reset(); refuse('loans', ['update']);
await run(() => c().updateLoan('l1', { purpose: 'Dairy' }));
ok(c().loans[0].purpose === 'Crop', 'updateLoan refused: the old purpose is back'); oneRed('updateLoan refused');
h.reset();
await run(() => c().updateLoan('l1', { purpose: 'Dairy' }));
const lu = h.writes('loans');
ok(c().loans[0].purpose === 'Dairy' && lu.length === 1 && JSON.stringify(lu[0].payload) === '{"purpose":"Dairy"}', `updateLoan accepted: only the purpose is sent — never the amount (got ${JSON.stringify(lu.map((q) => q.payload))})`);

// ── ledger accounts ──
const grp = c().accounts.find((a) => a.isGroup && a.type === 'expense');
const newAcc = { name: 'Harness Expense', type: 'expense', parentId: grp.id, openingBalance: 0, openingBalanceType: 'debit', isGroup: false };
h.reset(); refuse('accounts', ['upsert', 'insert']);
await run(() => c().addAccount(newAcc));
ok(!c().accounts.some((a) => a.name === 'Harness Expense'), 'addAccount refused: the ledger is removed from the screen'); oneRed('addAccount refused');
h.reset();
let acc;
await run(() => { acc = c().addAccount(newAcc); });
ok(acc?.id && c().accounts.some((a) => a.id === acc.id), 'addAccount accepted: the ledger stays');
h.reset(); refuse('accounts', ['update']);
await run(() => c().updateAccount(acc.id, { name: 'Renamed' }));
ok(c().accounts.find((a) => a.id === acc.id)?.name === 'Harness Expense', 'updateAccount refused: the old name is back'); oneRed('updateAccount refused');
h.reset();
await run(() => c().updateAccount(acc.id, { name: 'Renamed' }));
const au = h.writes('accounts').filter((q) => q.op === 'update');
ok(au.length === 1 && au[0].payload.name === 'Renamed' && !('openingBalance' in au[0].payload) && !('parentId' in au[0].payload), `updateAccount accepted: the rename does not resend the opening balance or parent (got ${JSON.stringify(au.map((q) => q.payload))})`);
h.reset(); refuse('accounts', ['delete']);
await run(() => c().deleteAccount(acc.id));
ok(c().accounts.some((a) => a.id === acc.id), 'deleteAccount refused: the ledger is back'); oneRed('deleteAccount refused');

// ── customers: the sub-ledger account follows the customer ──
const nAcc = c().accounts.length;
h.reset(); refuse('customers', ['upsert', 'insert']);
await run(() => c().addCustomer({ name: 'Harness Customer', phone: '5' }));
await h.settle(80);
const accUp = sent().find((q) => q.table === 'accounts' && q.op === 'upsert');
const accId = accUp && [].concat(accUp.payload)[0]?.id;
ok(c().customers.length === 0 && c().accounts.length === nAcc, 'addCustomer refused: neither the customer nor its new account stays on screen'); oneRed('addCustomer refused');
ok(!!accId && sent().some((q) => q.table === 'accounts' && q.op === 'delete' && q.filters.some(([m, col, v]) => m === 'eq' && col === 'id' && v === accId)), 'addCustomer refused: the account already written to the cloud is deleted again (no orphan ledger)');

// ── sale life-cycle (ARCH-03) ──
h.reset();
await run(() => c().addSale({ date: '2024-06-15', customerName: 'Walk-in', items: [{ itemId: 's1', itemName: 'Urea', qty: 5, rate: 120, amount: 600 }], totalAmount: 600, netAmount: 600, grandTotal: 600, paymentMode: 'cash', taxAmount: 0, createdBy: 'h' }));
const sale = c().sales[0];
ok(sale && c().stockItems[0].currentStock === 45 && sent().map((q) => q.table).join() === 'rpc:post_stock_document', 'addSale: stock 50 → 45, one server call');
const liveV = () => c().vouchers.filter((v) => !v.isDeleted).map((v) => v.id).sort().join();
const v0 = liveV(); const movs0 = c().stockMovements.length;
const edit = { ...sale, items: [{ itemId: 's1', itemName: 'Urea', qty: 8, rate: 120, amount: 960 }], totalAmount: 960, netAmount: 960, grandTotal: 960 };

h.reset(); h.respond((q) => (q.table === 'rpc:update_stock_document' ? { data: null, error: { message: 'post_voucher:closed_year' } } : undefined));
await run(() => c().updateSale(sale.id, edit));
ok(c().stockItems[0].currentStock === 45 && c().sales[0].items[0].qty === 5 && liveV() === v0 && c().stockMovements.length === movs0, 'updateSale refused: stock, items, vouchers and movements exactly as before'); oneRed('updateSale refused');
ok(!sent().some((q) => ['sales', 'stock_items', 'stock_movements', 'vouchers', 'voucher_entries'].includes(q.table)), `updateSale refused: nothing was written to sales / stock / vouchers directly (sent: ${sent().map((q) => q.table).join(', ')})`);

h.reset();
await run(() => c().updateSale(sale.id, edit));
ok(c().stockItems[0].currentStock === 42 && c().sales[0].items[0].qty === 8 && h.destructive().length === 0, 'updateSale accepted: stock 45 → 42, the new quantity shows');
ok(sent().filter((q) => q.table.startsWith('rpc:')).map((q) => q.table).join() === 'rpc:update_stock_document', 'updateSale accepted: ONE server call (update_stock_document)');

const v1 = liveV();
h.reset(); h.respond((q) => (q.table === 'rpc:cancel_stock_document' ? { data: null, error: { message: 'harness: refused' } } : undefined));
await run(() => c().deleteSale(sale.id));
ok(c().sales.filter((s) => !s.isDeleted).length === 1 && c().stockItems[0].currentStock === 42 && liveV() === v1, 'deleteSale refused: the sale, its stock and its vouchers are all back'); oneRed('deleteSale refused');

h.reset();
await run(() => c().deleteSale(sale.id));
ok(c().sales.filter((s) => !s.isDeleted).length === 0 && c().stockItems[0].currentStock === 50, 'deleteSale accepted: the sale is gone and the stock is back to 50');
ok(sent().filter((q) => q.table.startsWith('rpc:')).map((q) => q.table).join() === 'rpc:cancel_stock_document', 'deleteSale accepted: ONE server call (cancel_stock_document)');

console.error = quiet; console.info = qinfo;
say(`Provider contract (slice 2): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
