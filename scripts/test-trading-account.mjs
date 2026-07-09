// Trading Account procurement-tie fix — mirrors src/lib/tradingAccount.ts.
// Run: node scripts/test-trading-account.mjs
const r2 = (n) => Math.round(n * 100) / 100;

function inventoryProcurementCost(vouchers, inventoryAcctIds, closingStockContraIds = new Set(['5150', '5101'])) {
  let total = 0;
  for (const v of vouchers) {
    const lines = v.lines || [];
    if (lines.some(l => l.type === 'Cr' && closingStockContraIds.has(l.accountId))) continue;
    for (const l of lines) {
      if (l.type === 'Dr' && inventoryAcctIds.has(l.accountId)) total += l.amount || 0;
    }
  }
  return r2(total);
}
function tradingGrossProfit(i) {
  const cr = (i.sales || 0) + (i.closingStock || 0);
  const dr = (i.openingStock || 0) + (i.purchases || 0) + (i.directExp || 0);
  return r2(cr - dr);
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const INV = new Set(['3401', '3402', '3404']); // stock-in-trade accounts (NOT 3403 closing-stock)

// 1. Procurement into inventory (Dr stock / Cr payable) counts as a purchase.
const procVouchers = [
  { lines: [ { accountId: '3401', type: 'Dr', amount: 51700 }, { accountId: '2401', type: 'Cr', amount: 51700 } ] },
  { lines: [ { accountId: '3401', type: 'Dr', amount: 242500 }, { accountId: '2401', type: 'Cr', amount: 242500 } ] },
];
ok(inventoryProcurementCost(procVouchers, INV) === 294200, 'procurement into inventory recognised as purchase = 294200');

// 2. The year-end closing-stock journal (Dr stock / Cr 5150) is EXCLUDED.
const closingJournal = [{ lines: [ { accountId: '3403', type: 'Dr', amount: 294200 }, { accountId: '5150', type: 'Cr', amount: 294200 } ] }];
ok(inventoryProcurementCost([...closingJournal], new Set(['3403'])) === 0, 'closing-stock journal (Cr 5150) excluded');
// legacy variant (Cr 5101) also excluded
ok(inventoryProcurementCost([{ lines: [ { accountId: '3403', type: 'Dr', amount: 100 }, { accountId: '5101', type: 'Cr', amount: 100 } ] }], new Set(['3403'])) === 0, 'legacy closing-stock journal (Cr 5101) excluded');

// 3. A normal purchase (Dr 5101 / Cr Cash) does NOT touch inventory → 0.
ok(inventoryProcurementCost([{ lines: [ { accountId: '5101', type: 'Dr', amount: 5000 }, { accountId: '3301', type: 'Cr', amount: 5000 } ] }], INV) === 0, 'ordinary 5101 purchase → no inventory procurement');

// 4. THE BUG: goods procured to stock, unsold → GP impact must be NIL.
//    Before the fix, closing stock was added with no matching purchase → phantom GP.
const closingStock = 294200;
const gpBuggy   = tradingGrossProfit({ sales: 0, closingStock, openingStock: 0, purchases: 0, directExp: 0 });
const gpFixed   = tradingGrossProfit({ sales: 0, closingStock, openingStock: 0, purchases: inventoryProcurementCost(procVouchers, INV), directExp: 0 });
ok(gpBuggy === 294200, 'buggy GP (no purchase) = phantom 294200');
ok(gpFixed === 0, 'fixed GP for procured-but-unsold goods = 0 (correct)');

// 5. The Rania society actual figures.
//    Sales 4,62,400; other purchases 4,38,277.60; procured wheat (closing stock) 2,94,200.
const sales = 462400, otherPurch = 438277.60, wheat = 294200;
const gpOld = tradingGrossProfit({ sales, closingStock: wheat, openingStock: 0, purchases: otherPurch, directExp: 0 });
const gpNew = tradingGrossProfit({ sales, closingStock: wheat, openingStock: 0, purchases: otherPurch + wheat, directExp: 0 });
ok(gpOld === 318322.40, 'Rania OLD GP (inflated) = 3,18,322.40');
ok(gpNew === 24122.40, 'Rania FIXED GP = 24,122.40 (Sales − real purchases)');
// Net Surplus = GP + Admission Fee 2,325 → 26,447.40, which ties the Balance Sheet.
ok(r2(gpNew + 2325) === 26447.40, 'Rania Net Surplus after fix = 26,447.40 (BS ties)');

// 6. Partly sold: procure 100 to stock, closing stock 60 (40 sold via COGS 40 direct exp).
//    GP = Sales − COGS. Sales 70, closing 60, purchases(procured) 100, directExp COGS 40.
ok(tradingGrossProfit({ sales: 70, closingStock: 60, openingStock: 0, purchases: 100, directExp: 40 }) === -10, 'partly-sold nets: GP = 70+60−100−40 = −10');

console.log(`\nTrading account (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
