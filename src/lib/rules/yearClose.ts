/**
 * Year-end close & opening balances (T-22 / TASK4.2 §7/§18; Canonical CL-1/CL-2; RULE 6).
 *
 * PURE. At financial-year end the books are CLOSED and the next year's OPENING balances are
 * derived — never hand-entered:
 *
 *   • the CLOSING trial balance is the projection of the log as-of the FY-end (the audited
 *     closing) — immutable, reproducible (T-07 / CL-2);
 *   • NOMINAL accounts (income / expense) close: their net is the surplus/deficit (net result);
 *   • REAL accounts (assets / liabilities / equity / funds) carry forward at their closing net;
 *   • the surplus is carried to retained earnings, so the opening balances BALANCE (Σ = 0, CL-1).
 *
 * Opening = prior audited closing, DERIVED (no manual override post-audit, TASK4.2 §7). A
 * PRIOR-PERIOD adjustment to a closed year is a NEW event in the current year — the closed
 * year's events are never mutated (CL-2); the as-of-FY-end closing stays fixed forever. The
 * appropriation of the surplus (T-20) and the FY-lock under AGM authority (T-23, RULE 6) are
 * the separate steps that follow this close.
 */
import { projectTrialBalance, type TrialBalance } from '../ledger/projections';
import type { LedgerEvent } from '../ledger/event';

/** real = balance-sheet (carries forward); nominal = income/expense (closes to the net result). */
export type AccountNature = 'real' | 'nominal';

export interface ClosingResult {
  fyEnd: string;
  /** The closing trial balance (projection as-of fyEnd) — the audited closing. */
  closing: TrialBalance;
  /** Surplus (positive) / deficit (negative), in minor units = income − expense. */
  netResultMinor: number;
  /** The next FY's opening balances (accountId → net minor, Dr positive). Balances to zero. */
  openingBalances: Record<string, number>;
}

/**
 * PURE — close the year and derive the opening balances. `natureOf` classifies each account
 * (real vs nominal); `carryForwardAccount` receives the surplus (retained earnings / P&L
 * carry-forward), so the opening set balances.
 */
export function computeYearClose(
  events: readonly LedgerEvent[],
  fyEnd: string,
  natureOf: (accountId: string) => AccountNature,
  carryForwardAccount: string,
): ClosingResult {
  const closing = projectTrialBalance(events, fyEnd);

  let nominalNet = 0;
  const opening: Record<string, number> = {};
  for (const line of closing.lines) {
    if (natureOf(line.accountId) === 'nominal') {
      nominalNet += line.netMinor; // nominal accounts close — excluded from the opening
    } else {
      opening[line.accountId] = line.netMinor; // real accounts carry forward
    }
  }

  // Net result = income − expense. netMinor is Dr − Cr, so income (Cr) is negative and expense
  // (Dr) positive: surplus = −(Σ nominal net).
  const netResultMinor = -nominalNet;

  // Carry the surplus to retained earnings (Cr it — a surplus reduces the Dr-positive net), so
  // the opening balances sum to zero.
  opening[carryForwardAccount] = (opening[carryForwardAccount] ?? 0) - netResultMinor;

  return { fyEnd, closing, netResultMinor, openingBalances: opening };
}

export interface OpeningLeg {
  accountId: string;
  drCr: 'Dr' | 'Cr';
  amountMinor: number;
}

/**
 * PURE — the opening balances as ledger event legs for the new FY (a Dr for a positive net, a
 * Cr for a negative net). Balanced by construction: Σ Dr === Σ Cr, because the opening balances
 * sum to zero. Appended to the journal, this makes opening = prior audited closing, reproducibly.
 */
export function openingBalanceLines(openingBalances: Record<string, number>): OpeningLeg[] {
  const legs: OpeningLeg[] = [];
  for (const [accountId, net] of Object.entries(openingBalances)) {
    if (net === 0) continue;
    legs.push({ accountId, drCr: net > 0 ? 'Dr' : 'Cr', amountMinor: Math.abs(net) });
  }
  return legs;
}
