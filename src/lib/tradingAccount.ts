/**
 * Trading Account helpers (ECR — closing-stock / procurement tie fix).
 *
 * Indian cooperative accounting (NCDC/NABARD Trading A/c format):
 *   Gross Profit = (Sales + Closing Stock) − (Opening Stock + Purchases + Direct Exp)
 *
 * Closing Stock is a Cr (income-side) item ONLY because the matching goods were
 * charged to the Dr side as Purchases (they cancel while the goods stay unsold).
 * When a society PROCURES goods straight into a stock-in-trade (inventory) account
 * — Dr Stock / Cr Payable/Cash (e.g. the procurement engine's RecogniseProcurement)
 * — that acquisition IS the purchase and must appear on the Dr side. Otherwise the
 * closing stock is added with no matching purchase → Gross Profit and Net Surplus
 * are overstated by the stock value, and the Balance Sheet goes out by that amount.
 *
 * Pure & unit-tested by scripts/test-trading-account.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface VoucherLineLite { accountId: string; type: 'Dr' | 'Cr'; amount: number; }

/**
 * Cost of goods procured DIRECTLY into inventory during the period: sum of debits
 * to `inventoryAcctIds` whose voucher does NOT credit a closing-stock contra
 * (5150/5101). The year-end closing-stock journal (Dr stock / Cr 5150) is excluded
 * — its inventory debit is a reclassification of unsold purchases, not a buy — so
 * the standard periodic method is unaffected.
 */
export function inventoryProcurementCost(
  vouchers: Array<{ lines: VoucherLineLite[] }>,
  inventoryAcctIds: Set<string>,
  closingStockContraIds: Set<string> = new Set(['5150', '5101']),
): number {
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

/** Trading A/c gross profit = (Sales + Closing Stock) − (Opening Stock + Purchases + Direct Exp). */
export function tradingGrossProfit(i: {
  sales: number; closingStock: number; openingStock: number; purchases: number; directExp: number;
}): number {
  const cr = (i.sales || 0) + (i.closingStock || 0);
  const dr = (i.openingStock || 0) + (i.purchases || 0) + (i.directExp || 0);
  return r2(cr - dr);
}

// ── Closing stock — ONE rule for the Trading A/c, the Balance Sheet and CAS (RULE 2) ──────────
//
// Stock can sit in two places at once:
//  (a) tracked stock items (qty × weighted-average cost, from movements) — the PHYSICAL stock; and
//  (b) the stock-in-trade LEDGER (3400 group) — its opening balance is the tracked items' opening
//      stock, but goods can also be put into it DIRECTLY during the year (Dr stock / Cr party, e.g.
//      procurement) with no stock item behind them.
// Before this rule the Trading A/c took (b) whenever it had a balance and ignored (a), while the
// Balance Sheet took (a) whenever it was > 0 and dropped (b) — so a society holding both (Rania:
// Rs 2,94,200 procured wheat in the ledger + Rs 5,340 consumer goods as items) had each report
// miss one of them and a Balance Sheet out by exactly the difference.
//
//  • closing journal posted, or no tracked stock → the ledger IS the closing stock (unchanged);
//  • otherwise → physical stock + the ledger's IN-YEAR movement (closing − opening balance), i.e.
//    the goods put straight into the ledger this year. The ledger's opening part is replaced by the
//    physical count, exactly as before.
export interface StockLedgerLeaf { name: string; nameHi?: string; netBalance: number; openingDebit: number; openingCredit: number }
export interface ClosingStock {
  items: { name: string; nameHi: string; amount: number }[];
  total: number;
  /** true ⇒ the stock ledger leaves are REPLACED by `total` on the Balance Sheet. */
  replacesLedger: boolean;
}

/** Which ledger accounts are stock-in-trade: the 3400 group's leaves. */
export const isStockLedgerAccount = (a: { id: string; parentId?: string; isGroup?: boolean }) =>
  !a.isGroup && (a.id === '3400' || a.parentId === '3400');

export function closingStock(leaves: readonly StockLedgerLeaf[], physicalClosingStock: number, closingStockPosted: boolean): ClosingStock {
  const physical = r2(Number(physicalClosingStock) || 0);
  if (closingStockPosted || physical <= 0.005) {
    const items = leaves.filter((l) => Math.abs(l.netBalance) > 0.005)
      .map((l) => ({ name: l.name, nameHi: l.nameHi ?? l.name, amount: r2(l.netBalance) }));
    return { items, total: r2(items.reduce((t, i) => t + i.amount, 0)), replacesLedger: false };
  }
  const items = [{ name: 'Closing Stock (Physical)', nameHi: 'समापन माल (भौतिक)', amount: physical }];
  for (const l of leaves) {
    const inYear = r2(l.netBalance - ((Number(l.openingDebit) || 0) - (Number(l.openingCredit) || 0)));
    if (Math.abs(inYear) > 0.005) items.push({ name: `${l.name} (put into stock this year)`, nameHi: `${l.nameHi ?? l.name} (इस वर्ष स्टॉक में)`, amount: inYear });
  }
  return { items, total: r2(items.reduce((t, i) => t + i.amount, 0)), replacesLedger: true };
}
