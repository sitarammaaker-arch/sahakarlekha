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
