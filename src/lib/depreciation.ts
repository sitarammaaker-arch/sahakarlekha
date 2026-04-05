import type { Asset, AssetCategory } from '@/types';

// Category → { debit: depreciation expense account, credit: accumulated depreciation account }
export const DEP_ACCOUNTS: Partial<Record<AssetCategory, { expenseId: string; accumId: string }>> = {
  Building:  { expenseId: '5501', accumId: '3108' },
  Furniture: { expenseId: '5502', accumId: '3109' },
  Vehicle:   { expenseId: '5503', accumId: '3110' },
  Equipment: { expenseId: '5504', accumId: '3111' },
  Computer:  { expenseId: '5505', accumId: '3112' },
  Other:     { expenseId: '5505', accumId: '3112' },
  // Land: no depreciation
};

/** Parse "2024-25" → { start: "2024-04-01", end: "2025-03-31" } */
export function parseFY(fy: string): { start: string; end: string } | null {
  const parts = fy.split('-');
  if (parts.length !== 2) return null;
  const startYear = parseInt(parts[0]);
  if (isNaN(startYear)) return null;
  return {
    start: `${startYear}-04-01`,
    end:   `${startYear + 1}-03-31`,
  };
}

/**
 * SLM (Straight Line Method) depreciation for a single financial year.
 * Pro-rated if asset was purchased during the year.
 */
export function calcSLMDepreciation(asset: Asset, fy: string): number {
  if (!asset.depreciationRate || asset.depreciationRate <= 0) return 0;
  if (!DEP_ACCOUNTS[asset.category]) return 0; // Land or unknown

  const fyDates = parseFY(fy);
  if (!fyDates) return 0;

  const fyEnd      = new Date(fyDates.end);
  const fyStart    = new Date(fyDates.start);
  const purchased  = new Date(asset.purchaseDate);

  if (purchased > fyEnd) return 0; // not yet purchased this FY

  const effectiveStart = purchased > fyStart ? purchased : fyStart;
  const daysUsed       = Math.round((fyEnd.getTime() - effectiveStart.getTime()) / 86_400_000) + 1;
  const fraction       = Math.min(daysUsed / 365, 1);

  // ICAI AS-6: Depreciable amount = Cost - Residual Value
  const depreciableAmount = asset.cost - (asset.residualValue || 0);
  return Math.round(depreciableAmount * (asset.depreciationRate / 100) * fraction * 100) / 100;
}

/**
 * WDV (Written Down Value) depreciation for a single financial year.
 * @param priorAccumDep Total accumulated depreciation already posted for prior FYs.
 */
export function calcWDVDepreciation(asset: Asset, fy: string, priorAccumDep: number): number {
  if (!asset.depreciationRate || asset.depreciationRate <= 0) return 0;
  if (!DEP_ACCOUNTS[asset.category]) return 0;

  const fyDates = parseFY(fy);
  if (!fyDates) return 0;

  const fyEnd     = new Date(fyDates.end);
  const fyStart   = new Date(fyDates.start);
  const purchased = new Date(asset.purchaseDate);

  if (purchased > fyEnd) return 0;

  const residual  = asset.residualValue || 0;
  const bookValue = Math.max(0, asset.cost - priorAccumDep);
  // Don't depreciate below residual value
  const depreciableBook = Math.max(0, bookValue - residual);
  if (depreciableBook <= 0) return 0;

  const effectiveStart = purchased > fyStart ? purchased : fyStart;
  const daysUsed       = Math.round((fyEnd.getTime() - effectiveStart.getTime()) / 86_400_000) + 1;
  const fraction       = Math.min(daysUsed / 365, 1);

  const dep = Math.round(bookValue * (asset.depreciationRate / 100) * fraction * 100) / 100;
  // Cap: don't let book value go below residual value
  return Math.min(dep, depreciableBook);
}

/**
 * Depreciation amount for the current FY (uses asset's depreciationMethod).
 * Requires priorAccumDep for WDV; pass 0 for SLM (unused).
 */
export function calcDepForFY(asset: Asset, fy: string, priorAccumDep = 0): number {
  const method = asset.depreciationMethod ?? 'SLM';
  return method === 'WDV'
    ? calcWDVDepreciation(asset, fy, priorAccumDep)
    : calcSLMDepreciation(asset, fy);
}
