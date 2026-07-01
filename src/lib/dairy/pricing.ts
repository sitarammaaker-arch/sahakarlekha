/**
 * Dairy milk pricing engine (pure, tested) — Fat + SNF two-axis rate resolution.
 *
 * Rate = matrix[fatBand][snfBand] from the effective-dated chart in force on the collection
 * date. Never hardcodes a union rate; the chart is society-configured. Out-of-range fat/snf
 * CLAMPS to the nearest band (real charts price edge values at the boundary rate) rather than
 * returning nothing — but an empty/absent chart returns null so the caller can surface it.
 */
import type { DairyRateChart, DairyRateBand } from '@/types';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Index of the band containing `v`; clamps below the first / above the last band. -1 if no bands. */
export function bandIndex(bands: ReadonlyArray<DairyRateBand>, v: number): number {
  if (!bands || bands.length === 0) return -1;
  for (let i = 0; i < bands.length; i++) {
    if (v >= bands[i].min && v < bands[i].max) return i;
  }
  if (v < bands[0].min) return 0;                 // clamp low
  return bands.length - 1;                          // clamp high
}

/** Pick the chart in force on `date` (latest effectiveFrom <= date); optional season filter. */
export function pickEffectiveChart(
  charts: ReadonlyArray<DairyRateChart>,
  date: string,
  season?: string,
): DairyRateChart | null {
  const eligible = charts
    .filter((c) => !c.isDeleted && c.effectiveFrom <= date && (!season || !c.season || c.season === season))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0));
  return eligible[0] ?? null;
}

/** ₹/litre for the given fat & snf from a chart, or null if the chart has no usable matrix cell. */
export function resolveRate(chart: DairyRateChart | null, fat: number, snf: number): number | null {
  if (!chart) return null;
  const fi = bandIndex(chart.fatBands, fat);
  const si = bandIndex(chart.snfBands, snf);
  if (fi < 0 || si < 0) return null;
  const row = chart.matrix[fi];
  if (!row) return null;
  const rate = row[si];
  return typeof rate === 'number' && isFinite(rate) ? rate : null;
}

/** Convenience: resolve the effective chart then price qty litres. Returns rate & amount (null rate if unpriced). */
export function priceMilk(
  charts: ReadonlyArray<DairyRateChart>,
  args: { fat: number; snf: number; qty: number; date: string; season?: string },
): { rate: number | null; amount: number } {
  const chart = pickEffectiveChart(charts, args.date, args.season);
  const rate = resolveRate(chart, args.fat, args.snf);
  return { rate, amount: rate == null ? 0 : round2(args.qty * rate) };
}
