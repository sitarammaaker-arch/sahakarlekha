/**
 * Which ledger leaves go on which side of the Balance Sheet — the ONE rule shared by the app's
 * Balance Sheet page and the NABARD CAS Balance Sheet (RULE 2: two statements, one set of totals).
 * PURE. Moved verbatim from BalanceSheet.tsx.
 *
 *  - Auto-reclassify by balance SIGN (Tally-style): an asset gone Cr is shown as a liability, a
 *    liability/equity gone Dr as an asset. Balance-preserving (both totals move by the same amount).
 *  - Closing stock: when the closing-stock journal is NOT posted but inventory items carry a
 *    physical closing stock, the Inventory ledger (3400 group) still shows the stale OPENING stock —
 *    drop those leaves and add the physical closing stock once (Audit #3). With no inventory items
 *    (unpostedStock === 0) the 3400 balance IS the closing stock — keep it.
 */
import type { AccountBalance } from '@/types';

export interface BalanceSheetLeaves {
  /** Dr-side leaves (netBalance ≥ 0 means Dr), after sign reclassification and the stock rule. */
  assetLeaves: AccountBalance[];
  /** Cr-side leaves (capital, reserves, liabilities), after sign reclassification. */
  capLiabLeaves: AccountBalance[];
  /** Physical closing stock injected when the closing-stock journal is not posted. */
  unpostedStock: number;
  totalAssets: number;
  /** Includes the current-year net profit (P&L accounts are not closed into 1208 until year end). */
  totalLiabilities: number;
}

export function balanceSheetLeaves(
  trialBalance: readonly AccountBalance[],
  opts: { closingStockPosted: boolean; physicalClosingStock: number; netProfit: number },
): BalanceSheetLeaves {
  const unpostedStock = !opts.closingStockPosted && opts.physicalClosingStock > 0 ? opts.physicalClosingStock : 0;
  const typeAssetLeaf = trialBalance.filter(b => b.account.type === 'asset' && !b.account.isGroup);
  const typeCapLiabLeaf = trialBalance.filter(b => (b.account.type === 'liability' || b.account.type === 'equity') && !b.account.isGroup);
  const allAssetLeaf = [
    ...typeAssetLeaf.filter(b => b.netBalance >= 0),   // assets with a normal Dr balance
    ...typeCapLiabLeaf.filter(b => b.netBalance > 0),  // a liability/equity gone Dr → shown as an asset
  ];
  const capLiabLeaves = [
    ...typeCapLiabLeaf.filter(b => b.netBalance <= 0), // liabilities/equity with a normal Cr balance
    ...typeAssetLeaf.filter(b => b.netBalance < 0),    // an asset gone Cr (e.g. ARTHIYA) → shown as a liability
  ];
  const assetLeaves = (opts.closingStockPosted || unpostedStock === 0)
    ? allAssetLeaf
    : allAssetLeaf.filter(b => b.account.id !== '3400' && b.account.parentId !== '3400');
  const totalAssets = assetLeaves.reduce((s, b) => s + b.netBalance, 0) + unpostedStock;
  const totalLiabilities = capLiabLeaves.reduce((s, b) => s + (-b.netBalance), 0) + opts.netProfit;
  return { assetLeaves, capLiabLeaves, unpostedStock, totalAssets, totalLiabilities };
}
