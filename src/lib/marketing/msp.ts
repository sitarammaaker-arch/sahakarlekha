/**
 * Marketing M1c — effective-dated MSP rate resolution (pure, no side effects).
 *
 * MSP rates are declared per crop per season, effective-dated. For a lot created on `date`,
 * the applicable rate is the one for that crop+season with the latest `effectiveFrom` that is
 * on or before `date`. Returns null when nothing applies (the operator then types the rate).
 */
import type { MSPRate } from '@/lib/procurement';

export function pickEffectiveMspRate(
  rates: ReadonlyArray<MSPRate>,
  args: { cropId: string; seasonId: string; date: string },
): number | null {
  if (!args.cropId || !args.seasonId) return null;
  const eligible = rates
    .filter(r => r.cropId === args.cropId && r.seasonId === args.seasonId && (!r.effectiveFrom || r.effectiveFrom <= args.date))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0));
  const top = eligible[0];
  return top && typeof top.rate?.amount === 'number' && isFinite(top.rate.amount) ? top.rate.amount : null;
}
