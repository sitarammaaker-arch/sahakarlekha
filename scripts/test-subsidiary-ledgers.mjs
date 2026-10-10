// Subsidiary ledgers — Deposit Ledger, Loan Ledger (member / KCC), Stock Register. Each is a READ of
// records the app already keeps and must agree with the figure the app shows elsewhere (RULE 2):
// loan principal ↔ repaidAmount, stock closing ↔ computeStock, deposit balance ↔ balanceAfter.
// Run: node scripts/test-subsidiary-ledgers.mjs
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const L = await imp('src/lib/registers/subsidiaryLedgers.ts');
const T = await imp('src/lib/registers/ledgerTables.ts');
const { computeStock, computeStockValue, computeStockCostRate } = await imp('src/lib/stockUtils.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. Deposit Ledger ──
{
  const tx = (id, date, txnType, amount, balanceAfter) => ({ id, depositAccountId: 'd1', date, txnType, amount, mode: 'cash', balanceAfter, createdAt: `${date}T0${id}` });
  const l = L.depositLedger([tx('3', '2026-05-01', 'withdraw', 200, 1300), tx('1', '2026-04-01', 'open', 1000, 1000), tx('2', '2026-04-15', 'deposit', 500, 1500), tx('4', '2026-06-30', 'interest', 10, 1310)]);
  ok(l.rows.map((r) => r.balance).join() === '1000,1500,1300,1310', `sorted by date, running balance (${l.rows.map((r) => r.balance)})`);
  ok(l.totalCredit === 1510 && l.totalDebit === 200 && l.closing === 1310 && !l.mismatch, 'totals + closing; arithmetic agrees with the recorded balance');
  const bad = L.depositLedger([tx('1', '2026-04-01', 'open', 1000, 1000), tx('2', '2026-04-02', 'deposit', 500, 1600)]);
  ok(bad.mismatch && bad.closing === 1600, 'a recorded balance that disagrees is SHOWN as recorded and flagged, never silently recomputed');
  const t = T.depositLedgerTable(l, { accountNo: 'SB-1', memberName: 'Ram', type: 'Savings (SB)' });
  ok(t.totals.length === t.columns.length && t.rowsEn.every((r) => r.length === t.columns.length), 'deposit table: one cell per column');
}

// ── 2. Loan Ledger ──
{
  const inc = (id) => id === '4408';
  const v = (id, date, refType, refId, narration, lines, extra = {}) => ({ id, voucherNo: id.toUpperCase(), date, amount: lines[0].amount, narration, debitAccountId: '3301', creditAccountId: '3304', lines, refType, refId, ...extra });
  const vouchers = [
    v('d1', '2026-04-01', undefined, undefined, 'Loan disbursed', [{ accountId: '3304', type: 'Dr', amount: 10000 }, { accountId: '3301', type: 'Cr', amount: 10000 }]),
    v('acc1', '2026-06-30', undefined, undefined, 'Member Loan Interest Accrual', [{ accountId: '3313', type: 'Dr', amount: 300 }, { accountId: '4408', type: 'Cr', amount: 300 }]),
    v('r1', '2026-07-10', 'loan.repayment', 'L1', 'Loan repayment — Ram (L-1)', [{ accountId: '3301', type: 'Dr', amount: 2300 }, { accountId: '3304', type: 'Cr', amount: 2000 }, { accountId: '3313', type: 'Cr', amount: 300 }]),
    // An older receipt, from before refType existed: matched by the app's own narration.
    v('r0', '2026-05-10', undefined, undefined, 'Loan repayment — Ram (L-1) incl. interest ₹50', [{ accountId: '3301', type: 'Dr', amount: 1050 }, { accountId: '3304', type: 'Cr', amount: 1000 }, { accountId: '4408', type: 'Cr', amount: 50 }]),
    v('rx', '2026-07-11', 'loan.repayment', 'L2', 'Loan repayment — Shyam (L-2)', [{ accountId: '3301', type: 'Dr', amount: 999 }, { accountId: '3304', type: 'Cr', amount: 999 }]),
    v('r10', '2026-07-12', undefined, undefined, 'Loan repayment — Mohan (L-10)', [{ accountId: '3301', type: 'Dr', amount: 777 }, { accountId: '3304', type: 'Cr', amount: 777 }]),
    v('rdel', '2026-07-13', 'loan.repayment', 'L1', 'Loan repayment — Ram (L-1)', [{ accountId: '3301', type: 'Dr', amount: 555 }, { accountId: '3304', type: 'Cr', amount: 555 }], { isDeleted: true }),
    v('rel', '2026-07-10', 'loan.interest.release', 'L1', 'Overdue interest recovered — Ram (L-1)', [{ accountId: '2211', type: 'Dr', amount: 100 }, { accountId: '4408', type: 'Cr', amount: 100 }]),
  ];
  const accruals = [
    { id: 'a1', loanId: 'L1', periodFrom: '2026-04-01', periodTo: '2026-06-30', amount: 300, overdue: false, voucherId: 'acc1' },
    { id: 'a2', loanId: 'L1', periodFrom: '2026-07-01', periodTo: '2026-07-31', amount: 99, overdue: false, voucherId: 'gone' },
    { id: 'a3', loanId: 'L1', periodFrom: '2026-08-01', periodTo: '2026-08-31', amount: 88, overdue: false, voucherId: 'acc1', isDeleted: true },
  ];
  const input = L.memberLoanLedgerInput({ id: 'L1', loanNo: 'L-1', amount: 10000, disbursementDate: '2026-04-01', voucherId: 'd1', repaidAmount: 3000 });
  const l = L.loanLedger(input, vouchers, accruals, inc);
  ok(l.totals.disbursed === 10000 && l.rows[0].voucherNo === 'D1', 'disbursement with its voucher number');
  ok(l.totals.principalRecovered === 3000 && l.closingPrincipal === 7000, `principal: tagged + legacy-narration repayments; other loan, "(L-10)" and deleted receipts excluded (${l.totals.principalRecovered})`);
  ok(l.totals.interestCharged === 300, 'interest charged = live accruals only (cancelled journal / deleted row excluded)');
  ok(l.totals.interestReceived === 350, 'interest received = receivable cleared (3313) + interest to income');
  ok(!l.mismatch, 'ties to repaidAmount on the loan');
  ok(l.rows.map((r) => r.date).join() === '2026-04-01,2026-05-10,2026-06-30,2026-07-10', 'date order; the reserve-release journal is not a repayment');
  ok(L.loanLedger({ ...input, recordedRepaid: 2500 }, vouchers, accruals, inc).mismatch, 'repaidAmount ≠ vouchers ⇒ flagged');
  const legacyNoLines = [{ id: 'q', voucherNo: 'Q', date: '2026-05-01', amount: 400, narration: 'Loan repayment — X (L-9)', debitAccountId: '3301', creditAccountId: '3304' }];
  ok(L.loanLedger(L.memberLoanLedgerInput({ id: 'L9', loanNo: 'L-9', amount: 400, disbursementDate: '2026-04-01', repaidAmount: 400 }), legacyNoLines, [], inc).closingPrincipal === 0, 'single-entry legacy receipt (no lines) counts as principal');
  const k = L.kccLedgerInput({ id: 'K1', loanNo: 'K-1', drawnAmount: 50000, disbursementDate: '2026-04-01', repaidAmount: 0 });
  ok(k.disbursedAmount === 50000 && k.loanId === 'K1', 'KCC: drawn amount is the disbursement');
  const t = T.loanLedgerTable(l, { loanNo: 'L-1', memberName: 'Ram', kind: 'Member loan', recordedOutstanding: 7000 });
  ok(t.totals.length === t.columns.length && t.rowsEn.every((r) => r.length === t.columns.length) && t.rowsHi.length === t.rowsEn.length, 'loan table: one cell per column');
}

// ── 3. Stock Register — closing = computeStock, always ──
{
  const m = (id, date, type, qty) => ({ id, date, itemId: 'i1', type, qty, rate: 10, amount: Math.abs(qty) * 10, referenceNo: `R${id}`, narration: '', createdAt: date });
  const item = { id: 'i1', openingStock: 10, purchaseRate: 10 };
  const mv = [m('2', '2026-04-05', 'sale', 8), m('1', '2026-04-01', 'purchase', 5), m('3', '2026-04-06', 'adjustment', -3), m('4', '2026-04-07', 'adjustment', 2), { ...m('x', '2026-04-01', 'purchase', 99), itemId: 'other' }];
  const s = L.stockRegister(item, mv);
  ok(s.rows.map((r) => r.balance).join() === '15,7,4,6' && s.totalIn === 7 && s.totalOut === 11, `inward/outward by the canonical rule (${s.rows.map((r) => r.balance)})`);
  ok(s.closing === computeStock(item, mv), 'closing = computeStock');
  const dip = L.stockRegister({ id: 'i1', openingStock: 0 }, [m('a', '2026-04-01', 'sale', 2), m('b', '2026-04-02', 'purchase', 5)]);
  ok(dip.wentNegative && dip.closing === 3, 'a dip below zero is flagged; closing still equals computeStock');
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let bad = 0;
  for (let n = 0; n < 300; n++) {
    const it = { id: 'i1', openingStock: Math.floor(rnd() * 20) };
    const ms = Array.from({ length: Math.floor(rnd() * 12) }, (_, j) => m(String(j), `2026-04-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`, ['purchase', 'sale', 'adjustment'][Math.floor(rnd() * 3)], Math.round((rnd() * 20 - 5) * 10) / 10));
    if (Math.abs(L.stockRegister(it, ms).closing - computeStock(it, ms)) > 0.001) bad++;
  }
  ok(bad === 0, `300 random items: register closing = computeStock (${bad} bad)`);
  const t = T.stockRegisterTable(s, { itemCode: 'U1', name: 'Urea', unit: 'bag' });
  ok(t.totals.length === t.columns.length && t.rowsEn.every((r) => r.length === t.columns.length), 'stock table: one cell per column');
  // 2026-10-10: rate + value on opening and closing (the register printed only quantities)
  let badV = 0; seed = 11;
  for (let n = 0; n < 300; n++) {
    const it = { id: 'i1', openingStock: Math.floor(rnd() * 20), purchaseRate: Math.round(rnd() * 500) };
    const ms = Array.from({ length: Math.floor(rnd() * 12) }, (_, j) => ({ ...m(String(j), `2026-04-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`, ['purchase', 'sale', 'adjustment'][Math.floor(rnd() * 3)], Math.round((rnd() * 20 - 5) * 10) / 10), rate: Math.round(rnd() * 600) }));
    const r = L.stockRegister(it, ms);
    if (Math.abs(r.closingValue - computeStockValue(it, ms)) > 0.02 * Math.max(1, r.closing) || Math.abs(r.closingRate - Math.round(computeStockCostRate(it, ms) * 100) / 100) > 0.001) badV++;
  }
  ok(badV === 0, `300 random items: register closing value / rate = Inventory computeStockValue / cost rate (${badV} bad)`);
  const o = L.stockRegister({ id: 'i9', openingStock: 10, purchaseRate: 25 }, []);
  ok(o.openingRate === 25 && o.openingValue === 250 && o.closingRate === 25 && o.closingValue === 250, 'no movement: opening and closing both 10 × ₹25 = ₹250 (was blank)');
  const ot = T.stockRegisterTable(o, { itemCode: 'X', name: 'X', unit: 'bag' });
  ok(ot.rowsEn[0][6] === 25 && ot.rowsEn[0][7] === 250 && ot.totals[6] === 25 && ot.totals[7] === 250, 'opening + closing rows print rate and amount');
  const sum = T.stockSummaryTable([{ itemCode: 'A', name: 'A', unit: 'kg', register: o }, { itemCode: 'B', name: 'B', unit: 'bag', register: L.stockRegister({ id: 'b', openingStock: 4, purchaseRate: 100 }, []) }], (u) => u.toUpperCase());
  ok(sum.rowsEn.length === 2 && sum.totals[9] === 650 && sum.totals[4] === 650 && sum.rowsEn[0][2] === 'KG', 'all-items summary: one row per item, value total ₹250 + ₹400 = ₹650');
  ok(sum.totals.length === sum.columns.length && sum.rowsEn.every((r) => r.length === sum.columns.length), 'summary table: one cell per column');
}

// ── 4. Wiring ──
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
ok(/stockRegister\(it, reconciledStockMovements\)/.test(read('src/pages/Inventory.tsx')), 'Inventory register reads the SAME reconciled movements as its quantity column');
ok(/ledgerPdf\(society, allItemsSummary\(\), 'STR', 'Stock_Register'\)/.test(read('src/pages/Inventory.tsx')) && /ledgerExcel\(allItemsSummary\(\)/.test(read('src/pages/Inventory.tsx')), 'all-items Stock Register PDF / Excel = the one-page summary (not one page per item)');
ok(/loanLedger\(memberLoanLedgerInput\(l\), vouchers, accruals, isIncome\)/.test(read('src/pages/LoanRegister.tsx')), 'member loan ledger from live vouchers + accruals');
ok(/loanLedger\(kccLedgerInput\(k\), vouchers, accruals, isIncome\)/.test(read('src/pages/KccLoan.tsx')), 'KCC ledger from live vouchers + accruals');
ok(/depositLedger\(getDepositTransactions\(d\.id\), voucherNoOf\)/.test(read('src/pages/Deposits.tsx')), 'deposit ledger from the recorded deposit transactions');

console.log(`Subsidiary ledgers: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
