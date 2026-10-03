// K3 · computeReceiptsPayments (lib/reports/receiptsPayments) — the voucher-state Receipts & Payments
// Account, lifted out of DataContext. Hand-computed cases: signed openings + ECR-17 scope, split receipts
// booked once, contra excluded, net-of-TDS legs, non-cash journals excluded, as-of date, C-11/C-12
// capital vs revenue.
//
// Run: node scripts/test-receipts-payments.mjs   (npm run test:receipts-payments)


import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
      export async function load(url, ctx, next) {
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;
let computeReceiptsPayments;
try {
  ({ computeReceiptsPayments } = await import(abs('../src/lib/reports/receiptsPayments.ts')));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/reports/receiptsPayments.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
const acct = (id, parentId, type, openingBalance = 0, openingBalanceType = 'debit', extra = {}) =>
  ({ id, name: 'N' + id, nameHi: 'H' + id, type, parentId, openingBalance, openingBalanceType, ...extra });
// 3301 = Cash, 3302 = Bank group (B1 a bank), 1101 share capital (capital parent 1100), 4101 sales.
const accounts = [
  acct('3301', '3300', 'asset', 1000, 'debit'),
  acct('3302', '3300', 'asset', 0, 'debit', { isGroup: true }),
  acct('B1', '3302', 'asset', 500, 'credit'),
  acct('1101', '1100', 'liability'), acct('4101', '4100', 'income'), acct('6101', '6100', 'expense'),
  acct('2601', '2600', 'liability'), acct('5101', '5100', 'expense'),
];
const legacy = (id, date, dr, cr, amount) => ({ id, date, narration: '', debitAccountId: dr, creditAccountId: cr, amount });
const multi = (id, date, lines) => ({ id, date, narration: '', amount: 0, lines: lines.map(([accountId, type, amount], i) => ({ id: `${id}-${i}`, accountId, type, amount })) });
const rp = (vouchers, extra = {}) => computeReceiptsPayments({ accounts, vouchers, openingsInScope: true, ...extra });
const line = (list, id) => list.find(l => l.accountId === id);

// 1. Openings are signed by balance type (overdraft bank = negative); a branch view has none.
{
  const r = rp([]);
  check('opening cash +1000, opening bank −500 (overdraft)', r.data.openingCash === 1000 && r.data.openingBank === -500 && r.openingCashMinor === 100000 && r.openingBankMinor === -50000);
  check('bank ids come from the Bank group', JSON.stringify(r.bankIds) === JSON.stringify(['B1']), JSON.stringify(r.bankIds));
  const b = rp([], { openingsInScope: false });
  check('branch scope: no openings', b.data.openingCash === 0 && b.data.openingBank === 0);
}

// 2. A cash sale is a receipt; closing cash moves by it.
{
  const r = rp([legacy('s', '2026-05-01', '3301', '4101', 300)]).data;
  check('sales receipt 300, closing cash 1300', line(r.receipts, '4101')?.amount === 300 && r.closingCash === 1300 && r.payments.length === 0);
}

// 3. A split receipt (Dr Cash 600 / Dr Bank 400 / Cr Sales 1000) books Sales ONCE.
{
  const r = rp([multi('sp', '2026-05-01', [['3301', 'Dr', 600], ['B1', 'Dr', 400], ['4101', 'Cr', 1000]])]).data;
  check('split receipt booked once (1000, not 2000)', line(r.receipts, '4101')?.amount === 1000);
  check('closing cash 1600, closing bank −100', r.closingCash === 1600 && r.closingBank === -100);
}

// 4. A pure Cash↔Bank contra is not a receipt or payment (C-11).
{
  const r = rp([legacy('c', '2026-05-01', 'B1', '3301', 200)]).data;
  check('contra excluded', r.receipts.length === 0 && r.payments.length === 0 && r.closingCash === 800 && r.closingBank === -300);
}

// 5. Net-of-TDS payment: Dr Audit 10,000 / Cr Bank 9,000 / Cr TDS-payable 1,000 → net cash out 9,000.
{
  const r = rp([multi('t', '2026-05-01', [['6101', 'Dr', 10000], ['B1', 'Cr', 9000], ['2601', 'Cr', 1000]])]).data;
  check('payment 10,000 + TDS receipt 1,000 (net 9,000)', line(r.payments, '6101')?.amount === 10000 && line(r.receipts, '2601')?.amount === 1000);
}

// 6. A journal with no cash/bank leg is not in the R&P at all.
{
  const r = rp([legacy('j', '2026-05-01', '5101', '2601', 750)]).data;
  check('non-cash journal excluded', r.receipts.length === 0 && r.payments.length === 0);
}

// 7. as-of date drops later vouchers from both the lines and the closing balances.
{
  const vs = [legacy('a', '2026-05-01', '3301', '4101', 100), legacy('b', '2026-06-01', '3301', '4101', 50)];
  const r = computeReceiptsPayments({ accounts, vouchers: vs, asOnDate: '2026-05-01', openingsInScope: true }).data;
  check('as-of: receipt 100, closing cash 1100', line(r.receipts, '4101')?.amount === 100 && r.closingCash === 1100);
}

// 8. C-11/C-12: share capital is a CAPITAL receipt, sales are REVENUE; unknown accounts fall back.
{
  const r = rp([legacy('sc', '2026-05-01', '3301', '1101', 500), legacy('s', '2026-05-01', '3301', '4101', 20), legacy('g', '2026-05-01', '3301', 'GONE', 5)]).data;
  check('share capital = capital / liability', line(r.receipts, '1101')?.nature === 'capital' && line(r.receipts, '1101')?.glType === 'liability');
  check('sales = revenue / income', line(r.receipts, '4101')?.nature === 'revenue' && line(r.receipts, '4101')?.glType === 'income');
  check('missing account → "Deleted Account", revenue', line(r.receipts, 'GONE')?.accountName === 'Deleted Account' && line(r.receipts, 'GONE')?.nature === 'revenue');
}

// 9. T-02: paise-exact over many legs.
{
  const vs = Array.from({ length: 1000 }, (_, i) => legacy(`m${i}`, '2026-05-01', '3301', '4101', 0.1));
  const r = rp(vs).data;
  check('1000 × ₹0.10 = exactly ₹100', line(r.receipts, '4101')?.amount === 100 && r.closingCash === 1100);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll receipts & payments checks passed.');
process.exitCode = failed ? 1 : 0;
