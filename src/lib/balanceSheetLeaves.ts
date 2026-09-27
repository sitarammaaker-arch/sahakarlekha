/**
 * Which ledger leaves go on which side of the Balance Sheet — the ONE rule shared by the app's
 * Balance Sheet page and the NABARD CAS Balance Sheet (RULE 2: two statements, one set of totals).
 * PURE. Moved verbatim from BalanceSheet.tsx.
 *
 *  - Auto-reclassify by balance SIGN (Tally-style): an asset gone Cr is shown as a liability, a
 *    liability/equity gone Dr as an asset. Balance-preserving (both totals move by the same amount).
 *  - Closing stock: THE rule in lib/tradingAccount.closingStock, shared with the Trading A/c. When
 *    the closing-stock journal is NOT posted and stock items carry a physical stock, the stock ledger
 *    (3400 group) leaves are replaced by physical stock + the ledger's in-year movement (goods put
 *    straight into stock this year) — `unpostedStock`. Otherwise the 3400 balance IS the closing stock.
 */
import type { AccountBalance } from '@/types';
import { closingStock, isStockLedgerAccount } from '@/lib/tradingAccount';

export interface BalanceSheetLeaves {
  /** Dr-side leaves (netBalance ≥ 0 means Dr), after sign reclassification and the stock rule. */
  assetLeaves: AccountBalance[];
  /** Cr-side leaves (capital, reserves, liabilities), after sign reclassification. */
  capLiabLeaves: AccountBalance[];
  /** Closing stock that REPLACES the stock-ledger leaves (physical + in-year ledger stock); 0 when the ledger is kept. */
  unpostedStock: number;
  totalAssets: number;
  /** Includes the current-year net profit (P&L accounts are not closed into 1208 until year end). */
  totalLiabilities: number;
}

export function balanceSheetLeaves(
  trialBalance: readonly AccountBalance[],
  opts: { closingStockPosted: boolean; physicalClosingStock: number; netProfit: number },
): BalanceSheetLeaves {
  // RULE 2: THE closing-stock rule shared with the Trading A/c (lib/tradingAccount.closingStock).
  const stockLeaves = trialBalance.filter(b => isStockLedgerAccount(b.account));
  const cs = closingStock(stockLeaves.map(b => ({ name: b.account.name, nameHi: b.account.nameHi, netBalance: b.netBalance, openingDebit: b.openingDebit, openingCredit: b.openingCredit })),
    opts.physicalClosingStock, opts.closingStockPosted);
  const unpostedStock = cs.replacesLedger ? cs.total : 0;
  const isStock = (b: AccountBalance) => cs.replacesLedger && isStockLedgerAccount(b.account);
  const typeAssetLeaf = trialBalance.filter(b => b.account.type === 'asset' && !b.account.isGroup);
  const typeCapLiabLeaf = trialBalance.filter(b => (b.account.type === 'liability' || b.account.type === 'equity') && !b.account.isGroup);
  const allAssetLeaf = [
    ...typeAssetLeaf.filter(b => b.netBalance >= 0),   // assets with a normal Dr balance
    ...typeCapLiabLeaf.filter(b => b.netBalance > 0),  // a liability/equity gone Dr → shown as an asset
  ];
  // A replaced stock leaf leaves BOTH sides (a Cr-gone stock ledger is inside `unpostedStock` too).
  const capLiabLeaves = [
    ...typeCapLiabLeaf.filter(b => b.netBalance <= 0), // liabilities/equity with a normal Cr balance
    ...typeAssetLeaf.filter(b => b.netBalance < 0 && !isStock(b)),    // an asset gone Cr (e.g. ARTHIYA) → shown as a liability
  ];
  const assetLeaves = allAssetLeaf.filter(b => !isStock(b));
  const totalAssets = assetLeaves.reduce((s, b) => s + b.netBalance, 0) + unpostedStock;
  const totalLiabilities = capLiabLeaves.reduce((s, b) => s + (-b.netBalance), 0) + opts.netProfit;
  return { assetLeaves, capLiabLeaves, unpostedStock, totalAssets, totalLiabilities };
}
