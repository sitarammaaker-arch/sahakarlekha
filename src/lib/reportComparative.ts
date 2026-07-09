/**
 * Report comparatives (ECR-19).
 *
 * Pairs a current-period figure with a prior-period figure and derives the
 * variance (absolute + %). Used to turn the reports' manual prior-year snapshot
 * into a COMPUTED comparative column. Pure & tested by
 * scripts/test-report-comparative.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Comparative {
  current: number;
  prior: number;
  variance: number;      // current - prior
  variancePct: number | null; // null when prior is 0 and there is nothing to compare against
}

/** Compare one current value against its prior value. */
export function comparative(current: number, prior: number): Comparative {
  const c = current || 0;
  const p = prior || 0;
  const variance = r2(c - p);
  let variancePct: number | null;
  if (p === 0) variancePct = c === 0 ? 0 : null; // grew from nothing → % is undefined
  else variancePct = r2((variance / Math.abs(p)) * 100);
  return { current: r2(c), prior: r2(p), variance, variancePct };
}

/**
 * Build a comparative for every key present in either map (accountId → amount).
 * Missing keys are treated as 0 on that side.
 */
export function buildComparativeMap(
  current: Record<string, number>,
  prior: Record<string, number>,
): Record<string, Comparative> {
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(prior || {})]);
  const out: Record<string, Comparative> = {};
  for (const k of keys) out[k] = comparative(current?.[k] || 0, prior?.[k] || 0);
  return out;
}

/** True when a prior-period map carries no real figures (→ fall back to a saved snapshot). */
export function isEmptyPeriod(map: Record<string, number>): boolean {
  return !map || Object.values(map).every(v => !v || Math.abs(v) < 0.005);
}
