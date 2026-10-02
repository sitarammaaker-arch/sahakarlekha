// Closing stock — ONE rule for the Trading A/c, the Balance Sheet (and so CAS and the Dashboard tally).
// Regression for Rania (FY 2026-27, prod): Rs 2,94,200 wheat put straight into the stock ledger
// (Dr Trading Goods / Cr MSP Payable, no stock item) + Rs 5,340 consumer goods held as stock items.
// Trading took only the ledger, the Balance Sheet only the items ⇒ out by exactly Rs 2,88,860.
// Run: node scripts/test-closing-stock-one-rule.mjs
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
const T = await imp('src/lib/tradingAccount.ts');
const { balanceSheetLeaves } = await imp('src/lib/balanceSheetLeaves.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const near = (a, b) => Math.abs(a - b) < 0.011;
const r2 = (n) => Math.round(n * 100) / 100;

// AccountBalance rows: Dr positive, Cr negative.
const acc = (id, name, type, parentId) => ({ id, name, nameHi: name, type, parentId, isGroup: false });
const row = (a, net, openingDebit = 0, openingCredit = 0) => ({ account: a, netBalance: net, openingDebit, openingCredit, transactionDebit: 0, transactionCredit: 0, totalDebit: 0, totalCredit: 0 });
const leavesOf = (tb) => tb.filter((b) => T.isStockLedgerAccount(b.account)).map((b) => ({ name: b.account.name, netBalance: b.netBalance, openingDebit: b.openingDebit, openingCredit: b.openingCredit }));

// ── 1. Rania, exactly as the prod Trial Balance ──
const RANIA = [
  row(acc('1102', 'Individual Share Capital', 'equity', '1100'), -63150),
  row(acc('2105', 'MSP Payable to Farmers', 'liability', '2100'), -294200),
  row(acc('2110', 'GST Payable', 'liability', '2100'), -270),
  row(acc('HAFED', 'Hafed Marketing Division', 'liability', '2100'), -11188.80),
  row(acc('4103', 'Consumer Goods Sales', 'income', '4100'), -8100),
  row(acc('SR', 'Sales Return', 'income', '4100'), 2700),
  row(acc('4407', 'Admission Fee', 'income', '4400'), -4440),
  row(acc('3301', 'Cash in Hand', 'asset', '3300'), 73260),
  row(acc('3312', 'GST Input Credit (ITC)', 'asset', '3300'), 532.80),
  row(acc('3403', 'Trading Goods', 'asset', '3400'), 294200),
  row(acc('5112', 'Consumer Goods Purchase', 'expense', '5100'), 10656),
];
ok(near(RANIA.reduce((t, b) => t + b.netBalance, 0), 0), 'fixture: the Trial Balance balances (as in prod)');
{
  const physical = 5340, procured = 294200;
  const cs = T.closingStock(leavesOf(RANIA), physical, false);
  ok(near(cs.total, 299540) && cs.replacesLedger, `closing stock = physical 5,340 + wheat put into stock 2,94,200 = 2,99,540 (${cs.total})`);
  ok(cs.items.length === 2 && cs.items[0].amount === 5340 && cs.items[1].amount === 294200, 'both parts shown as separate lines');
  // Trading: Cr sales 5,400 + closing 2,99,540 ; Dr purchases 10,656 + goods procured 2,94,200.
  const gp = T.tradingGrossProfit({ sales: 8100 - 2700, closingStock: cs.total, openingStock: 0, purchases: 10656 + procured, directExp: 0 });
  ok(near(gp, 84), `gross profit = 84 (was a Rs 5,256 "loss") — ${gp}`);
  const netProfit = r2(gp + 4440);
  ok(near(netProfit, 4524), `surplus = 4,524 (was a Rs 816 "deficit") — ${netProfit}`);
  const bs = balanceSheetLeaves(RANIA, { closingStockPosted: false, physicalClosingStock: physical, netProfit });
  ok(near(bs.unpostedStock, 299540) && !bs.assetLeaves.some((b) => b.account.id === '3403'), 'Balance Sheet: the SAME 2,99,540, the stock ledger leaf replaced (not added twice)');
  ok(near(bs.totalAssets, 373332.80) && near(bs.totalLiabilities, 373332.80), `Balance Sheet balances at 3,73,332.80 (assets ${bs.totalAssets}, liabilities ${bs.totalLiabilities})`);

  // The OLD pair of rules, reproduced to prove this test would have caught the bug.
  const oldTradingClosing = 294200, oldBsStock = 5340;
  const oldNp = r2(T.tradingGrossProfit({ sales: 5400, closingStock: oldTradingClosing, openingStock: 0, purchases: 10656 + procured, directExp: 0 }) + 4440);
  const oldAssets = 73260 + 532.80 + oldBsStock, oldLiab = 63150 + 294200 + 270 + 11188.80 + oldNp;
  ok(near(oldNp, -816) && near(oldLiab - oldAssets, 288860), 'the old rules reproduce prod exactly: deficit 816, difference 2,88,860');
}

// ── 1b. Rania AFTER the founder's correction: the wheat was bought as the agency's AGENT ──
// Correcting journal: Dr 3308 MSP Receivable 2,94,200 / Cr 3403 Trading Goods 2,94,200.
{
  const V = (lines) => ({ lines: lines.map(([accountId, type, amount]) => ({ accountId, type, amount })) });
  const original = V([['3403', 'Dr', 294200], ['2105', 'Cr', 294200]]);
  const correction = V([['3308', 'Dr', 294200], ['3403', 'Cr', 294200]]);
  const INV = new Set(['3403']);
  ok(T.inventoryProcurementCost([original], INV) === 294200, 'before the correction: 2,94,200 put into stock');
  ok(T.inventoryProcurementCost([original, correction], INV) === 0, 'after the correction: NET 0 put into stock (debits-only said 2,94,200)');
  const tb = RANIA.map((b) => (b.account.id === '3403' ? row(b.account, 0) : b)).concat([row(acc('3308', 'MSP Receivable', 'asset', '3300'), 294200)]);
  ok(near(tb.reduce((t, b) => t + b.netBalance, 0), 0), 'corrected Trial Balance balances');
  const cs = T.closingStock(leavesOf(tb), 5340, false);
  ok(cs.total === 5340 && cs.items.length === 1, 'closing stock = the consumer goods only (wheat is not the society\'s stock)');
  const gp = T.tradingGrossProfit({ sales: 5400, closingStock: cs.total, openingStock: 0, purchases: 10656 + T.inventoryProcurementCost([original, correction], INV), directExp: 0 });
  ok(near(gp, 84), `gross profit unchanged at 84 (${gp})`);
  const bs = balanceSheetLeaves(tb, { closingStockPosted: false, physicalClosingStock: 5340, netProfit: r2(gp + 4440) });
  ok(near(bs.totalAssets, 373332.80) && near(bs.totalLiabilities, 373332.80) && bs.assetLeaves.some((b) => b.account.id === '3308'), `Balance Sheet balances; MSP Receivable is an asset (${bs.totalAssets})`);
  // What the debits-only rule would have done after the correction — the trap this fixes.
  const gpOld = T.tradingGrossProfit({ sales: 5400, closingStock: 5340, openingStock: 0, purchases: 10656 + 294200, directExp: 0 });
  ok(near(gpOld, -294116), 'debits-only would have shown a 2,94,116 loss after the correction');
  // Goods issued out of the ledger reduce it; the closing-stock journal and its reversal never count.
  ok(T.inventoryProcurementCost([V([['3403', 'Dr', 1000], ['2105', 'Cr', 1000]]), V([['5201', 'Dr', 400], ['3403', 'Cr', 400]])], INV) === 600, 'an issue out of stock nets off');
  ok(T.inventoryProcurementCost([V([['3403', 'Dr', 900], ['5150', 'Cr', 900]]), V([['5150', 'Dr', 900], ['3403', 'Cr', 900]])], INV) === 0, 'closing-stock journal and its reversal excluded');
}

// ── 2. Behaviour unchanged where there is no in-year ledger stock ──
{
  const stale = [row(acc('3403', 'Stock', 'asset', '3400'), 1000, 1000), row(acc('1102', 'Cap', 'equity', '1100'), -1000)];
  const cs = T.closingStock(leavesOf(stale), 1500, false);
  ok(cs.total === 1500 && cs.items.length === 1, 'tracked items only (ledger = opening): closing = physical, as before');
  const ledgerOnly = T.closingStock(leavesOf([row(acc('3403', 'Stock', 'asset', '3400'), 7000)]), 0, false);
  ok(ledgerOnly.total === 7000 && !ledgerOnly.replacesLedger, 'no stock items: the ledger IS the closing stock, as before');
  const posted = T.closingStock(leavesOf([row(acc('3403', 'Stock', 'asset', '3400'), 9000, 1000)]), 1500, true);
  ok(posted.total === 9000 && !posted.replacesLedger, 'closing journal posted: the ledger, as before');
  ok(T.isStockLedgerAccount({ id: '3400', isGroup: false }) && !T.isStockLedgerAccount({ id: '3400', isGroup: true }) && !T.isStockLedgerAccount({ id: '3301', parentId: '3300' }), 'stock ledger = the 3400 group leaves');
}

// ── 3. Random books: the Balance Sheet balances for EVERY mix of items + ledger stock ──
{
  let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let bad = 0;
  for (let n = 0; n < 500; n++) {
    const opening = Math.round(rnd() * 5) === 0 ? 0 : Math.round(rnd() * 50000);       // stock ledger opening (tracked items' opening)
    const procured = Math.round(rnd() * 3) === 0 ? 0 : Math.round(rnd() * 300000);     // put straight into the ledger this year
    const physical = Math.round(rnd() * 3) === 0 ? 0 : Math.round(rnd() * 20000);
    const posted = rnd() < 0.2;
    const sales = Math.round(rnd() * 100000), purchases = Math.round(rnd() * 80000), other = Math.round(rnd() * 5000);
    const L = opening + procured;
    // Balanced TB: capital funds the opening stock; party owed for procurement; cash from sales − purchases.
    const tb = [
      row(acc('3403', 'Stock', 'asset', '3400'), L, opening),
      row(acc('1102', 'Cap', 'equity', '1100'), -(opening + 100000)),
      row(acc('2105', 'Party', 'liability', '2100'), -procured),
      row(acc('3301', 'Cash', 'asset', '3300'), 100000 + sales - purchases + other),
      row(acc('4103', 'Sales', 'income', '4100'), -sales),
      row(acc('4407', 'Other income', 'income', '4400'), -other),
      row(acc('5112', 'Purchases', 'expense', '5100'), purchases),
    ];
    const cs = T.closingStock(leavesOf(tb), physical, posted);
    const openingStock = opening;              // Trading Dr: the stock ledger's opening debit
    const np = T.tradingGrossProfit({ sales, closingStock: cs.total, openingStock, purchases: purchases + procured, directExp: 0 }) + other;
    const bs = balanceSheetLeaves(tb, { closingStockPosted: posted, physicalClosingStock: physical, netProfit: r2(np) });
    if (!near(bs.totalAssets, bs.totalLiabilities)) bad++;
  }
  ok(bad === 0, `500 random books: Balance Sheet balances with the shared closing-stock rule (${bad} bad)`);
}

// ── 4. Wiring: one rule, everywhere ──
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const dc = read('src/contexts/DataContext.tsx');
// K2: the Trading A/c compute lives in lib/reports/tradingAndProfitLoss; DataContext delegates to it.
const tp = read('src/lib/reports/tradingAndProfitLoss.ts');
ok(/const closing = closingStock\(stockLeaves, physicalClosingStock, closingStockPosted\);/.test(tp) && /const closingStockItems = closing\.items;/.test(tp) && /return computeTradingAccount\(/.test(dc), 'Trading A/c closing stock = closingStock()');
ok(!/ledgerClosingItems\.length > 0\s*\?\s*ledgerClosingItems/.test(dc), 'the old ledger-else-physical rule is gone');
const bsl = read('src/lib/balanceSheetLeaves.ts');
ok(/closingStock\(stockLeaves\.map/.test(bsl) && /const unpostedStock = cs\.replacesLedger \? cs\.total : 0;/.test(bsl), 'Balance Sheet closing stock = the same closingStock()');
ok(/balanceSheetLeaves\(tb, \{ closingStockPosted, physicalClosingStock, netProfit \}\)/.test(read('src/pages/Dashboard.tsx')), 'Dashboard tally uses the Balance Sheet rule (no raw-ledger tally)');
ok(/Math\.abs\(unpostedStock\) > 0\.005/.test(read('src/pages/BalanceSheet.tsx')), 'Balance Sheet shows a non-zero closing stock of either sign (never silently hidden)');

// I&E: a deficit balances the INCOME side only.
const pdf = read('src/lib/pdf.ts');
ok(!/\['Deficit carried to Balance Sheet'/.test(pdf) && /\['Deficit carried from Expenditure'/.test(pdf), 'I&E PDF: deficit shown once, on the income side');
const pl = read('src/pages/ProfitLoss.tsx');
ok(/\{isSurplus && \(\s*<TableRow className="bg-success\/10/.test(pl) && /\{!isSurplus && \(\s*<TableRow className="bg-destructive\/10/.test(pl), 'I&E screen: surplus row on the expenditure side, deficit row on the income side');
ok(/rows\.push\(\['Income', 'Net Deficit \(to Balance Sheet\)'/.test(pl), 'I&E Excel: the deficit is an income-side line');

console.log(`Closing stock one rule: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
