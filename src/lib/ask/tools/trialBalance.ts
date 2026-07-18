/**
 * D-lane tool — does the society's trial balance tie out, and to what totals (CAIOS Slice 4). PURE.
 *
 * Same rule as cashBalance.ts: the assistant must give the figure the Trial Balance page
 * gives, not a similar one. So it calls the EXACT builder the ledger read-cut uses
 * (`ledgerTrialBalance`, T-09) — the same rows the page renders — and only sums them.
 * Nothing is re-derived from the journal a second way.
 *
 * The value is twofold. "कुल नाम / कुल जमा कितना है" is a real question an accountant asks;
 * and "does it balance?" is a data-integrity check the user can run in one sentence — a
 * non-zero difference means an unbalanced entry leaked in, which no report page shouts about
 * but every auditor cares about.
 *
 * THE SUM IS IN PAISE, NOT RUPEES. ledgerTrialBalance returns rupee floats for display;
 * adding hundreds of floats and testing the total for equality is exactly the drift the
 * money primitive (ADR-0006/T-02) exists to retire. So each row is converted back to exact
 * paise and summed as integers — a difference of one paisa is then real, not rounding.
 *
 * PURE: events and accounts are passed in; the fetch is the seam's job.
 */
import { ledgerTrialBalance } from '../../ledger/trialBalance';
import { toMinor } from '../../money';
import type { LedgerEvent } from '../../ledger/event';
import type { LedgerAccount } from '@/types';
import { formatMinorInr } from './cashBalance';

export interface TrialBalanceCheckInput {
  events: readonly LedgerEvent[];
  accounts: readonly LedgerAccount[];
  /** As of this date (inclusive). Omit for everything so far. */
  asOf?: string;
}

export interface TrialBalanceCheckResult {
  totalDebitMinor: number;
  totalCreditMinor: number;
  /** Dr − Cr, in paise. Zero ⇒ the books tie out. */
  differenceMinor: number;
  balanced: boolean;
  /** The ONLY strings a model may quote (blueprint §3.7 number check). */
  formattedDebit: string;
  formattedCredit: string;
  formattedDifference: string;
  /** How many non-group accounts are behind the totals. */
  accountCount: number;
}

/**
 * PURE — the trial balance totals the Trial Balance page would show for this scope, and
 * whether they tie out. Returns null only when there are no accounts at all (an empty
 * chart is not a balanced book — saying "₹0 = ₹0 ✓" would be a confident lie).
 */
export function trialBalanceCheck(input: TrialBalanceCheckInput): TrialBalanceCheckResult | null {
  const rows = ledgerTrialBalance(input.events, input.accounts, input.asOf);
  if (!rows.length) return null;

  let totalDebitMinor = 0;
  let totalCreditMinor = 0;
  for (const r of rows) {
    // toMinor recovers exact paise from a clean 2-decimal rupee value, so the integer
    // sums are exact — this is the same total the page shows, without float drift.
    totalDebitMinor += toMinor(r.totalDebit);
    totalCreditMinor += toMinor(r.totalCredit);
  }
  const differenceMinor = totalDebitMinor - totalCreditMinor;

  return {
    totalDebitMinor,
    totalCreditMinor,
    differenceMinor,
    balanced: differenceMinor === 0,
    formattedDebit: formatMinorInr(totalDebitMinor),
    formattedCredit: formatMinorInr(totalCreditMinor),
    formattedDifference: formatMinorInr(Math.abs(differenceMinor)),
    accountCount: rows.length,
  };
}
