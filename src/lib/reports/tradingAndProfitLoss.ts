/**
 * Trading Account and Profit & Loss / Income & Expenditure from a trial balance — PURE
 * (Phase K2: lifted verbatim out of DataContext.getTradingAccount / getProfitLoss).
 *
 * DataContext still picks the as-of date, builds the trial balance (computeTrialBalance or the T-09
 * ledger read), reconciles stock movements against live purchase/sale records (RULE 2/3) and resolves
 * whether the society trades. These functions only turn those inputs into the statements, so they can
 * be tested on their own.
 */
import type { AccountBalance, StockItem, StockMovement, Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor, toRupees, addMinor, subMinor, sumMinor } from '@/lib/money';
import { inventoryProcurementCost, closingStock, isStockLedgerAccount } from '@/lib/tradingAccount';
import { computeStockValue } from '@/lib/stockUtils';

export interface StatementItem { name: string; nameHi: string; amount: number }

export interface TradingAccountInput {
  /** Trial balance as on effDate. */
  tb: AccountBalance[];
  /** Society financial-year label, e.g. "2026-27" (closing-stock journals carry it in the narration). */
  fy: string;
  /** Inclusive as-of date (YYYY-MM-DD). */
  effDate: string;
  /** Live vouchers only (RULE 5). */
  vouchers: Voucher[];
  stockItems: StockItem[];
  /** Stock movements ALREADY reconciled against live purchase/sale records (reconcileMovements). */
  movements: StockMovement[];
  /** ECR-17: physical stock is society-level → Head Office scope only. */
  openingsInScope: boolean;
}

export function computeTradingAccount({ tb, fy, effDate, vouchers, stockItems, movements, openingsInScope }: TradingAccountInput) {

  // Cr side: Sales / Trading Income (parentId '4100'). Signed (-nb) so a net SALES
  // RETURN (abnormal debit) reduces sales and stays consistent with the ledger
  // (BS-tie fix — Math.abs would inflate sales and break the Balance Sheet).
  const salesItems = tb
    .filter(b => b.account.parentId === '4100')
    .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: -b.netBalance }))
    .filter(i => Math.abs(i.amount) > 0.005);

  // Cr side: Closing Stock from ledger (net balance of inventory accounts under '3400').
  // Signed (not Math.max(0,..)) so an abnormal credit balance nets correctly against
  // the same account on the asset side, keeping the Balance Sheet in balance.
  const ledgerClosingItems = tb
    .filter(b => b.account.parentId === '3400')
    .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }))
    .filter(i => Math.abs(i.amount) > 0.005);

  // Physical closing stock — use movement-based qty (same formula as Inventory/Stock Valuation)
  // so that orphan currentStock left over from old buggy edits/deletes doesn't show as phantom stock.
  // M15: Filter movements by effDate so historical Trading A/c matches its date window.
  // RULE 2/3: reconcile against live purchase/sale records first, so orphan/missing
  // movements from edited/deleted docs can't distort closing stock.
  const movementsToUse = movements.filter(m => m.date <= effDate);
  // Value closing stock at weighted-average COST from movements (NOT the stale
  // purchaseRate field, which is 0 after some imports → silently zeroed closing stock).
  // ECR-17: stock items/movements carry no branchId (they are godown-scoped), so physical stock
  // is society-level → Head Office scope, like openings. Without this, the WHOLE society's stock
  // landed on whichever single branch you viewed, overstating that branch's GP and Balance Sheet.
  const physicalClosingStock = openingsInScope ? toRupees(sumMinor(
    stockItems.filter(s => s.isActive).map(s => toMinor(Number(computeStockValue(s, movementsToUse)) || 0)),
  )) : 0;

  // Check if the closing-stock journal has been posted for this FY.
  // Audit C-8: the NEW journal credits the dedicated 5150 (Purchases stay gross);
  // LEGACY journals credited 5101 (Purchases reduced — needs gross-up below).
  // Detect the posting against the SAME date window as the balances (effDate),
  // else an interim Balance Sheet before the posting date would drop closing stock.
  const closingScopedVouchers = vouchers.filter(v => v.date <= effDate);
  const closingViaLegacy = closingScopedVouchers.some(v =>
    getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
    getVoucherLines(v).some(l => l.accountId === '5101' && l.type === 'Cr') &&
    v.narration.includes(fy)
  );
  const closingViaDedicated = closingScopedVouchers.some(v =>
    getVoucherLines(v).some(l => l.accountId === '3403' && l.type === 'Dr') &&
    getVoucherLines(v).some(l => l.accountId === '5150' && l.type === 'Cr') &&
    v.narration.includes(fy)
  );
  // Phase-2 C (091): the server's year-close posts the closing stock as ONE journal moving the stock
  // ledger to the counted value — Dr 3403 / Cr 5150 for an increase, the reverse for a decrease.
  const closingViaYearClose = closingScopedVouchers.some(v =>
    (v as { refType?: string }).refType === 'fy.close.stock' && v.narration.includes(fy));
  const closingStockPosted = closingViaLegacy || closingViaDedicated || closingViaYearClose;

  // RULE 2: THE closing-stock rule (lib/tradingAccount.closingStock) — the SAME one the Balance
  // Sheet uses, so a society holding BOTH tracked items and goods put straight into the stock
  // ledger counts both, in both reports.
  const stockLeaves = tb.filter(b => isStockLedgerAccount(b.account))
    .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, netBalance: b.netBalance, openingDebit: b.openingDebit, openingCredit: b.openingCredit }));
  const closing = closingStock(stockLeaves, physicalClosingStock, closingStockPosted);
  const closingStockItems = closing.items;
  void ledgerClosingItems;

  // Dr side: Opening Stock = opening debit balances of inventory accounts
  const openingStockItems = tb
    .filter(b => isStockLedgerAccount(b.account))
    .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.openingDebit }))
    .filter(i => i.amount > 0);

  const totalClosingStockMinor = sumMinor(closingStockItems.map(i => toMinor(Number(i.amount) || 0)));
  const totalClosingStockEarly = toRupees(totalClosingStockMinor);

  // Dr side: Purchases (account 5101).
  // Audit C-8: a LEGACY closing-stock journal (Dr 3403 / Cr 5101) reduced 5101 by
  // the closing-stock value, so we GROSS IT UP to keep GP = Sales + ClosingStock −
  // Opening − GrossPurchases − DirectExp consistent. The NEW journal credits the
  // dedicated 5150 instead, leaving 5101 already gross — so no gross-up then.
  // Activity-wise purchase heads (audit C-5) belong with Purchases, not Direct
  // Expenses, so the Trading A/c lists each commodity's purchase under "Purchases".
  const PURCHASE_ACTIVITY_IDS = ['5110', '5111', '5112', '5113', '5114', '5115', '5116'];
  const purchase5101Net = (tb.find(b => b.account.id === '5101')?.netBalance) || 0;
  const purchase5101Gross = closingViaLegacy ? toRupees(addMinor(toMinor(Number(purchase5101Net) || 0), totalClosingStockMinor)) : purchase5101Net;
  // Include even when net is negative (abnormal — e.g. returns exceed purchases) so
  // the figure ties to the ledger (BS-tie fix).
  const purchaseItems = [
    ...(Math.abs(purchase5101Gross) > 0.005 ? [{ name: 'Purchase', nameHi: 'क्रय', amount: purchase5101Gross }] : []),
    ...tb.filter(b => PURCHASE_ACTIVITY_IDS.includes(b.account.id) && Math.abs(b.netBalance) > 0.005)
      .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance })),
  ];

  // ── Indian cooperative accounting (Trading A/c tie): goods PROCURED straight
  // into a stock-in-trade (inventory) account — Dr stock / Cr payable-cash — are
  // the cost of purchase and must sit on the Dr side, so the SAME goods in Closing
  // Stock (Cr) net to nil Gross Profit while unsold. Without this, closing stock
  // inflated Gross Profit / Net Surplus and the Balance Sheet went out by the stock
  // value. The year-end closing-stock journal (Cr 5150/5101) is excluded in-helper.
  const inventoryAcctIds = new Set(
    tb.filter(b => isStockLedgerAccount(b.account)).map(b => b.account.id)
  );
  const inventoryProcurement = inventoryProcurementCost(
    closingScopedVouchers.map(v => ({ lines: getVoucherLines(v) })),
    inventoryAcctIds,
  );
  // Signed: goods leaving the stock ledger this year (a correction / an issue) reduce it.
  if (Math.abs(inventoryProcurement) > 0.005) {
    purchaseItems.push({ name: 'Goods Procured (to stock)', nameHi: 'माल खरीद (स्टॉक में)', amount: inventoryProcurement });
  }

  // Dr side: Direct Expenses (parentId '5100', excluding 5101 Purchase, the activity
  // purchase heads (now under Purchases), AND the 5150 Closing-Stock contra — the
  // closing stock is shown on the Cr side from the 3403 asset, so counting 5150 here
  // would double-count it). Keep signed so a credit balance nets correctly.
  const directExpItems = tb
    .filter(b => b.account.parentId === '5100' && b.account.id !== '5101' && b.account.id !== '5150' && !PURCHASE_ACTIVITY_IDS.includes(b.account.id))
    .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }))
    .filter(i => Math.abs(i.amount) > 0.005);

  // T-02: sum each side's items in integer paise, then combine Cr/Dr in paise, so Gross
  // Profit over many items/legs cannot drift in the last paisa (values return as rupees).
  const totalSalesMinor        = sumMinor(salesItems.map(i => toMinor(Number(i.amount) || 0)));
  const totalOpeningStockMinor = sumMinor(openingStockItems.map(i => toMinor(Number(i.amount) || 0)));
  const totalPurchasesMinor    = sumMinor(purchaseItems.map(i => toMinor(Number(i.amount) || 0)));
  const totalDirectExpMinor    = sumMinor(directExpItems.map(i => toMinor(Number(i.amount) || 0)));

  const totalSales        = toRupees(totalSalesMinor);
  const totalClosingStock = toRupees(totalClosingStockMinor);
  const totalOpeningStock = toRupees(totalOpeningStockMinor);
  const totalPurchases    = toRupees(totalPurchasesMinor);
  const totalDirectExp    = toRupees(totalDirectExpMinor);

  const crTotalMinor = addMinor(totalSalesMinor, totalClosingStockMinor);
  const drTotalMinor = addMinor(totalOpeningStockMinor, totalPurchasesMinor, totalDirectExpMinor);
  const grossProfit = toRupees(subMinor(crTotalMinor, drTotalMinor));

  // ── Audit C-7: activity-wise Trading breakdown (NCDC Annexure V) ─────────────
  // ADDITIVE — does NOT change grossProfit / the combined totals above (P&L and
  // Balance Sheet depend on them). Each commodity pairs its Sales head with its
  // Purchase head; Gross Margin = Sales − Purchases (the closing-stock adjustment
  // stays in the combined statement). Purchases still parked in the generic 5101,
  // plus non-purchase direct expenses, surface under "Unallocated" so the user can
  // see exactly which postings still need per-item activity routing.
  const nbById = (id: string) => tb.find(b => b.account.id === id)?.netBalance ?? 0;
  const ACTIVITY_DEFS: { key: string; keyHi: string; salesId: string; purchaseId: string }[] = [
    { key: 'Fertilizer',        keyHi: 'उर्वरक',            salesId: '4101', purchaseId: '5110' },
    { key: 'Seed',              keyHi: 'बीज',               salesId: '4102', purchaseId: '5111' },
    { key: 'Consumer Goods',    keyHi: 'उपभोक्ता वस्तु',    salesId: '4103', purchaseId: '5112' },
    { key: 'Pesticides',        keyHi: 'कीटनाशक',           salesId: '4104', purchaseId: '5113' },
    { key: 'Animal Feed',       keyHi: 'पशु आहार',          salesId: '4105', purchaseId: '5114' },
    { key: 'Agri Implements',   keyHi: 'कृषि यंत्र',        salesId: '4106', purchaseId: '' },
    { key: 'PDS / Ration',      keyHi: 'सार्वजनिक वितरण',   salesId: '4107', purchaseId: '5115' },
    { key: 'Govt Procurement',  keyHi: 'सरकारी खरीद',       salesId: '4108', purchaseId: '5116' },
  ];
  const activityPurchaseIds = new Set(ACTIVITY_DEFS.map(a => a.purchaseId).filter(Boolean));
  const activitySalesIds = new Set(ACTIVITY_DEFS.map(a => a.salesId));
  const activities = ACTIVITY_DEFS.map(a => {
    const sales = -nbById(a.salesId);                       // credit-nature → positive
    const purchases = a.purchaseId ? nbById(a.purchaseId) : 0; // debit-nature → positive
    const hasRoutedPurchase = Math.abs(purchases) > 0.005;
    return { key: a.key, keyHi: a.keyHi, salesId: a.salesId, purchaseId: a.purchaseId,
      sales, purchases, hasRoutedPurchase, grossMargin: toRupees(subMinor(toMinor(Number(sales) || 0), toMinor(Number(purchases) || 0))) };
  }).filter(a => Math.abs(a.sales) > 0.005 || a.hasRoutedPurchase);

  // Unallocated bucket: generic 5101 purchases + non-purchase direct expenses +
  // any 4100 sales not mapped to a defined activity.
  const unallocated = {
    purchases: nbById('5101'),
    directExp: toRupees(sumMinor(tb.filter(b => b.account.parentId === '5100' && b.account.id !== '5101' && b.account.id !== '5150' && !activityPurchaseIds.has(b.account.id))
      .map(b => toMinor(Number(b.netBalance) || 0)))),
    otherSales: toRupees(sumMinor(tb.filter(b => b.account.parentId === '4100' && !activitySalesIds.has(b.account.id))
      .map(b => toMinor(Number(-b.netBalance) || 0)))),
  };

  return { salesItems, closingStockItems, openingStockItems, purchaseItems, directExpItems,
    totalSales, totalClosingStock, totalOpeningStock, totalPurchases, totalDirectExp, grossProfit,
    physicalClosingStock, closingStockPosted, activities, unallocated,
    procuredToStock: inventoryProcurement > 0.005 ? inventoryProcurement : 0,
    legacyPurchaseGrossUp: toRupees(subMinor(toMinor(Number(purchase5101Gross) || 0), toMinor(Number(purchase5101Net) || 0))) };
}

export type TradingAccountResult = ReturnType<typeof computeTradingAccount>;

export interface ProfitLossInput {
  /** Trial balance as on the statement date. */
  tb: AccountBalance[];
  /** Society is entitled to inventory_sales → trading heads go through the Trading A/c. */
  hasTrading: boolean;
  /** Gross profit of the Trading A/c for the same date; called only when hasTrading. */
  tradingGrossProfit: () => number;
}

export function computeProfitLoss({ tb, hasTrading, tradingGrossProfit }: ProfitLossInput) {
  // ── Audit C-9: NCDC two-statement structure (Trading A/c → P&L/I&E) ──────
  // Per NCDC Annexure II + III, trading heads (Sales, Purchases, direct expenses,
  // opening/closing stock) are absorbed into the TRADING ACCOUNT, and only the
  // resulting GROSS PROFIT (or Gross Loss) flows into the P&L/I&E. Previously
  // getProfitLoss summed Sales (4100) as income and Purchases/direct-exp (5100)
  // as expense DIRECTLY — which (a) ignored closing stock (unsold inventory wrongly
  // treated as a full expense) and (b) never showed the Trading Gross Profit line.
  // Fix: exclude trading heads here and inject the single Gross Profit line.
  const isTradingIncome  = (parentId?: string) => parentId === '4100';            // Sales / Trading Income
  const isTradingExpense = (parentId?: string) => parentId === '5100';            // Purchases + Direct Expenses

  // Indirect (non-trading) INCOME — commission, scheme income, interest, rent,
  // admission fee, misc. (credit-nature: abs(netBalance) is the income amount).
  // Use signed (-netBalance) NOT Math.abs: income accounts are credit-nature so
  // -nb is the positive income amount, but an account carrying an abnormal DEBIT
  // balance (refund/over-credit) must REDUCE income — and must net to the same
  // figure the ledger holds, otherwise the Balance Sheet won't tie. (BS-tie fix.)
  const incomeItems = tb
    .filter(b => b.account.type === 'income' && (!hasTrading || !isTradingIncome(b.account.parentId)) && b.netBalance !== 0)
    .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: -b.netBalance }));

  // Indirect (operating) EXPENSES — establishment, admin, depreciation, statutory.
  // P2-4: keep sign so a Cr balance (refund/over-credit) REDUCES total expenses.
  const expenseItems = tb
    .filter(b => b.account.type === 'expense' && (!hasTrading || !isTradingExpense(b.account.parentId)) && b.netBalance !== 0)
    .map(b => ({ name: b.account.name, nameHi: b.account.nameHi, amount: b.netBalance }));

  // Bridge line from the Trading Account (Annexure III opens P&L Cr side with it).
  // Service societies (no trading) skip this — their 4100/5100 are already included above.
  if (hasTrading) {
    const gp = tradingGrossProfit();
    if (gp > 0.005) {
      incomeItems.unshift({ name: 'Gross Profit from Trading', nameHi: 'व्यापार से सकल लाभ', amount: gp });
    } else if (gp < -0.005) {
      expenseItems.unshift({ name: 'Gross Loss from Trading', nameHi: 'व्यापार से सकल हानि', amount: Math.abs(gp) });
    }
  }

  const totalIncomeMinor = sumMinor(incomeItems.map(i => toMinor(Number(i.amount) || 0)));
  const totalExpensesMinor = sumMinor(expenseItems.map(i => toMinor(Number(i.amount) || 0)));
  const totalIncome = toRupees(totalIncomeMinor);
  const totalExpenses = toRupees(totalExpensesMinor);
  return { incomeItems, expenseItems, totalIncome, totalExpenses, netProfit: toRupees(subMinor(totalIncomeMinor, totalExpensesMinor)) };
}
