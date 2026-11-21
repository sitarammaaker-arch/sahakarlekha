// TEST-01 slice 4 (product audit 2026-11-17) — provider contract for the voucher life-cycle (edit, cancel, approve,
// reject), salary slips and a consumer sales return, on the real DataProvider + ConsumerProvider
// (scripts/lib/provider-harness.mjs).
//   · every server refusal (edit_voucher / cancel_voucher / approve_voucher / reject_voucher) leaves the voucher
//     exactly as it was + one destructive toast; acceptance goes through ONE rpc, never a direct vouchers write
//   · a salary slip whose row is refused takes its accrual voucher back (withdraw_voucher); a refused slip delete
//     leaves the slip AND its accrual live
//   · a sales return whose row is refused: stock and vouchers back to before, one toast
// Run: node scripts/test-provider-contract-4.mjs
import { mountDataProvider } from './lib/provider-harness.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };
const qerr = console.error, qinfo = console.info, qwarn = console.warn;
console.error = () => {}; console.info = () => {}; console.warn = () => {};

const S = 'SOC-H';
const h = await mountDataProvider({
  domains: true,
  seed: {
    employees: [{ id: 'e1', empNo: 'E001', name: 'Ram', basicSalary: 10000, status: 'active', society_id: S }],
    stock_items: [{ id: 's1', name: 'Urea', unit: 'bag', openingStock: 50, currentStock: 50, purchaseRate: 100, saleRate: 120, purchaseAccountId: '5101', salesAccountId: '4101', society_id: S }],
  },
});
const c = () => h.ctx();
const run = async (fn) => { await h.act(async () => { fn(); }); await h.settle(60); };
const rpcRefuse = (name) => h.respond((q) => (q.table === `rpc:${name}` ? { data: null, error: { message: 'post_voucher:refused' } } : undefined));
const rowRefuse = (table, ops) => h.respond((q) => (q.table === table && ops.includes(q.op) ? { data: null, error: { message: 'harness: refused' } } : undefined));
const sent = () => h.calls.filter((q) => q.op !== 'select' && !/^rpc:(society_empty_tables|voucher_edit_capabilities)$/.test(q.table));
const rpcs = () => sent().filter((q) => q.table.startsWith('rpc:')).map((q) => q.table);
const noDirectVoucherWrite = () => !sent().some((q) => ['vouchers', 'voucher_entries', 'voucher_lines', 'ledger_events'].includes(q.table));
const oneRed = (what) => ok(h.destructive().length === 1, `${what}: exactly one destructive toast (got ${h.destructive().length})`);
const V = (id) => c().vouchers.find((x) => x.id === id);
const liveCount = () => c().vouchers.filter((x) => !x.isDeleted).length;

const led = c().accounts.filter((a) => !a.isGroup);
const cash = led.find((a) => /cash in hand/i.test(a.name));
const inc = led.find((a) => a.type === 'income');
const base = { type: 'receipt', date: '2024-06-15', debitAccountId: cash.id, creditAccountId: inc.id };

// ── voucher edit ──
h.reset();
let v;
await run(() => { v = c().addVoucher({ ...base, amount: 500, narration: 'harness' }); });
ok(V(v.id) && rpcs().join() === 'rpc:post_voucher', 'a posted voucher goes through post_voucher');

h.reset(); rpcRefuse('edit_voucher');
await run(() => c().updateVoucher(v.id, { amount: 700 }));
ok(V(v.id).amount === 500 && (V(v.id).lines || []).every((l) => l.amount === 500), 'edit_voucher refused: amount and legs are exactly as before');
oneRed('edit_voucher refused'); ok(noDirectVoucherWrite(), 'edit_voucher refused: no direct write to the voucher tables');

h.reset();
await run(() => c().updateVoucher(v.id, { amount: 700 }));
ok(V(v.id).amount === 700 && h.destructive().length === 0 && rpcs().join() === 'rpc:edit_voucher' && noDirectVoucherWrite(), 'edit accepted: amount 700 via ONE edit_voucher call');

// ── voucher cancel ──
h.reset(); rpcRefuse('cancel_voucher');
await run(() => c().cancelVoucher(v.id, 'harness', 'h'));
ok(!V(v.id).isDeleted, 'cancel_voucher refused: the voucher is live again'); oneRed('cancel_voucher refused');

h.reset();
await run(() => c().cancelVoucher(v.id, 'harness', 'h'));
ok(V(v.id).isDeleted === true && rpcs().join() === 'rpc:cancel_voucher' && noDirectVoucherWrite(), 'cancel accepted: soft-cancelled via ONE cancel_voucher call');

// ── approve / reject a pending voucher ──
h.reset();
let p;
await run(() => { p = c().addVoucher({ ...base, amount: 300, narration: 'pending', approvalStatus: 'pending' }); });
ok(V(p.id)?.approvalStatus === 'pending' && rpcs().join() === 'rpc:save_pending_voucher', 'a pending voucher is stored by save_pending_voucher (not posted)');

h.reset(); rpcRefuse('approve_voucher');
await run(() => c().approveVoucher(p.id, 'checker'));
ok(V(p.id).approvalStatus === 'pending', 'approve_voucher refused: still pending'); oneRed('approve_voucher refused');

h.reset(); rpcRefuse('reject_voucher');
await run(() => c().rejectVoucher(p.id, 'checker', 'harness'));
ok(V(p.id).approvalStatus === 'pending', 'reject_voucher refused: still pending'); oneRed('reject_voucher refused');

h.reset();
await run(() => c().approveVoucher(p.id, 'checker'));
ok(V(p.id).approvalStatus === 'approved' && rpcs().join() === 'rpc:approve_voucher' && noDirectVoucherWrite(), 'approve accepted: approved via ONE approve_voucher call');

// ── salary slips ──
const slip = (month) => ({ employeeId: 'e1', month, basicSalary: 10000, grossSalary: 10000, netSalary: 10000, isPaid: false });
const live0 = liveCount();
h.reset(); rowRefuse('salary_records', ['upsert', 'insert']);
await run(() => c().addSalaryRecord(slip('2024-06')));
ok(c().salaryRecords.length === 0, 'salary slip refused: the slip leaves the screen'); oneRed('salary slip refused');
ok(liveCount() === live0 && rpcs().includes('rpc:withdraw_voucher'), 'salary slip refused: its accrual voucher is withdrawn too (withdraw_voucher) — no expense without a slip');

h.reset();
let sr;
await run(() => { sr = c().addSalaryRecord(slip('2024-07')); });
ok(c().salaryRecords.length === 1 && sr.accrualVoucherId && V(sr.accrualVoucherId) && !V(sr.accrualVoucherId).isDeleted, 'salary slip accepted: slip + live accrual voucher');

h.reset(); rowRefuse('salary_records', ['delete', 'update']);
await run(() => c().deleteSalaryRecord(sr.id));
ok(c().salaryRecords.length === 1 && !V(sr.accrualVoucherId).isDeleted, 'slip delete refused: the slip AND its accrual stay live (cascade runs only after the delete lands)');
oneRed('slip delete refused'); ok(!rpcs().includes('rpc:cancel_voucher'), 'slip delete refused: the accrual was never sent for cancel');

h.reset();
await run(() => c().deleteSalaryRecord(sr.id));
ok(c().salaryRecords.length === 0 && V(sr.accrualVoucherId).isDeleted === true && rpcs().includes('rpc:cancel_voucher'), 'slip delete accepted: slip gone, accrual cancelled through the server');

// ── consumer sales return ──
h.reset();
await run(() => c().addSale({ date: '2024-06-15', customerName: 'Walk-in', items: [{ itemId: 's1', itemName: 'Urea', qty: 5, rate: 120, amount: 600 }], totalAmount: 600, netAmount: 600, grandTotal: 600, paymentMode: 'cash', taxAmount: 0, createdBy: 'h' }));
const sale = c().sales[0];
const ret = { originalSaleId: sale.id, items: [{ itemId: 's1', itemName: 'Urea', qty: 2, rate: 120, amount: 240 }], refundMode: 'cash', date: '2024-06-20' };
const liveR = liveCount();
ok(c().stockItems[0].currentStock === 45, 'sale for the return: stock 50 → 45');

h.reset(); rowRefuse('sales_returns', ['upsert', 'insert']);
await run(() => h.domain('consumer').addSalesReturn(ret));
await h.settle(80);
ok(h.domain('consumer').salesReturns.length === 0 && c().stockItems[0].currentStock === 45 && liveCount() === liveR, 'sales return refused: no return, stock back to 45, refund voucher withdrawn');
oneRed('sales return refused');

h.reset();
await run(() => h.domain('consumer').addSalesReturn(ret));
ok(h.domain('consumer').salesReturns.length === 1 && c().stockItems[0].currentStock === 47 && h.destructive().length === 0, 'sales return accepted: return recorded, stock 45 → 47');

console.error = qerr; console.info = qinfo; console.warn = qwarn;
console.log(`Provider contract (slice 4): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
