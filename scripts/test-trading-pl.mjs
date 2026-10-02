// K2 · computeTradingAccount / computeProfitLoss (lib/reports/tradingAndProfitLoss) — the Trading A/c
// and P&L / I&E, lifted out of DataContext. Hand-computed cases: the GP formula, the legacy closing-
// journal gross-up (audit C-8), physical stock + ECR-17 scope, activity breakdown (C-7), and the
// trading vs service-society P&L (C-9).
//
// Run: node scripts/test-trading-pl.mjs   (npm run test:trading-pl)


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
  M = await import(abs('../src/lib/reports/tradingAndProfitLoss.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/reports/tradingAndProfitLoss.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { computeTradingAccount, computeProfitLoss } = M;

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
const bal = (id, parentId, type, netBalance, openingDebit = 0) =>
  ({ account: { id, name: 'N' + id, nameHi: 'H' + id, type, parentId, openingBalance: 0, openingBalanceType: 'debit' },
     openingDebit, openingCredit: 0, transactionDebit: 0, transactionCredit: 0, totalDebit: 0, totalCredit: 0, netBalance });
const base = { fy: '2026-27', effDate: '2027-03-31', vouchers: [], stockItems: [], movements: [], openingsInScope: true };

// 1. GP = Sales + Closing − Opening − Purchases − Direct expenses (no tracked items → ledger is closing stock).
{
  const tb = [bal('4101', '4100', 'income', -1000), bal('5101', '5100', 'expense', 600), bal('5120', '5100', 'expense', 50), bal('3403', '3400', 'asset', 200, 200)];
  const t = computeTradingAccount({ ...base, tb });
  check('sales 1000, purchases 600, direct exp 50', t.totalSales === 1000 && t.totalPurchases === 600 && t.totalDirectExp === 50);
  check('opening stock 200, closing stock 200 (from ledger)', t.totalOpeningStock === 200 && t.totalClosingStock === 200);
  check('gross profit = 1000 + 200 − 200 − 600 − 50 = 350', t.grossProfit === 350, String(t.grossProfit));
}

// 2. Audit C-8: a LEGACY closing journal (Dr 3403 / Cr 5101) reduced 5101 — Purchases are grossed back up.
{
  const tb = [bal('4101', '4100', 'income', -1000), bal('5101', '5100', 'expense', 300), bal('3403', '3400', 'asset', 300)];
  const vouchers = [{ id: 'cs', date: '2027-03-31', narration: 'Closing Stock at year end — FY 2026-27', amount: 300, debitAccountId: '3403', creditAccountId: '5101' }];
  const t = computeTradingAccount({ ...base, tb, vouchers });
  check('closing journal detected', t.closingStockPosted === true);
  check('purchases grossed up 300 → 600', t.totalPurchases === 600 && t.legacyPurchaseGrossUp === 300, JSON.stringify(t.purchaseItems));
  check('GP = 1000 + 300 − 600 = 700', t.grossProfit === 700, String(t.grossProfit));
  const other = computeTradingAccount({ ...base, tb, vouchers, fy: '2025-26' });
  check("another FY's journal is not this year's", other.closingStockPosted === false);
}

// 3. Physical stock (qty × cost) is the closing stock when no journal is posted; ECR-17 branch scope has none.
{
  const tb = [bal('4101', '4100', 'income', -500)];
  const stockItems = [{ id: 'S1', isActive: true, openingStock: 10, purchaseRate: 5 }, { id: 'S2', isActive: false, openingStock: 99, purchaseRate: 9 }];
  const t = computeTradingAccount({ ...base, tb, stockItems });
  check('physical closing stock = 10 × ₹5 (inactive item ignored)', t.physicalClosingStock === 50 && t.totalClosingStock === 50);
  const branch = computeTradingAccount({ ...base, tb, stockItems, openingsInScope: false });
  check('branch view: no physical stock', branch.physicalClosingStock === 0 && branch.totalClosingStock === 0);
  const later = [{ id: 'm1', itemId: 'S1', date: '2027-04-05', type: 'purchase', qty: 10, rate: 5, amount: 0 }];
  check('movements after effDate are ignored', computeTradingAccount({ ...base, tb, stockItems, movements: later }).physicalClosingStock === 50);
}

// 4. Audit C-7: activity-wise breakdown pairs each Sales head with its Purchase head.
{
  const tb = [bal('4101', '4100', 'income', -1000), bal('5110', '5100', 'expense', 400), bal('4199', '4100', 'income', -70)];
  const t = computeTradingAccount({ ...base, tb });
  const fert = t.activities.find(a => a.key === 'Fertilizer');
  check('Fertilizer margin = 1000 − 400 = 600', !!fert && fert.grossMargin === 600);
  check('unmapped sales head → unallocated.otherSales', t.unallocated.otherSales === 70);
  check('5110 counts under Purchases, not Direct Exp', t.totalPurchases === 400 && t.totalDirectExp === 0);
}

// 5. Audit C-9: a service society has no Trading A/c — its 4100/5100 heads sit in I&E directly.
{
  const tb = [bal('4101', '4100', 'income', -1000), bal('5101', '5100', 'expense', 600), bal('6101', '6100', 'expense', 30)];
  let called = false;
  const p = computeProfitLoss({ tb, hasTrading: false, tradingGrossProfit: () => { called = true; return 0; } });
  check('service society: trading not computed', called === false);
  check('income 1000, expenses 630, net 370', p.totalIncome === 1000 && p.totalExpenses === 630 && p.netProfit === 370);
}

// 6. A trading society: trading heads leave the P&L; ONE Gross Profit / Gross Loss line bridges in.
{
  const tb = [bal('4101', '4100', 'income', -1000), bal('5101', '5100', 'expense', 600), bal('4401', '4400', 'income', -100), bal('6101', '6100', 'expense', 30)];
  const p = computeProfitLoss({ tb, hasTrading: true, tradingGrossProfit: () => 350 });
  check('Gross Profit line first on income side', p.incomeItems[0].name === 'Gross Profit from Trading' && p.incomeItems[0].amount === 350);
  check('sales/purchases excluded; net = 350 + 100 − 30 = 420', p.incomeItems.length === 2 && p.expenseItems.length === 1 && p.netProfit === 420);
  const loss = computeProfitLoss({ tb, hasTrading: true, tradingGrossProfit: () => -80 });
  check('Gross Loss goes to the expense side', loss.expenseItems[0].name === 'Gross Loss from Trading' && loss.expenseItems[0].amount === 80 && loss.netProfit === -10);
  const abnormal = computeProfitLoss({ tb: [...tb, bal('4407', '4400', 'income', 25)], hasTrading: true, tradingGrossProfit: () => 0 });
  check('abnormal debit on an income head reduces income (BS-tie)', abnormal.totalIncome === 75);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll trading / P&L checks passed.');
process.exit(failed ? 1 : 0);
