/**
 * Ledger-native trial balance (T-09 / ADR-0001) — the journal equivalent of DataContext.getTrialBalance,
 * as a PURE function. Projects the split trial balance from the event log and maps it onto the app's
 * AccountBalance shape (account metadata + rupees), so the read cut can serve getTrialBalance from the
 * ledger with an identical shape. Orphan legs (referencing a deleted/missing account) become synthetic
 * "[Deleted]" rows exactly as getTrialBalance does, so the trial balance still ties out.
 *
 * PURE — no React, no Supabase. The T-09 cut wires it: load the journal, gate on the per-tenant flag +
 * ledgerParity, and return this instead of the voucher-state compute. Building it here keeps the shape
 * mapping unit-testable before that wiring.
 */
import type { LedgerAccount, AccountBalance } from '@/types';
import { toRupees } from '@/lib/money';
import type { LedgerEvent } from './event';
import { projectSplitTrialBalance } from './projections';

export function ledgerTrialBalance(
  events: readonly LedgerEvent[],
  accounts: readonly LedgerAccount[],
  asOf?: string,
): AccountBalance[] {
  const split = projectSplitTrialBalance(events, asOf);
  const byId = new Map(split.lines.map((l) => [l.accountId, l]));
  const results: AccountBalance[] = [];
  const seen = new Set<string>();

  // Every real (non-group) account — zero-activity accounts show as zeros, like getTrialBalance.
  for (const account of Array.isArray(accounts) ? accounts : []) {
    if (account.isGroup) continue;
    seen.add(account.id);
    const l = byId.get(account.id);
    const oDr = l?.openingDrMinor ?? 0, oCr = l?.openingCrMinor ?? 0, tDr = l?.txnDrMinor ?? 0, tCr = l?.txnCrMinor ?? 0;
    const totDr = oDr + tDr, totCr = oCr + tCr;
    results.push({
      account,
      openingDebit: toRupees(oDr), openingCredit: toRupees(oCr),
      transactionDebit: toRupees(tDr), transactionCredit: toRupees(tCr),
      totalDebit: toRupees(totDr), totalCredit: toRupees(totCr),
      netBalance: toRupees(totDr - totCr),
    });
  }

  // Orphan legs — an account no longer in the chart. Synthetic "[Deleted]" row so the TB still balances.
  for (const l of split.lines) {
    if (seen.has(l.accountId)) continue;
    const account: LedgerAccount = {
      id: l.accountId,
      name: `[Deleted] ${l.accountId.slice(0, 8)}...`,
      nameHi: `[हटाया] ${l.accountId.slice(0, 8)}...`,
      type: 'liability',
      openingBalance: 0,
      openingBalanceType: 'credit',
    };
    results.push({
      account,
      openingDebit: toRupees(l.openingDrMinor), openingCredit: toRupees(l.openingCrMinor),
      transactionDebit: toRupees(l.txnDrMinor), transactionCredit: toRupees(l.txnCrMinor),
      totalDebit: toRupees(l.totalDrMinor), totalCredit: toRupees(l.totalCrMinor),
      netBalance: toRupees(l.netMinor),
    });
  }

  return results;
}
