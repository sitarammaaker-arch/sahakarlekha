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

// ─── Universal Importer → opening balances (T-04) ────────────────────────────────────

/** The three columns the Opening Balances import template carries. */
export interface ImportedOpeningRow {
  account_name: string;
  opening_balance: string;
  balance_type: string;
}

/** Same normalisation the importer's validator uses, so preview and commit agree. */
const normName = (s: string): string => (s || '').toLowerCase().trim();

/**
 * PURE — resolve validated import rows against the live chart of accounts.
 *
 * Rows whose account name does not resolve are DROPPED and returned in `unmatched`,
 * never silently swallowed (RULE 1 / P7). The last row wins if a name repeats, which
 * mirrors the old localStorage keyed-by-accountId behaviour.
 */
export function mapImportedOpenings(
  rows: ImportedOpeningRow[],
  accounts: { id: string; name: string }[]
): { entries: OpeningEntry[]; unmatched: string[] } {
  const byName = new Map(accounts.map(a => [normName(a.name), a.id]));
  const resolved = new Map<string, OpeningEntry>();
  const unmatched: string[] = [];

  for (const row of rows) {
    const id = byName.get(normName(row.account_name));
    if (!id) { unmatched.push(row.account_name); continue; }
    const amount = Math.round((parseFloat(row.opening_balance) || 0) * 100) / 100;
    const type = normName(row.balance_type) === 'credit' ? 'credit' : 'debit';
    resolved.set(id, { accountId: id, amount, type });
  }

  return {
    entries: [...resolved.values()].sort((a, b) => a.accountId.localeCompare(b.accountId)),
    unmatched,
  };
}
