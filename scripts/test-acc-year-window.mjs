// ACC-01 / ACC-03 (product audit 2026-11-17) — a statement "for the year" shows the year.
//   ACC-01  goods procured into the stock ledger in an EARLIER year were counted again as this year's purchase
//           (they are already inside the opening stock) → phantom gross loss, Balance Sheet out.
//   ACC-03  income / expense accounts are swept only when the old year is closed; until then the I&E, P&L and
//           Trading summed every year since inception as "this year".
// End to end on the REAL builders: computeTrialBalance (with the FY window, as DataContext.getTrialBalance) →
// computeTradingAccount / computeProfitLoss → balanceSheetLeaves → buildBalanceSheetLayout.
// Run: node scripts/test-acc-year-window.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
    if (spec.startsWith('@/')) { const base = pathResolve(SRC, spec.slice(2)); for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base]) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const c of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(c, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8');

const { computeTrialBalance } = await imp('src/lib/reports/trialBalance.ts');
const R = await imp('src/lib/reports/tradingAndProfitLoss.ts');
const { balanceSheetLeaves } = await imp('src/lib/balanceSheetLeaves.ts');
const { buildBalanceSheetLayout } = await imp('src/lib/reports/balanceSheetLayout.ts');
const { fyStartOf } = await imp('src/lib/fyPeriod.ts');

let pass = 0, fail = 0;
const ok = (cond, msg, detail = '') => { if (cond) pass++; else { fail++; console.error('  ✗', msg, detail); } };
const near = (a, b) => Math.abs(a - b) < 0.005;

const acc = (id, type, parentId, name = 'A' + id) => ({ id, name, nameHi: name, type, parentId, openingBalance: 0, openingBalanceType: type === 'asset' || type === 'expense' ? 'debit' : 'credit', isGroup: false });
const chart = [
  acc('3301', 'asset', '3300', 'Cash'), acc('3403', 'asset', '3400', 'Trading Goods'),
  acc('2101', 'liability', '2100', 'Creditor'), acc('1101', 'equity', '1100', 'Share Capital'),
  acc('1208', 'equity', '1200', 'Net Surplus'),
  acc('4401', 'income', '4400', 'Commission'), acc('5301', 'expense', '5300', 'Salary'),
  acc('4101', 'income', '4100', 'Sales'), acc('5101', 'expense', '5100', 'Purchase'),
];
const v = (id, date, lines) => ({ id, voucherNo: id, date, type: 'journal', narration: '', amount: 0, isDeleted: false,
  lines: lines.map(([accountId, type, amount], i) => ({ id: `${id}-${i}`, accountId, type, amount })) });

// The SAME composition as DataContext: TB with the as-of date's FY window → Trading → P&L → Balance Sheet.
function statements(vouchers, asOf) {
  const fyStart = fyStartOf(asOf);
  const tb = computeTrialBalance({ accounts: chart, vouchers, asOnDate: asOf, fyStart, openingsInScope: true });
  const tr = R.computeTradingAccount({ tb, fy: '', effDate: asOf, vouchers, stockItems: [], movements: [], openingsInScope: true, fyStart });
  const pl = R.computeProfitLoss({ tb, hasTrading: true, tradingGrossProfit: () => tr.grossProfit });
  const leaves = balanceSheetLeaves(tb, { closingStockPosted: tr.closingStockPosted, physicalClosingStock: tr.physicalClosingStock, netProfit: pl.balanceSheetResult, tracksStock: tr.tracksStock }, chart);
  const layout = buildBalanceSheetLayout({ accounts: chart, assetLeaves: leaves.assetLeaves, capLiabLeaves: leaves.capLiabLeaves, unpostedStock: leaves.unpostedStock, netProfit: pl.netProfit, priorUnclosed: pl.priorUnclosed });
  return { tb, tr, pl, leaves, layout };
}

// ── ACC-01: goods procured into stock last year, nothing this year ──
{
  const vs = [v('P1', '2025-06-01', [['3403', 'Dr', 300], ['2101', 'Cr', 300]])];
  const y1 = statements(vs, '2026-03-31');
  ok(near(y1.tr.grossProfit, 0) && near(y1.tr.procuredToStock, 300), 'year 1: procured 300, closing 300 → gross profit 0');
  const y2 = statements(vs, '2027-03-31');
  ok(near(y2.tr.totalOpeningStock, 300), 'year 2: the opening stock carries last year\'s 300');
  ok(near(y2.tr.procuredToStock, 0) && !y2.tr.purchaseItems.some((i) => /Goods Procured/.test(i.name)), 'year 2: last year\'s procurement is NOT counted again', JSON.stringify(y2.tr.purchaseItems));
  ok(near(y2.tr.grossProfit, 0), 'year 2: gross profit 0 (was −300)', String(y2.tr.grossProfit));
  ok(near(y2.leaves.totalAssets, y2.leaves.totalLiabilities), 'year 2: the Balance Sheet ties', `${y2.leaves.totalAssets} vs ${y2.leaves.totalLiabilities}`);
  ok(near(y2.layout.assets.total, y2.layout.liabilities.total), 'year 2: the laid-out sheet ties too');
}

// ── ACC-03: last year income 500 / salary 200, NOT closed; this year income 100 ──
{
  const vs = [
    v('I1', '2025-07-01', [['3301', 'Dr', 500], ['4401', 'Cr', 500]]),
    v('S1', '2025-08-01', [['5301', 'Dr', 200], ['3301', 'Cr', 200]]),
    v('I2', '2026-07-01', [['3301', 'Dr', 100], ['4401', 'Cr', 100]]),
  ];
  const y2 = statements(vs, '2027-03-31');
  ok(near(y2.pl.totalIncome, 100) && near(y2.pl.totalExpenses, 0) && near(y2.pl.netProfit, 100), 'year 2 I&E: income 100, expenses 0, surplus 100 (was 600 / 200 / 400)', JSON.stringify([y2.pl.totalIncome, y2.pl.totalExpenses, y2.pl.netProfit]));
  ok(near(y2.pl.priorUnclosed, 300), 'last year\'s unclosed result (500 − 200) is reported apart', String(y2.pl.priorUnclosed));
  ok(near(y2.pl.balanceSheetResult, 400), 'the Balance Sheet carries both (300 + 100)');
  ok(near(y2.leaves.totalAssets, y2.leaves.totalLiabilities) && near(y2.layout.assets.total, y2.layout.liabilities.total), 'and the Balance Sheet ties');
  const rows = y2.layout.liabilities.sections.flatMap((s) => s.rows);
  const prior = rows.find((r) => r.key === 'pl-prior'), cy = rows.find((r) => r.key === 'pl-cy');
  ok(prior && near(prior.amount, 300) && /not yet closed/.test(prior.label) && /बंद नहीं/.test(prior.labelHi), 'the sheet shows the earlier unclosed result on its own line (Hindi too)');
  ok(cy && near(cy.amount, 100), 'and "net profit for the year" is this year\'s 100');
  const y1 = statements(vs, '2026-03-31');
  ok(near(y1.pl.netProfit, 300) && near(y1.pl.priorUnclosed, 0), 'year 1 statement: its own 300, nothing earlier');
}

// ── Once the old year is closed (sweep dated its last day) nothing changes for this year ──
{
  const vs = [
    v('I1', '2025-07-01', [['3301', 'Dr', 500], ['4401', 'Cr', 500]]),
    v('S1', '2025-08-01', [['5301', 'Dr', 200], ['3301', 'Cr', 200]]),
    v('CL', '2026-03-31', [['4401', 'Dr', 500], ['5301', 'Cr', 200], ['1208', 'Cr', 300]]),
    v('I2', '2026-07-01', [['3301', 'Dr', 100], ['4401', 'Cr', 100]]),
  ];
  const y2 = statements(vs, '2027-03-31');
  ok(near(y2.pl.netProfit, 100) && near(y2.pl.priorUnclosed, 0), 'closed year: surplus 100, no unclosed line');
  ok(!y2.layout.liabilities.sections.flatMap((s) => s.rows).some((r) => r.key === 'pl-prior'), 'and the sheet has no extra line');
  ok(near(y2.layout.assets.total, y2.layout.liabilities.total), 'and ties');
}

// ── A trading head left open last year: Sales 400 last year, 50 this year ──
{
  const vs = [
    v('SA1', '2025-09-01', [['3301', 'Dr', 400], ['4101', 'Cr', 400]]),
    v('SA2', '2026-09-01', [['3301', 'Dr', 50], ['4101', 'Cr', 50]]),
  ];
  const y2 = statements(vs, '2027-03-31');
  ok(near(y2.tr.totalSales, 50) && near(y2.tr.grossProfit, 50), 'Trading A/c: this year\'s sales only (50, not 450)', JSON.stringify([y2.tr.totalSales, y2.tr.grossProfit]));
  ok(near(y2.pl.priorUnclosed, 400) && near(y2.layout.assets.total, y2.layout.liabilities.total), 'last year\'s 400 is the unclosed line; the sheet ties');
}

// ── Wiring: every Balance Sheet carries the unclosed years; the I&E prior column is the prior year itself ──
{
  const dc = read('src/contexts/DataContext.tsx');
  ok(/fyStart: fyStartOf\(effDate\)/.test(dc), 'getTradingAccount passes the FY window');
  ok(/priorUnclosed: number;/.test(dc) && /balanceSheetResult: number;/.test(dc), 'getProfitLoss declares priorUnclosed and balanceSheetResult');
  const bs = read('src/pages/BalanceSheet.tsx');
  ok(/netProfit: balanceSheetResult/.test(bs) && /unpostedStock, netProfit, priorUnclosed,/.test(bs) && /openingGap,\s*priorUnclosed,\s*\);/.test(bs), 'Balance Sheet page: leaves, layout and PDF carry the unclosed years');
  for (const f of ['src/pages/Dashboard.tsx', 'src/pages/RoleDashboard.tsx', 'src/pages/SurplusAppropriation.tsx', 'src/pages/AuditSchedules.tsx']) {
    ok(/netProfit: balanceSheetResult/.test(read(f)), `${f}: the Balance Sheet tally carries the unclosed years`);
  }
  const cas = read('src/components/cas/CasStatements.tsx');
  ok((cas.match(/netProfit: (appPL|p)\.balanceSheetResult/g) || []).length === 4, 'CAS Balance Sheets carry the unclosed years');
  ok((cas.match(/nominalYearTB\(/g) || []).length === 3, 'CAS P&L, quarterly flows and Trading read the year');
  const pl = read('src/pages/ProfitLoss.tsx');
  ok(/const computedPY = hasFY \? getProfitLoss\(`\$\{fyFirstYear\}-03-31`\) : null;/.test(pl) && !/deltaProfitLoss\(/.test(pl), 'I&E prior-year column = the prior year\'s own statement (no cumulative delta)');
}

console.log(`ACC-01/03 year window: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
