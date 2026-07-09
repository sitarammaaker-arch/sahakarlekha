/**
 * Opening-balance carry-forward (ECR-09).
 *
 * Turns the prior year's audited closing (society.previousYearBalances: accountId → signed
 * amount, positive = debit, negative = credit) into opening-balance entries. Pure &
 * deterministic → unit-tested by scripts/test-opening-balances.mjs.
 */
export interface OpeningEntry {
  accountId: string;
  amount: number;
  type: 'debit' | 'credit';
}

/** Map prior-year closing balances to opening entries (drops zeros, 2dp, sorted by account). */
export function carryForwardOpenings(previousYearBalances: Record<string, number> | undefined): OpeningEntry[] {
  return Object.entries(previousYearBalances || {})
    .filter(([, v]) => Math.abs(v || 0) > 0.005)
    .map(([accountId, v]) => ({
      accountId,
      amount: Math.round(Math.abs(v) * 100) / 100,
      type: (v >= 0 ? 'debit' : 'credit') as 'debit' | 'credit',
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}
