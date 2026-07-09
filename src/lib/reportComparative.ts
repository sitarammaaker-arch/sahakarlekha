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

export interface PLItem { name: string; nameHi: string; amount: number; }
export interface PLResult {
  incomeItems: PLItem[];
  expenseItems: PLItem[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

/**
 * Period P&L = cumulative(end) − cumulative(start). Income/expense accounts are
 * cumulative-from-inception, so subtracting the two "as-on" statements isolates
 * the flows that occurred DURING the period (e.g. the prior FY). Used to COMPUTE
 * the P&L / I&E prior-year column instead of relying on a manual snapshot.
 */
export function deltaProfitLoss(end: PLResult, start: PLResult): PLResult {
  const sub = (a: PLItem[], b: PLItem[]): PLItem[] => {
    const bMap = new Map(b.map(i => [i.name, i]));
    const names = new Set([...a.map(i => i.name), ...b.map(i => i.name)]);
    const out: PLItem[] = [];
    for (const name of names) {
      const ai = a.find(i => i.name === name);
      const bi = bMap.get(name);
      const amount = r2((ai?.amount || 0) - (bi?.amount || 0));
      if (Math.abs(amount) < 0.005) continue;
      out.push({ name, nameHi: ai?.nameHi || bi?.nameHi || name, amount });
    }
    return out;
  };
  const totalIncome = r2(end.totalIncome - start.totalIncome);
  const totalExpenses = r2(end.totalExpenses - start.totalExpenses);
  return {
    incomeItems: sub(end.incomeItems, start.incomeItems),
    expenseItems: sub(end.expenseItems, start.expenseItems),
    totalIncome, totalExpenses,
    netProfit: r2(totalIncome - totalExpenses),
  };
}

/** Is a period P&L empty (no income/expense flows)? → fall back to a saved snapshot. */
export function isEmptyPL(pl: PLResult | null | undefined): boolean {
  return !pl || (Math.abs(pl.totalIncome) < 0.005 && Math.abs(pl.totalExpenses) < 0.005);
}
