/**
 * Year-end profit appropriation waterfall (ECR-10).
 *
 * Computes the statutory appropriation of net profit in order: Statutory Reserve Fund
 * (≥25%) → Education Fund → other configured funds → residual (available for dividend /
 * carry-forward). Percentages are of net profit. Pure & deterministic → unit-tested by
 * scripts/test-appropriation.mjs.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The minimum statutory reserve (% of net profit) under cooperative law. */
export const STATUTORY_RESERVE_MIN = 25;

export interface AppropriationFund {
  accountId: string;
  label: string;
  labelHi?: string;
  pct: number;
}
export interface AppropriationConfig {
  reservePct?: number;    // Statutory Reserve Fund (default 25)
  educationPct?: number;  // Education Fund (default 1)
  otherFunds?: AppropriationFund[];
}
export interface AppropriationStep {
  order: number;
  accountId: string;
  label: string;
  labelHi: string;
  pct: number;
  amount: number;
}
export interface AppropriationPlan {
  netProfit: number;
  steps: AppropriationStep[];
  totalAppropriated: number;
  residual: number;               // net profit − appropriations (for dividend / carry-forward)
  reserveBelowStatutory: boolean;  // reservePct < 25
}

/** Build the ordered appropriation plan for a net profit. Empty when net profit ≤ 0. */
export function appropriationWaterfall(netProfit: number, config: AppropriationConfig = {}): AppropriationPlan {
  const np = r2(Math.max(0, netProfit || 0));
  const reservePct = config.reservePct ?? 25;
  const educationPct = config.educationPct ?? 1;
  const steps: AppropriationStep[] = [];
  let order = 1;
  const push = (accountId: string, label: string, labelHi: string, pct: number) => {
    const p = Math.max(0, pct || 0);
    const amount = r2(np * p / 100);
    if (np > 0 && amount > 0) steps.push({ order: order++, accountId, label, labelHi, pct: p, amount });
  };
  push('1201', 'Statutory Reserve Fund', 'वैधानिक संचय निधि', reservePct);
  push('1203', 'Education Fund', 'शिक्षा निधि', educationPct);
  for (const f of config.otherFunds ?? []) push(f.accountId, f.label, f.labelHi ?? f.label, f.pct);

  const totalAppropriated = r2(steps.reduce((s, x) => s + x.amount, 0));
  return {
    netProfit: np,
    steps,
    totalAppropriated,
    residual: r2(np - totalAppropriated),
    reserveBelowStatutory: reservePct < STATUTORY_RESERVE_MIN,
  };
}
