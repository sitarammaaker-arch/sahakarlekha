// Credit terms and the late-payment charge (lib/lateFee). Calculation only; nothing here posts.
// Run: node scripts/test-late-fee.mjs   (npm run test:late-fee)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const out = join(mkdtempSync(join(tmpdir(), 'late-')), 'bundle.cjs');
await build({ entryPoints: [join(ROOT, 'src/lib/lateFee.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src') }, absWorkingDir: ROOT });
const { addDays, billTerms, billPaymentsMap, computeLateFee, daysOverdue, isActiveRule, resolveLateFeeRule, describeLateFeeRule, withAdjustedReturns } = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

const pct18 = { type: 'percent', rate: 18 };
const due = '2026-04-16';       // bill 1 Apr + 15 days
const fee = (rule, payments, asOf, total = 100000, extra = {}) => computeLateFee({ total, dueDate: due, rule, payments, asOf, ...extra });

// ── due date ──
eq(addDays('2026-04-01', 15), '2026-04-16', 'due date');
eq(addDays('2026-12-25', 15), '2027-01-09', 'due date over the year end');
eq(addDays('2028-02-20', 15), '2028-03-06', 'due date over a leap February');

// ── the plan's worked example: 40,000 ten days late, 60,000 thirty days late ──
const example = fee(pct18, [{ date: '2026-04-26', amount: 40000 }, { date: '2026-05-16', amount: 60000 }], '2026-06-30');
eq(example.amount, 1084.93, 'part payments: the plan example');
eq(example.lateDays, 30, 'part payments: late days stop when cleared');
eq(example.balance, 0, 'part payments: nothing left');

// ── no late, no fee ──
eq(fee(pct18, [], '2026-04-16').amount, 0, 'on the due date: no charge');
eq(fee(pct18, [], '2026-04-10').amount, 0, 'before the due date: no charge');
eq(fee(pct18, [{ date: '2026-04-10', amount: 100000 }], '2026-12-31').amount, 0, 'paid early: no charge ever');
eq(fee(pct18, [{ date: '2026-04-16', amount: 100000 }], '2026-12-31').amount, 0, 'paid on the due date: no charge');

// ── one late day ──
eq(fee(pct18, [], '2026-04-17').lateDays, 1, 'day after due = 1 late day');
eq(fee(pct18, [], '2026-04-17').amount, 49.32, '1 late day: 100000 x 18% / 365');

// ── grace ──
const grace = { ...pct18, graceDays: 10 };
eq(fee(grace, [], '2026-04-26').amount, 0, 'inside grace: no charge');
eq(fee(grace, [{ date: '2026-04-20', amount: 100000 }], '2026-12-31').amount, 0, 'paid inside grace: no charge');
eq(fee(grace, [], '2026-04-27').lateDays, 1, 'first day after grace = 1 late day');
eq(fee(grace, [{ date: '2026-04-20', amount: 40000 }], '2026-04-27').amount, 29.59, 'a payment inside grace lowers the balance charged');

// ── payments ──
eq(fee(pct18, [{ date: '2026-05-16', amount: 100000 }], '2026-04-20').lateDays, 4, 'a payment after asOf is ignored');
eq(fee(pct18, [{ date: '2026-05-16', amount: 100000 }], '2026-04-20').balance, 100000, 'balance on asOf ignores later payments');
eq(fee(pct18, [{ date: '2026-05-16', amount: 60000 }, { date: '2026-04-26', amount: 40000 }], '2026-06-30').amount, 1084.93, 'payment order does not matter');
eq(fee(pct18, [{ date: '2026-04-26', amount: 150000 }], '2026-12-31').lateDays, 10, 'overpayment stops the charge');
eq(fee(pct18, [{ date: '2026-04-26', amount: 150000 }], '2026-12-31').balance, 0, 'overpayment: no negative balance');
eq(fee(pct18, [{ date: '2026-04-26', amount: 0 }], '2026-04-26').lateDays, 10, 'a zero payment changes nothing');

// ── never compounds, follows the day count ──
eq(fee(pct18, [], '2027-04-16', 100000).amount, 18000, 'a full year = simple 18%, not compounded');
eq(fee(pct18, [], '2027-04-16', 100000, { basis: '360' }).amount, 18250, '360 day count');

// ── the penalty types ──
eq(fee({ type: 'flat', rate: 500 }, [], '2026-04-17').amount, 500, 'flat: charged once');
eq(fee({ type: 'flat', rate: 500 }, [], '2026-12-31').amount, 500, 'flat: does not grow');
eq(fee({ type: 'flat', rate: 500 }, [{ date: '2026-04-10', amount: 100000 }], '2026-12-31').amount, 0, 'flat: not when paid on time');
eq(fee({ type: 'perDay', rate: 10 }, [], '2026-04-26').amount, 100, 'per day');
eq(fee({ type: 'perDay', rate: 10 }, [{ date: '2026-04-21', amount: 100000 }], '2026-12-31').amount, 50, 'per day stops when cleared');
eq(fee({ type: 'perMonth', rate: 100 }, [], '2026-05-16').amount, 100, 'per month: 30 days = 1');
eq(fee({ type: 'perMonth', rate: 100 }, [], '2026-05-17').amount, 200, 'per month: day 31 starts the second');

// ── a bill with no terms never gets a charge ──
eq(fee(undefined, [], '2027-01-01').amount, 0, 'no rule on the bill');
eq(computeLateFee({ total: 100000, dueDate: undefined, rule: pct18, payments: [], asOf: '2027-01-01' }).amount, 0, 'no due date');
eq(fee({ type: 'none', rate: 18 }, [], '2027-01-01').amount, 0, "type 'none'");
eq(fee({ type: 'percent', rate: 0 }, [], '2027-01-01').amount, 0, 'zero rate');
eq(fee({ type: 'percent', rate: -5 }, [], '2027-01-01').amount, 0, 'negative rate');

// ── which rule applies ──
const soc = { type: 'percent', rate: 12 };
eq(resolveLateFeeRule(undefined, soc), soc, 'society rule by default');
eq(resolveLateFeeRule(pct18, soc), pct18, 'the party rule wins');
eq(resolveLateFeeRule({ type: 'none', rate: 0 }, soc), undefined, 'a party can be exempt');
eq(resolveLateFeeRule(undefined, undefined), undefined, 'off by default');
ok(!isActiveRule(null), 'null is not active');

// ── terms stored on a bill ──
const t = billTerms({ paymentMode: 'credit', date: '2026-04-01', creditDays: 15, rule: pct18 });
ok(t.creditDays === 15 && t.dueDate === due && t.lateFeeRule === pct18, 'credit bill gets days, due date and rule');
const cash = billTerms({ paymentMode: 'cash', date: '2026-04-01', creditDays: 15, rule: pct18 });
ok(cash.creditDays === null && cash.dueDate === null && cash.lateFeeRule === null, 'cash bill: everything cleared');
eq(billTerms({ paymentMode: 'credit', date: '2026-04-01', partyCreditDays: 30 }).dueDate, '2026-05-01', 'not stated: the party default');
eq(billTerms({ paymentMode: 'credit', date: '2026-04-01', creditDays: null, partyCreditDays: 30 }).dueDate, null, 'null means none, not the party default');
eq(billTerms({ paymentMode: 'credit', date: '2026-04-01', creditDays: 0, rule: pct18 }).lateFeeRule, null, 'no days: no rule');
eq(billTerms({ paymentMode: 'credit', date: '2026-04-01', creditDays: 15, rule: soc, original: { paymentMode: 'credit', lateFeeRule: pct18 } }).lateFeeRule, pct18, 'editing keeps the frozen rule');
eq(billTerms({ paymentMode: 'credit', date: '2026-04-01', creditDays: 15, rule: soc, original: { paymentMode: 'credit' } }).lateFeeRule, null, 'an old credit bill never gains a rule');
eq(billTerms({ paymentMode: 'credit', date: '2026-04-01', creditDays: 15, rule: soc, original: { paymentMode: 'cash' } }).lateFeeRule, soc, 'cash turned into credit takes the current rule');

// ── overdue days ──
eq(daysOverdue(due, '2026-04-20'), 4, 'overdue days');
eq(daysOverdue(due, '2026-04-10'), 0, 'not yet due');
eq(daysOverdue(null, '2026-04-20'), 0, 'no due date');

// ── payments come from the same allocations as the bill balance ──
const map = billPaymentsMap([
  { date: '2026-04-26', billAllocations: [{ billId: 'A', amount: 40000 }, { saleId: 'B', amount: 5 }] },
  { date: '2026-04-27', isDeleted: true, billAllocations: [{ billId: 'A', amount: 999 }] },
  { date: '2026-04-28', billAllocations: [{ billId: 'A', amount: 7, method: 'advance' }] },
  { date: '2026-04-29' },
]);
eq(map.A.length, 1, 'deleted vouchers and advances do not count');
eq(map.A[0].date, '2026-04-26', 'payment keeps the voucher date');
eq(map.B[0].amount, 5, 'legacy saleId allocations count');

// ── returns: only one adjusted against the account lowers what is owed ──
const ret = withAdjustedReturns({ A: [{ date: '2026-04-26', amount: 40000 }] }, [
  { billId: 'A', date: '2026-04-26', grandTotal: 10000, refundMode: 'credit-adjust' },
  { billId: 'A', date: '2026-04-26', grandTotal: 500, refundMode: 'cash' },
  { billId: 'A', date: '2026-04-26', grandTotal: 700, refundMode: 'bank' },
  { billId: 'A', date: '2026-04-26', grandTotal: 900, refundMode: 'credit-adjust', isDeleted: true },
  { billId: 'B', date: '2026-04-20', grandTotal: 50, refundMode: 'credit-adjust' },
]);
eq(ret.A.length, 2, 'cash, bank and deleted returns do not count');
eq(ret.B[0].amount, 50, 'a bill with no payment can still have a return');
const returned = fee(pct18, withAdjustedReturns({}, [{ billId: 'X', date: '2026-04-26', grandTotal: 100000, refundMode: 'credit-adjust' }]).X, '2026-12-31');
eq(returned.lateDays, 10, 'a fully returned bill stops running on the return date');
eq(returned.balance, 0, 'a fully returned bill owes nothing');
const src = { A: [] };
withAdjustedReturns(src, [{ billId: 'A', date: '2026-04-26', grandTotal: 1, refundMode: 'credit-adjust' }]);
eq(src.A.length, 0, 'the payments passed in are not changed');

// ── wording ──
ok(describeLateFeeRule(pct18, false).includes('18%'), 'English wording');
ok(describeLateFeeRule(grace, true).includes('10 दिन'), 'Hindi wording with grace');

// ── the terms reach the paper: real PDFs (esbuild bundle + jsPDF node build) ──
const shim = join(dirname(out), 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const entry = join(dirname(out), 'pdf-entry.ts');
writeFileSync(entry, `
import jsPDF from 'jspdf';
import * as pdf from '@/lib/pdf';
(globalThis as any).window = (globalThis as any).window || {};
let last: any = null;
(jsPDF as any).API.save = function () { last = this; };
const society: any = { name: 'Test Society', registrationNo: 'R-1', financialYear: '2026-27', address: 'x', district: 'y', state: 'hr' };
const base = { date: '2026-04-01', items: [{ itemName: 'Seed', unit: 'kg', qty: 1, rate: 100, amount: 100 }], totalAmount: 100, discount: 0, netAmount: 100, cgstPct: 0, sgstPct: 0, igstPct: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, taxAmount: 0, grandTotal: 100, narration: '' };
const invoice = (extra: any) => { pdf.generateSaleInvoicePDF({ ...base, saleNo: 'SL/1', customer: { name: 'Ram' }, paymentMode: 'credit', ...extra } as any, society); return last.output(); };
const record = (extra: any) => { pdf.generatePurchaseRecordPDF({ ...base, purchaseNo: 'PUR/1', supplier: { name: 'Shyam' }, tdsPct: 0, tdsAmount: 0, tcsPct: 0, tcsAmount: 0, paymentMode: 'credit', ...extra } as any, society); return last.output(); };
module.exports = { invoice, record };
`);
const pdfOut = join(dirname(out), 'pdf-bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: pdfOut, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT });
const { invoice, record } = createRequire(import.meta.url)(pdfOut);
const terms = { creditDays: 15, dueDate: '2026-04-16' };
const withRule = invoice({ ...terms, lateFeeRule: { type: 'percent', rate: 18, graceDays: 5 } });
ok(withRule.includes('Credit: 15 days') && withRule.includes('Due date: 16/04/2026'), 'invoice prints the credit days and due date');
ok(withRule.includes('Late interest 18% a year, after 5 grace days'), 'invoice prints the rule');
const noRule = invoice(terms);
ok(noRule.includes('Due date: 16/04/2026') && !noRule.includes('After the due date'), 'no rule: due date only');
ok(!invoice({}).includes('Due date:'), 'no terms: nothing printed');
ok(record(terms).includes('Due date: 16/04/2026'), 'purchase record prints the due date');
ok(!record({}).includes('Due date:'), 'purchase record without terms: nothing printed');

console.log(`late fee: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
