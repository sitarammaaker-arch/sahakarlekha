/**
 * Depreciation rate master (ECR-15). A central table of the standard SLM depreciation
 * rate per asset category, so a new asset's rate auto-fills consistently instead of being
 * typed free-hand, and assets carrying a non-standard rate can be surfaced for review.
 *
 * Rates are commonly-used cooperative/SLM defaults — editable per asset (this master only
 * supplies the default and the deviation check; it does not force a rate). Land is never
 * depreciated. PURE → unit-tested by scripts/test-depreciation-rate-master.mjs.
 */
import type { Asset, AssetCategory } from '@/types';

/** Standard SLM depreciation rate (%) by asset category. Land = 0 (not depreciated). */
export const DEPRECIATION_RATE_MASTER: Record<AssetCategory, number> = {
  Land: 0,
  Building: 10,
  Furniture: 10,
  Equipment: 15,
  Vehicle: 15,
  Computer: 40,
  Other: 15,
};

/** The standard rate for a category (0 for anything unknown / non-depreciable). */
export function standardDepreciationRate(category: AssetCategory): number {
  return DEPRECIATION_RATE_MASTER[category] ?? 0;
}

export interface RateDeviation {
  id: string;
  name: string;
  category: AssetCategory;
  rate: number;       // the asset's actual rate
  standard: number;   // the master's standard rate
}

/**
 * Live assets whose depreciation rate differs from the category standard (rounding-tolerant).
 * Excludes archived, disposed, and Land (standard 0 — never flagged). A hint for review, not
 * an error: societies may legitimately use a different rate.
 */
export function assetRateDeviations(
  assets: Pick<Asset, 'id' | 'name' | 'category' | 'depreciationRate' | 'isDeleted' | 'disposalDate'>[],
): RateDeviation[] {
  const out: RateDeviation[] = [];
  for (const a of assets || []) {
    if (a.isDeleted || a.disposalDate || a.category === 'Land') continue;
    const standard = standardDepreciationRate(a.category);
    const rate = a.depreciationRate || 0;
    if (Math.abs(rate - standard) > 0.005) out.push({ id: a.id, name: a.name, category: a.category, rate, standard });
  }
  return out;
}
