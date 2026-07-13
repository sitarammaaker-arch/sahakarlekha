import type { Asset, AssetCategory } from '@/types';
import { toMinor, toRupees, subMinor, roundMinor } from '@/lib/money';

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

  // ICAI AS-6: Depreciable amount = Cost - Residual Value. T-02: exact base (subMinor) +
  // disciplined paise rounding (roundMinor) instead of Math.round(float × 100)/100.
  const depreciableMinor = subMinor(toMinor(Number(asset.cost) || 0), toMinor(Number(asset.residualValue) || 0));
  return toRupees(roundMinor(depreciableMinor * (asset.depreciationRate / 100) * fraction));
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

  // T-02: exact-paise depreciation (roundMinor) on the written-down book value.
  const dep = toRupees(roundMinor(toMinor(bookValue) * (asset.depreciationRate / 100) * fraction));
  // Cap: don't let book value go below residual value
  return Math.min(dep, depreciableBook);
}

/** Financial-year string ("YYYY-YY") that a date falls into (April–March). */
export function fyOfDate(d: Date): string {
  const y = d.getFullYear();
  const startY = d.getMonth() >= 3 ? y : y - 1; // month index 3 = April
  return `${startY}-${String((startY + 1) % 100).padStart(2, '0')}`;
}

/** The financial year immediately after a "YYYY-YY" string. */
export function nextFY(fy: string): string {
  const startY = parseInt(fy.split('-')[0]);
  return `${startY + 1}-${String((startY + 2) % 100).padStart(2, '0')}`;
}

/**
 * Accumulated WDV depreciation for THIS asset across all FYs BEFORE targetFY — replayed
 * from the asset's own purchase date. The per-category accumulated-depreciation ledger
 * holds the WHOLE group's depreciation, so deriving one asset's book value from it
 * over-/under-depreciated every asset that shares a category (Audit #6). SLM is cost-based
 * and never needs this. Guarded against runaway loops.
 */
export function wdvAccumulatedBefore(asset: Asset, targetFY: string): number {
  if ((asset.depreciationMethod ?? 'SLM') !== 'WDV') return 0;
  let accum = 0;
  let cursor = fyOfDate(new Date(asset.purchaseDate));
  let guard = 0;
  while (cursor < targetFY && guard++ < 200) {
    accum += calcWDVDepreciation(asset, cursor, accum);
    cursor = nextFY(cursor);
  }
  return accum;
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
