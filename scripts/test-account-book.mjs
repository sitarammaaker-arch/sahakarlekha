// K4 · computeCashBook / computeBankBook (lib/reports/accountBook) — the voucher-state Cash Book and
// Bank Book, lifted out of DataContext. Hand-computed cases: signed opening + ECR-17 scope, running
// balance, from-date carry-forward, to-date cut, deterministic tie-break, split legs, labels, missing account.
//
// Run: node scripts/test-account-book.mjs   (npm run test:account-book)


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
let M;
try {
  M = await import(abs('../src/lib/reports/accountBook.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/reports/accountBook.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { computeCashBook, computeBankBook } = M;

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
const acct = (id, openingBalance = 0, openingBalanceType = 'debit') => ({ id, name: 'N' + id, nameHi: 'H' + id, type: 'asset', openingBalance, openingBalanceType });
const accounts = [acct('3301', 1000, 'debit'), acct('B1', 200, 'credit'), acct('4101'), acct('6101')];
const v = (id, date, dr, cr, amount, extra = {}) => ({ id, date, createdAt: '2026-01-01T00:00', voucherNo: '', narration: '', debitAccountId: dr, creditAccountId: cr, amount, ...extra });
const cash = (vouchers, extra = {}) => computeCashBook({ accounts, vouchers, accountId: '3301', openingsInScope: true, ...extra });
const bals = (b) => b.entries.map(e => e.runningBalance).join(',');

// 1. Running balance from the signed opening; receipts in, payments out; particulars fall back to the other account.
{
  const b = cash([v('a', '2026-05-01', '3301', '4101', 300), v('b', '2026-05-02', '6101', '3301', 100, { narration: 'Rent' })]);
  check('opening 1000 in paise', b.openingMinor === 100000);
  check('running balance 1300, 1200', bals(b) === '1300,1200', bals(b));
  check('types receipt / payment', b.entries[0].type === 'receipt' && b.entries[1].type === 'payment');
  check('particulars: narration first, else the other account', b.entries[1].particulars === 'Rent' && b.entries[0].particulars === 'N4101');
}

// 2. ECR-17: a branch view starts from zero.
{
  const b = cash([v('a', '2026-05-01', '3301', '4101', 300)], { openingsInScope: false });
  check('branch scope: opening 0, balance 300', b.openingMinor === 0 && bals(b) === '300');
}

// 3. fromDate carries earlier movement into the starting balance; toDate cuts later rows.
{
  const vs = [v('a', '2026-04-10', '3301', '4101', 50), v('b', '2026-05-01', '3301', '4101', 10), v('c', '2026-06-01', '3301', '4101', 5)];
  const b = cash(vs, { fromDate: '2026-05-01', toDate: '2026-05-31' });
  check('from 05-01 to 05-31: one row, balance 1000 + 50 + 10', b.entries.length === 1 && bals(b) === '1060', bals(b));
  check('openingMinor stays the account opening (not the carried balance)', b.openingMinor === 100000);
}

// 4. Same date: createdAt, then voucherNo, then id decides the order (matches the ledger projection).
{
  const vs = [
    v('z', '2026-05-01', '3301', '4101', 1, { createdAt: '2026-01-02T00:00' }),
    v('y', '2026-05-01', '3301', '4101', 2, { createdAt: '2026-01-01T00:00', voucherNo: 'RV/2' }),
    v('x', '2026-05-01', '3301', '4101', 3, { createdAt: '2026-01-01T00:00', voucherNo: 'RV/1' }),
  ];
  check('tie-break order x, y, z', cash(vs).entries.map(e => e.id).join('') === 'xyz');
}

// 5. A voucher with two cash legs gives two rows.
{
  const multi = { ...v('m', '2026-05-01', '', '', 0), lines: [{ id: 'l1', accountId: '3301', type: 'Dr', amount: 40 }, { id: 'l2', accountId: '3301', type: 'Cr', amount: 15 }, { id: 'l3', accountId: '4101', type: 'Cr', amount: 25 }] };
  const b = cash([multi]);
  check('two cash legs → two rows (1040, 1025)', b.entries.length === 2 && bals(b) === '1040,1025', bals(b));
}

// 6. Bank book: deposit/withdrawal labels, an overdraft opening is negative, a missing account → null.
{
  const b = computeBankBook({ accounts, vouchers: [v('d', '2026-05-01', 'B1', '3301', 500), v('w', '2026-05-02', '6101', 'B1', 100)], accountId: 'B1', openingsInScope: true });
  check('bank: −200 + 500 − 100', bals(b) === '300,200' && b.openingMinor === -20000, bals(b));
  check('bank types deposit / withdrawal', b.entries[0].type === 'deposit' && b.entries[1].type === 'withdrawal');
  check('missing account → null', computeBankBook({ accounts, vouchers: [], accountId: 'NOPE', openingsInScope: true }) === null);
}

// 7. T-02: paise-exact running balance.
{
  const vs = Array.from({ length: 1000 }, (_, i) => v(`p${String(i).padStart(4, '0')}`, '2026-05-01', '3301', '4101', 0.1));
  const b = cash(vs);
  check('1000 × ₹0.10 → final balance exactly 1100', b.entries[b.entries.length - 1].runningBalance === 1100);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll cash / bank book checks passed.');
process.exit(failed ? 1 : 0);
