// K1 · computeTrialBalance (lib/reports/trialBalance) — the voucher-state trial balance, lifted out of
// DataContext. Hand-computed cases: openings + ECR-17 branch scope, as-of date, Phase-2 C FY fold,
// orphan legs, T-02 paise exactness, multi-line vouchers.
//
// Run: node scripts/test-trial-balance.mjs   (npm run test:trial-balance)


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
let computeTrialBalance;
try {
  ({ computeTrialBalance } = await import(abs('../src/lib/reports/trialBalance.ts')));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/reports/trialBalance.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};

const acct = (id, openingBalance = 0, openingBalanceType = 'debit', extra = {}) =>
  ({ id, name: id, nameHi: id, type: 'asset', openingBalance, openingBalanceType, ...extra });
const legacy = (id, date, dr, cr, amount) => ({ id, date, debitAccountId: dr, creditAccountId: cr, amount });
const multi = (id, date, lines) => ({ id, date, amount: 0, lines: lines.map(([accountId, type, amount], i) => ({ id: `${id}-${i}`, accountId, type, amount })) });
const row = (tb, id) => tb.find(r => r.account.id === id);
const sum = (tb, k) => Math.round(tb.reduce((s, r) => s + r[k], 0) * 100) / 100;

const accounts = [
  acct('CASH', 1000, 'debit'),
  acct('SHARE', 1000, 'credit'),
  acct('SALES', 0, 'credit'),
  acct('GROUP', 0, 'debit', { isGroup: true }),
];

// 1. Openings + one-year transactions; TB balances; group accounts are skipped.
{
  const tb = computeTrialBalance({ accounts, vouchers: [legacy('v1', '2026-05-01', 'CASH', 'SALES', 250)], fyStart: '2026-04-01', openingsInScope: true });
  check('group accounts are not rows', !row(tb, 'GROUP') && tb.length === 3);
  check('CASH opening Dr 1000, txn Dr 250, net 1250', row(tb, 'CASH').openingDebit === 1000 && row(tb, 'CASH').transactionDebit === 250 && row(tb, 'CASH').netBalance === 1250);
  check('SALES txn Cr 250, net -250', row(tb, 'SALES').transactionCredit === 250 && row(tb, 'SALES').netBalance === -250);
  check('TB balances (Σ Dr = Σ Cr)', sum(tb, 'totalDebit') === sum(tb, 'totalCredit'));
}

// 2. ECR-17: a branch view (openingsInScope=false) carries no openings.
{
  const tb = computeTrialBalance({ accounts, vouchers: [legacy('v1', '2026-05-01', 'CASH', 'SALES', 250)], fyStart: '2026-04-01', openingsInScope: false });
  check('branch scope: no openings', row(tb, 'CASH').openingDebit === 0 && row(tb, 'SHARE').openingCredit === 0 && row(tb, 'CASH').netBalance === 250);
}

// 3. as-of date excludes later vouchers (inclusive of the date itself).
{
  const vs = [legacy('a', '2026-05-01', 'CASH', 'SALES', 100), legacy('b', '2026-06-01', 'CASH', 'SALES', 50)];
  const tb = computeTrialBalance({ accounts, vouchers: vs, asOnDate: '2026-05-01', fyStart: '2026-04-01', openingsInScope: true });
  check('as-of 2026-05-01 counts only the 100', row(tb, 'CASH').transactionDebit === 100);
}

// 4. Phase-2 C: earlier-FY vouchers fold into ONE net opening; txn columns hold only this FY.
{
  const vs = [legacy('old', '2025-12-01', 'CASH', 'SALES', 300), legacy('new', '2026-05-01', 'CASH', 'SALES', 40)];
  const tb = computeTrialBalance({ accounts, vouchers: vs, fyStart: '2026-04-01', openingsInScope: true });
  check('CASH b/f = 1000 + 300 as Dr opening', row(tb, 'CASH').openingDebit === 1300 && row(tb, 'CASH').openingCredit === 0);
  check('CASH txn = this FY only (40)', row(tb, 'CASH').transactionDebit === 40);
  check('SALES b/f = Cr 300', row(tb, 'SALES').openingCredit === 300 && row(tb, 'SALES').openingDebit === 0);
  const noFold = computeTrialBalance({ accounts, vouchers: vs, fyStart: null, openingsInScope: true });
  check('no fyStart → no fold, net unchanged', row(noFold, 'CASH').transactionDebit === 340 && row(noFold, 'CASH').netBalance === row(tb, 'CASH').netBalance);
}

// 5. Legs on a missing account appear as a synthetic [Deleted] row so the TB still balances.
{
  const tb = computeTrialBalance({ accounts, vouchers: [legacy('o', '2026-05-01', 'CASH', 'GONE-ACCOUNT-1', 75)], fyStart: '2026-04-01', openingsInScope: true });
  const orphan = row(tb, 'GONE-ACCOUNT-1');
  check('orphan leg → synthetic row', !!orphan && orphan.account.name.startsWith('[Deleted]') && orphan.transactionCredit === 75);
  check('TB with orphan balances', sum(tb, 'totalDebit') === sum(tb, 'totalCredit'));
}

// 5b. Legs on an EXISTING account flagged as a group (a ledger flipped to group after entries — Assandh
//     5201 Salary, 2026-10-02) keep the real account and type, flagged — never a "[Deleted]" liability.
{
  const withGroup = [...accounts, { id: 'SAL', name: 'Salary', nameHi: 'वेतन', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isGroup: true }];
  const tb = computeTrialBalance({ accounts: withGroup, vouchers: [legacy('g', '2026-05-01', 'SAL', 'CASH', 500)], fyStart: '2026-04-01', openingsInScope: true });
  const r = row(tb, 'SAL');
  check('group-account legs keep the real name', !!r && r.account.name === 'Salary');
  check('…and the real type (expense, not liability)', r?.account.type === 'expense');
  check('…as a ledger, flagged postedToGroup', r?.account.isGroup === false && r?.postedToGroup === true && r?.transactionDebit === 500);
  check('TB with a group-posted row balances', sum(tb, 'totalDebit') === sum(tb, 'totalCredit'));
}

// 6. T-02: paise-exact over many legs (float accumulation drifts here).
{
  const vs = Array.from({ length: 1000 }, (_, i) => multi(`m${i}`, '2026-05-01', [['CASH', 'Dr', 0.1], ['SALES', 'Cr', 0.1]]));
  const tb = computeTrialBalance({ accounts, vouchers: vs, fyStart: '2026-04-01', openingsInScope: true });
  check('1000 × ₹0.10 = exactly ₹100', row(tb, 'CASH').transactionDebit === 100 && row(tb, 'SALES').transactionCredit === 100);
}

// 7. Multi-line vouchers use `lines`, not the legacy fields.
{
  const v = { ...multi('ml', '2026-05-01', [['CASH', 'Dr', 60], ['SALES', 'Cr', 40], ['SHARE', 'Cr', 20]]), debitAccountId: 'SALES', creditAccountId: 'CASH', amount: 999 };
  const tb = computeTrialBalance({ accounts, vouchers: [v], fyStart: '2026-04-01', openingsInScope: false });
  check('lines win over legacy fields', row(tb, 'CASH').transactionDebit === 60 && row(tb, 'SALES').transactionCredit === 40 && row(tb, 'SHARE').transactionCredit === 20);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll trial-balance checks passed.');
process.exitCode = failed ? 1 : 0;
