/**
 * Asset disposal accounting (ECR-15).
 *
 * On sale/scrap: WDV = cost − accumulated depreciation; gain/loss = proceeds − WDV. The
 * standard disposal journal removes the asset cost + its accumulated depreciation from the
 * balance sheet and books the gain/loss to P&L. Pure & deterministic → unit-tested by
 * scripts/test-asset-disposal.mjs.
 */
import type { AssetCategory } from '@/types';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Fixed-asset ledger account per category (COA 3101–3107). */
export const ASSET_ACCOUNTS: Record<AssetCategory, string> = {
  Land: '3101', Building: '3102', Furniture: '3103', Vehicle: '3104',
  Equipment: '3105', Other: '3106', Computer: '3107',
};
/** Accumulated-depreciation ledger account per category (COA 3108–3112). Land: none. */
export const ACCUM_DEP_ACCOUNTS: Partial<Record<AssetCategory, string>> = {
  Building: '3108', Furniture: '3109', Vehicle: '3110', Equipment: '3111', Computer: '3112', Other: '3112',
};
export const PROFIT_ON_SALE = '4410';
export const LOSS_ON_SALE = '5406';

export interface DisposalInput {
  category: AssetCategory;
  cost: number;
  accumDep: number;        // accumulated depreciation to the disposal date
  saleProceeds: number;
  cashBankAccount: string; // resolved cash/bank leg
}

export interface DisposalLine { accountId: string; type: 'Dr' | 'Cr'; amount: number; }
export interface DisposalPosting {
  cost: number;
  accumDep: number;
  wdv: number;
  gainLoss: number;   // > 0 gain, < 0 loss, 0 break-even
  drTotal: number;
  lines: DisposalLine[];
}

/** Build the disposal journal. Balanced by construction (proceeds + accumDep = cost + gain, or +loss). */
export function assetDisposalPosting(input: DisposalInput): DisposalPosting {
  const cost = r2(Math.max(0, input.cost || 0));
  const accumDep = r2(Math.min(Math.max(0, input.accumDep || 0), cost));   // never exceed cost
  const wdv = r2(cost - accumDep);
  const proceeds = r2(Math.max(0, input.saleProceeds || 0));
  const gainLoss = r2(proceeds - wdv);

  const lines: DisposalLine[] = [];
  if (proceeds > 0) lines.push({ accountId: input.cashBankAccount, type: 'Dr', amount: proceeds });
  const accumAcc = ACCUM_DEP_ACCOUNTS[input.category];
  if (accumDep > 0 && accumAcc) lines.push({ accountId: accumAcc, type: 'Dr', amount: accumDep });
  if (gainLoss < 0) lines.push({ accountId: LOSS_ON_SALE, type: 'Dr', amount: r2(-gainLoss) });
  lines.push({ accountId: ASSET_ACCOUNTS[input.category], type: 'Cr', amount: cost });
  if (gainLoss > 0) lines.push({ accountId: PROFIT_ON_SALE, type: 'Cr', amount: gainLoss });

  const drTotal = r2(lines.filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0));
  return { cost, accumDep, wdv, gainLoss, drTotal, lines };
}
