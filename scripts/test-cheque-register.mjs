// Cheque Issue / Collection registers (HAFED Accounts Manual 1976, Proformas IV/1, IV/2).
// Imports the REAL src/lib/chequeRegister.ts via the "@/" loader.
// Run: node scripts/test-cheque-register.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { buildChequeRegister } = await import(abs('../src/lib/chequeRegister.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const acc = (id, name, o = {}) => ({ id, name, nameHi: `हि-${name}`, type: 'asset', openingBalance: 0, openingBalanceType: 'debit', ...o });
const accounts = [acc('3301', 'Cash'), acc('B1', 'SBI'), acc('B2', 'HDFC'), acc('S1', 'Hafed', { type: 'liability' }), acc('C1', 'Ram Traders'), acc('E1', 'Rent', { type: 'expense' })];
const bankIds = ['B1', 'B2'];
let n = 0;
const v = (o) => ({ id: `v${++n}`, voucherNo: `V/${n}`, type: 'payment', date: '2026-05-10', debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdAt: '', createdBy: '', ...o });
const vouchers = [
  v({ date: '2026-05-01', debitAccountId: 'S1', creditAccountId: 'B1', amount: 5000, chequeNo: ' 004512 ', chequeDate: '2026-05-01' }),           // issued, pending
  v({ date: '2026-05-02', type: 'receipt', debitAccountId: 'B1', creditAccountId: 'C1', amount: 1200, chequeNo: '778', isCleared: true, clearedDate: '2026-05-05' }), // received, realised
  v({ date: '2026-05-03', debitAccountId: 'E1', creditAccountId: 'B2', amount: 300 }),                                                          // bank, no cheque no.
  v({ date: '2026-05-04', debitAccountId: 'E1', creditAccountId: '3301', amount: 50, chequeNo: 'X' }),                                           // cash — never a cheque row
  v({ date: '2026-05-05', type: 'contra', debitAccountId: 'B2', creditAccountId: 'B1', amount: 700, chequeNo: '004513' }),                      // bank → bank: both registers
  v({ date: '2026-05-06', debitAccountId: 'S1', creditAccountId: 'B1', amount: 999, chequeNo: '004514', isDeleted: true }),                     // cancelled
  v({ date: '2026-05-07', debitAccountId: 'S1', creditAccountId: 'B1', amount: 888, chequeNo: '004515', approvalStatus: 'pending' }),           // pending approval
  v({ date: '2026-05-08', type: 'journal', debitAccountId: '', creditAccountId: '', amount: 0, chequeNo: '004516',
      lines: [{ id: 'a', accountId: 'S1', type: 'Dr', amount: 400 }, { id: 'b', accountId: 'E1', type: 'Dr', amount: 100 }, { id: 'c', accountId: 'B1', type: 'Cr', amount: 500 }] }),
  v({ date: '2026-06-20', debitAccountId: 'S1', creditAccountId: 'B1', amount: 10, chequeNo: '004520' }),                                       // outside a May range
];

const reg = buildChequeRegister({ vouchers, accounts, bankIds, today: '2026-05-31' });
ok(reg.issued.length === 4, `issued: 004512, 004513 (B1 side), 004516, 004520 (got ${reg.issued.map(r => r.chequeNo)})`);
ok(reg.received.length === 2, `received: 778, 004513 (B2 side) (got ${reg.received.map(r => r.chequeNo)})`);
const i1 = reg.issued[0];
ok(i1.serial === 1 && i1.chequeNo === '004512' && i1.party === 'Hafed' && i1.bankName === 'SBI' && i1.amount === 5000, 'issued row: trimmed no., party, bank, amount');
ok(i1.cleared === false && i1.daysPending === 30 && i1.chequeDate === '2026-05-01', 'pending 30 days as at 31 May');
const r1 = reg.received.find(r => r.chequeNo === '778');
ok(r1.party === 'Ram Traders' && r1.cleared && r1.clearedDate === '2026-05-05' && r1.daysPending === undefined, 'received row realised on the reconciliation date');
const contraIss = reg.issued.find(r => r.chequeNo === '004513');
const contraRec = reg.received.find(r => r.chequeNo === '004513');
ok(contraIss.bankName === 'SBI' && contraIss.party === 'HDFC' && contraRec.bankName === 'HDFC' && contraRec.party === 'SBI', 'bank-to-bank: each side names the other bank');
const multi = reg.issued.find(r => r.chequeNo === '004516');
ok(multi.amount === 500 && multi.party === 'Hafed, Rent', 'multi-line voucher: bank leg amount, every party named');
ok(!reg.issued.some(r => ['004514', '004515', 'X'].includes(r.chequeNo)), 'cancelled, pending and cash vouchers left out');
ok(reg.bankVouchersWithoutCheque === 1, 'one bank voucher has no cheque no.');
ok(reg.totals.issued.count === 4 && reg.totals.issued.amount === 6210 && reg.totals.issued.pendingCount === 4, `issued totals (got ${JSON.stringify(reg.totals.issued)})`);
ok(reg.totals.received.amount === 1900 && reg.totals.received.pendingCount === 1 && reg.totals.received.pendingAmount === 700, 'received totals');

const may = buildChequeRegister({ vouchers, accounts, bankIds, today: '2026-05-31', from: '2026-05-01', to: '2026-05-31' });
ok(!may.issued.some(r => r.chequeNo === '004520'), 'date range');
const sbi = buildChequeRegister({ vouchers, accounts, bankIds, today: '2026-05-31', bankId: 'B2' });
ok(sbi.issued.length === 0 && sbi.received.length === 1 && sbi.received[0].chequeNo === '004513', 'bank filter: HDFC only');
ok(sbi.bankVouchersWithoutCheque === 1, 'bank filter counts only that bank\'s vouchers without a cheque');
ok(buildChequeRegister({ vouchers, accounts, bankIds, today: '2026-05-31', hi: true }).issued[0].party === 'हि-Hafed', 'Hindi names');
ok(buildChequeRegister({ vouchers: [], accounts, bankIds, today: '2026-05-31' }).issued.length === 0, 'empty');

console.log(`\nCheque register: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
