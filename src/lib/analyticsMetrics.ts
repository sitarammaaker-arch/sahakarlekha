/**
 * Analytics metrics (ECR-24) — pure, tested BI helpers for the Analytics dashboard.
 *
 * All date handling is STRING-based (YYYY-MM-DD → slice), never `new Date(field)`,
 * because a malformed date field must not crash a report (learned the hard way on
 * the Balance Sheet). Mirrors scripts/test-analytics-metrics.mjs.
 */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface FyMonth {
  key: string;   // 'YYYY-MM'
  label: string; // 'Apr' … 'Mar'
  year: number;
  month: number; // 1–12
}

/** The 12 months of an FY "YYYY-YY", in order Apr → Mar. Returns [] for a bad FY. */
export function fyMonths(fy: string): FyMonth[] {
  const startYear = parseInt((fy || '').split('-')[0], 10);
  if (!startYear || Number.isNaN(startYear)) return [];
  const months: FyMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const month = ((3 + i) % 12) + 1;              // Apr(4) … Dec(12), Jan(1) … Mar(3)
    const year = month >= 4 ? startYear : startYear + 1;
    months.push({ key: `${year}-${String(month).padStart(2, '0')}`, label: MONTH_LABELS[month - 1], year, month });
  }
  return months;
}

export interface Dated { date: string; amount: number }

/**
 * Roll a set of named series into one row per FY month, ready for a recharts dataset.
 * Each row is { key, label, <seriesName>: total, … }. Items outside the FY are ignored.
 */
export function monthlySeries(
  fy: string,
  series: Record<string, ReadonlyArray<Dated>>,
): Array<{ key: string; label: string } & Record<string, number>> {
  const months = fyMonths(fy);
  const keyset = new Set(months.map(m => m.key));
  const names = Object.keys(series);
  const rows = months.map(m => {
    const row: { key: string; label: string } & Record<string, number> = { key: m.key, label: m.label };
    for (const n of names) row[n] = 0;
    return row;
  });
  const rowByKey = new Map(rows.map(r => [r.key, r]));
  for (const name of names) {
    for (const it of series[name]) {
      const key = (it.date || '').slice(0, 7);
      if (!keyset.has(key)) continue;
      const row = rowByKey.get(key)!;
      row[name] = round2((row[name] as number) + (it.amount || 0));
    }
  }
  return rows;
}

/** Period-over-period growth %, guarding a zero base. Positive = growth. */
export function growthPct(current: number, previous: number): number {
  if (Math.abs(previous) < 0.005) return Math.abs(current) < 0.005 ? 0 : 100;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * Month-over-month growth of a series field: compares the LAST month with a non-zero
 * value to the month immediately before it. Returns 0 with fewer than 2 usable points.
 */
export function momGrowth(rows: ReadonlyArray<Record<string, number | string>>, field: string): number {
  let lastIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (Math.abs(Number(rows[i][field]) || 0) > 0.005) { lastIdx = i; break; }
  }
  if (lastIdx <= 0) return 0;
  return growthPct(Number(rows[lastIdx][field]) || 0, Number(rows[lastIdx - 1][field]) || 0);
}

export interface NamedAmount { name: string; amount: number }

/** Top-N items by absolute amount, descending; zero-amount items dropped. */
export function topN(items: ReadonlyArray<NamedAmount>, n: number): NamedAmount[] {
  return [...items]
    .filter(i => Math.abs(i.amount || 0) > 0.005)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, Math.max(0, n));
}

export interface RatioInput {
  sales: number;
  grossProfit: number;
  totalIncome: number;
  totalExpenses: number;
}

export interface Ratios {
  grossMarginPct: number;   // grossProfit / sales
  surplusMarginPct: number; // (income − expense) / income
  expenseRatioPct: number;  // expense / income
}

/** P&L-clean ratios — all well-defined; no mislabeled balance-sheet ratios. */
export function ratios(input: RatioInput): Ratios {
  const { sales, grossProfit, totalIncome, totalExpenses } = input;
  const pct = (num: number, den: number) => (Math.abs(den) < 0.005 ? 0 : round2((num / den) * 100));
  return {
    grossMarginPct: pct(grossProfit, sales),
    surplusMarginPct: pct(totalIncome - totalExpenses, totalIncome),
    expenseRatioPct: pct(totalExpenses, totalIncome),
  };
}
