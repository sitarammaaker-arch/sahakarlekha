// Cash / bank bills on a party's ledger statement + the s.186 cash-receipt warning (founder 2026-10-09, option 1).
//   • a cash/bank sale or purchase never posts to the party (Dr Cash / Cr Sales) — the statement lists it as a memo
//   • the memo never changes the party's balance; credit bills, deleted bills, other parties, out-of-range dates excluded
//   • s.186 Income-tax Act 2025: ₹2,00,000 or more in cash from one person in a day / one bill → WARNING (never a block)
//   • the rule is dated and sourced; the unread 1961-Act row never warns
// Imports the REAL src/lib files; wiring is checked in the source (house style).
//
// Run: node scripts/test-cash-bills-statement.mjs   (npm run test:cash-bills-statement)
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src');
const imp = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const { directBillsForAccount, sameDayCashFromCustomer } = await imp('lib/directBills.ts');
const { cashReceiptWarning, cashReceiptRule, CASH_RECEIPT_RULES } = await imp('lib/rules/cashReceiptLimit.ts');
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Which bills show
const customers = [{ id: 'c1', accountId: 'A-SUMIT' }, { id: 'c2', accountId: 'A-OTHER' }];
const suppliers = [{ id: 's1', accountId: 'A-SUP' }];
const sales = [
  { id: 'x1', saleNo: 'SL/007', date: '2026-10-08', grandTotal: 1575, paymentMode: 'credit', customerId: 'c1' },
  { id: 'x2', saleNo: 'SL/008', date: '2026-10-09', grandTotal: 10500, paymentMode: 'cash', customerId: 'c1' },
  { id: 'x3', saleNo: 'SL/009', date: '2026-10-09', grandTotal: 500, paymentMode: 'bank', customerId: 'c1' },
  { id: 'x4', saleNo: 'SL/010', date: '2026-10-09', grandTotal: 900, paymentMode: 'cash', customerId: 'c1', isDeleted: true },
  { id: 'x5', saleNo: 'SL/011', date: '2026-10-09', grandTotal: 700, paymentMode: 'cash', customerId: 'c2' },
  { id: 'x6', saleNo: 'SL/012', date: '2026-10-09', grandTotal: 300, paymentMode: 'cash' },
];
const purchases = [{ id: 'p1', purchaseNo: 'PU/001', date: '2026-10-01', grandTotal: 4000, paymentMode: 'cash', supplierId: 's1' }];
const data = { customers, suppliers, sales, purchases };
const sumit = directBillsForAccount('A-SUMIT', data);
ok(sumit.map(b => b.no).join() === 'SL/008,SL/009', 'Sumit: the cash + the bank sale (the credit sale is already in the ledger)');
ok(sumit[0].mode === 'cash' && sumit[1].mode === 'bank' && sumit[0].amount === 10500, 'mode + amount carried');
ok(!sumit.some(b => b.no === 'SL/010'), 'a deleted sale is not listed');
ok(directBillsForAccount('A-SUP', data).map(b => `${b.kind}:${b.no}`).join() === 'purchase:PU/001', 'a supplier gets its cash purchases');
ok(directBillsForAccount('A-SUMIT', data, { from: '2026-10-10' }).length === 0 && directBillsForAccount('A-SUMIT', data, { to: '2026-10-08' }).length === 0, 'date range respected');
ok(directBillsForAccount('A-SUMIT', data, { inScope: () => false }).length === 0, 'branch scope respected');
ok(directBillsForAccount('A-NOBODY', data).length === 0 && directBillsForAccount('', data).length === 0, 'a non-party account lists nothing');

// 2. s.186 warning
ok(cashReceiptRule('2026-10-09')?.section.includes('186') && cashReceiptRule('2026-10-09').verified, '2026-27 date → s.186 (Income-tax Act 2025), verified');
ok(CASH_RECEIPT_RULES.find(r => r.verified).sources.some(u => u.includes('indiankanoon.org') || u.includes('incometaxindia.gov.in')), 'the verified row cites its source');
ok(cashReceiptWarning('2026-10-09', 199999) === null, '₹1,99,999 → no warning');
const w1 = cashReceiptWarning('2026-10-09', 200000);
ok(w1 && w1.single && w1.limit === 200000, 'exactly ₹2,00,000 in one bill → warning ("or more")');
const w2 = cashReceiptWarning('2026-10-09', 50000, 150000);
ok(w2 && !w2.single && w2.total === 200000, 'same customer, same day: ₹1.5 L earlier + ₹50 k now → warning');
ok(cashReceiptWarning('2026-03-15', 500000) === null, 'a date under the (unread) 1961-Act row never warns');
ok(sameDayCashFromCustomer(sales, 'c1', '2026-10-09') === 10500 && sameDayCashFromCustomer(sales, 'c1', '2026-10-09', 'x2') === 0, 'same-day cash counts only live cash sales of that customer, minus the bill being edited');
ok(sameDayCashFromCustomer(sales, undefined, '2026-10-09') === 0, 'walk-in buyer: only the single-bill test');

// 3. Wiring
const ledger = read('pages/Ledger.tsx');
ok(/directBillsForAccount\(selectedAccountId/.test(ledger) && /नकद \/ बैंक बिल \(हिसाब पर असर नहीं\)/.test(ledger), 'Ledger page lists the memo, Hindi-first');
ok(/generateLedgerPDF\(pdfEntries, selectedAccount, society, 'en', fromDate, toDate, directBills\)/.test(ledger), '…and hands it to the PDF');
const pdf = read('lib/pdf.ts');
ok(/Cash \/ bank bills \(settled at once - not posted to this account; balance unaffected\)/.test(pdf), 'the PDF prints the memo after the statement');
ok(!/runningBalance[^\n]*directBills|directTotal[^\n]*balance/.test(ledger), 'the memo never feeds the running balance');
const sale = read('pages/SaleManagement.tsx');
ok(/paymentMode === 'cash'\s*\?\s*cashReceiptWarning\(saleDate, grandTotal, sameDayCashFromCustomer\(/.test(sale) && /cashReceiptWarningText\(cashWarning/.test(sale), 'sale form shows the s.186 warning for cash');
ok(!/if \(cashWarning\)[^\n]*return/.test(sale), 'the warning never blocks the save');

console.log(`Cash bills statement + s.186: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
