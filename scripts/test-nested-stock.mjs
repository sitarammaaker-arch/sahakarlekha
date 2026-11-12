// A stock ledger kept in a SUB-GROUP under 3400 Inventory counts as closing stock — in the Trading A/c AND in
// the Balance Sheet, by one rule (2026-11-12 chart audit, F-04). By direct parent it fell out of both: Gross
// Profit short by its value and the Balance Sheet out by the same amount.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import('./gen-migration-163.mjs');   // registers the '@/…' loader
const imp = (p) => import(new URL('../src/' + p, import.meta.url).href);
const T = await imp('lib/tradingAccount.ts');
const R = await imp('lib/reports/tradingAndProfitLoss.ts');
const B = await imp('lib/balanceSheetLeaves.ts');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const near = (a, b) => Math.abs(a - b) < 0.01;
const src = (p) => readFileSync(path.join(ROOT, 'src', p), 'utf8');

const acc = (id, name, type, parentId, isGroup = false) => ({ id, name, nameHi: name, type, parentId, isGroup, openingBalance: 0, openingBalanceType: type === 'asset' || type === 'expense' ? 'debit' : 'credit', isSystem: false });
const chart = [
  acc('3000', 'Assets', 'asset', undefined, true), acc('3300', 'Current Assets', 'asset', '3000', true), acc('3301', 'Cash in Hand', 'asset', '3300'),
  acc('3400', 'Inventory', 'asset', '3000', true), acc('3403', 'Trading Goods', 'asset', '3400'),
  acc('3400-F', 'Fertiliser stock', 'asset', '3400', true), acc('s1', 'Urea stock', 'asset', '3400-F'),
  acc('3400-F2', 'Imported', 'asset', '3400-F', true), acc('s2', 'DAP stock', 'asset', '3400-F2'),
  acc('1000', 'Capital', 'equity', undefined, true), acc('1100', 'Share Capital', 'equity', '1000', true), acc('1102', 'Individual Share Capital', 'equity', '1100'),
  acc('4000', 'Income', 'income', undefined, true), acc('4100', 'Trading Income', 'income', '4000', true), acc('4101', 'Fertilizer Sales', 'income', '4100'),
  acc('5000', 'Expenses', 'expense', undefined, true), acc('5100', 'Direct Expenses', 'expense', '5000', true), acc('5101', 'Purchase', 'expense', '5100'),
  acc('5150', 'Closing Stock (Trading A/c)', 'expense', '5100'),
];
const by = (id) => chart.find((a) => a.id === id);
const row = (id, net) => ({ account: by(id), openingDebit: 0, openingCredit: 0, transactionDebit: Math.max(net, 0), transactionCredit: Math.max(-net, 0), netBalance: net });

// ── The predicate ────────────────────────────────────────────────────────────────────────────────────────────
const any = T.stockLedgerPredicate(chart);
ok(any(by('3403')) && any(by('s1')) && any(by('s2')), 'any-depth: direct, one and two sub-groups down are stock ledgers');
ok(!any(by('3400-F')) && !any(by('3301')) && !any(by('4101')), 'any-depth: a group, cash and sales are not');
ok(T.isStockLedgerAccount(by('3403')) && !T.isStockLedgerAccount(by('s1')), 'the direct-parent rule is unchanged (and misses the nested ledger)');
ok(T.stockLedgerPredicate()(by('s1')) === false, 'without a chart the predicate is the direct-parent rule, as before');

// ── One set of books: purchases 900 on credit of cash, sales 1,000, closing-stock journal Dr s1 300 / Cr 5150 ──
// Year-end stock ₹300 sits in the NESTED ledger s1 (journal posted), so the ledger carries the closing stock.
const tb = [row('3301', 1100), row('s1', 300), row('1102', -1000), row('4101', -1000), row('5101', 900), row('5150', -300)];
const input = (t) => ({ tb: t, fy: '2026-27', effDate: '2027-03-31', vouchers: [], stockItems: [], movements: [], openingsInScope: true });

const raw = R.computeTradingAccount(input(tb));
const wrapped = R.computeTradingAccount(input(T.withTradingParents(tb, chart)));
const closingOf = (tr) => tr.closingStockItems.reduce((s, i) => s + i.amount, 0);
ok(near(closingOf(raw), 0), 'before (raw trial balance): the nested stock is not in closing stock');
ok(near(closingOf(wrapped), 300), 'now: the Trading A/c counts the nested stock ledger (300)');
ok(wrapped.closingStockItems.some((i) => i.name === 'Urea stock'), 'and shows it under its own name');

// Balance Sheet with the same rule: net profit −Σ(income + expense) = 400; assets 1,100 + 300 = capital 1,000 + 400.
const netProfit = -tb.filter((b) => b.account.type === 'income' || b.account.type === 'expense').reduce((s, b) => s + b.netBalance, 0);
const opts = { closingStockPosted: wrapped.closingStockPosted, physicalClosingStock: wrapped.physicalClosingStock, netProfit };
const bs = B.balanceSheetLeaves(tb, opts, chart);
ok(near(bs.totalAssets, bs.totalLiabilities) && near(bs.totalAssets, 1400), `Balance Sheet balances with the nested stock (${bs.totalAssets} / ${bs.totalLiabilities})`);
ok(bs.assetLeaves.some((b) => b.account.id === 's1' && near(b.netBalance, 300)), 'the nested stock ledger is on the asset side');

// Physical stock NOT yet posted: the physical figure replaces the stock ledgers — the nested one too, in BOTH
// statements, or the Balance Sheet would count the stock twice.
const tb2 = [row('3301', 1100), row('s2', 0), row('1102', -1000), row('4101', -1000), row('5101', 900)];
const withPhysical = { closingStockPosted: false, physicalClosingStock: 300, netProfit: 1000 - 900 + 300 };
const bs2 = B.balanceSheetLeaves(tb2, withPhysical, chart);
ok(near(bs2.totalAssets, bs2.totalLiabilities), `unposted physical stock: Balance Sheet balances (${bs2.totalAssets} / ${bs2.totalLiabilities})`);
const stockInYear = [row('3301', 800), row('s2', 300), row('1102', -1000), row('4101', -1000), row('5101', 900)];
const a1 = B.balanceSheetLeaves(stockInYear, { closingStockPosted: false, physicalClosingStock: 300, netProfit: 0 }, chart);
const a0 = B.balanceSheetLeaves(stockInYear, { closingStockPosted: false, physicalClosingStock: 300, netProfit: 0 });
ok(!a1.assetLeaves.some((b) => b.account.id === 's2') && a0.assetLeaves.some((b) => b.account.id === 's2'), 'with the chart, a nested stock ledger is replaced by the physical figure like a direct one (no double count); without it, it was left in');

// A chart with no sub-group under 3400 gives byte-identical results with and without the chart.
const flatTb = [row('3301', 1100), row('3403', 300), row('1102', -1000), row('4101', -1000), row('5101', 900), row('5150', -300)];
ok(JSON.stringify(B.balanceSheetLeaves(flatTb, opts, chart)) === JSON.stringify(B.balanceSheetLeaves(flatTb, opts)), 'no nesting ⇒ the Balance Sheet leaves are identical with and without the chart');
ok(T.withTradingParents(flatTb, chart).every((b, i) => b === flatTb[i]), 'no nesting ⇒ the trial balance rows are the same objects');

// ── Wiring ───────────────────────────────────────────────────────────────────────────────────────────────────
ok(/balanceSheetLeaves\(trialBalance, \{ closingStockPosted, physicalClosingStock, netProfit \}, accounts\)/.test(src('pages/BalanceSheet.tsx')), 'Balance Sheet page passes the chart');
ok(/balanceSheetLeaves\(trialBalance, \{[^}]*\}, accounts\)/.test(src('pages/AuditSchedules.tsx')), 'Audit Schedules pass the chart');
ok(/stockLedgerPredicate\(input\.accounts\)/.test(src('lib/reports/balanceSheetLayout.ts')), 'the Balance Sheet layout (prior-year stock) uses the same rule');
ok(/withTradingParents\(getTrialBalance\(effDate\), accounts\)/.test(src('contexts/DataContext.tsx')), 'the Trading A/c getter wraps the trial balance');

console.log(`Nested stock: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
