/**
 * D-lane tool — the society's cash balance (CAIOS Slice 4). PURE.
 *
 * THE ONE RULE THIS FILE EXISTS TO OBEY: the assistant must give the figure the Cash Book
 * page gives. Not a similar figure — the same one. So it calls exactly what the page
 * calls (`ledgerCashBookEntries`, the journal projection its parity-gated selector
 * returns — DataContext.tsx:4465), and it derives the opening exactly the way the page
 * does, including the branch rule. Nothing here is re-implemented; every line is either
 * a call into shared code or the same arithmetic in the same order.
 *
 * Why that matters more than it sounds: an assistant that disagrees with the screen by
 * ₹1 is worse than one that says "I don't know". The user cannot tell which is lying, so
 * they stop trusting both — and the accounting was never the thing that was wrong.
 *
 * PURE: events and accounts are passed in. The fetch is the seam's job (I/O), and keeping
 * it out means this whole decision path is testable without a server.
 */
/* WHICH function — a refinement of the Slice-4 step-2 decision, not a reversal of it.
   The decision was the JOURNAL (over React state), and it stands. But of the two journal
   entry points:
       ledgerCashBookEntries = projectCashBook(...).map(r => toRupees(r.…Minor))
   the wrapper only adds a DISPLAY conversion to rupees — floats. A tool needs the exact
   paise (ADR-0006/T-02): going to rupees and back is precisely the float-drift class the
   money primitive exists to retire. So the tool takes `projectCashBook` — the identical
   projection the page renders, one step before it is rounded for the eye. */
import { projectCashBook } from '../../ledger/cashBook';
import type { LedgerEvent } from '../../ledger/event';
import { unbranchedInScope } from '../../branchScope';
import { toMinor } from '../../money';
import { ACCOUNT_IDS } from '../../storage';
import type { LedgerAccount } from '@/types';

/**
 * The cash account, IMPORTED — never restated.
 *
 * I first hard-coded '1101' here from memory. It is '3301'. That is the whole argument
 * in one line: a duplicated constant is silently wrong the day the chart of accounts
 * moves, and this tool would confidently report some other account's balance as the
 * society's cash.
 */
const CASH_ACCOUNT_ID = ACCOUNT_IDS.CASH;

export interface CashBalanceInput {
  /**
   * Journal events. NOTE their leg shape, because it is not the voucher's and getting it
   * wrong FAILS SILENTLY: `legsOf` (aggregateState.ts) skips any leg it does not
   * recognise, so a mis-shaped event yields an EMPTY projection and the balance comes
   * back as just the opening — a plausible-looking number that is simply wrong.
   *
   *     payload.lines[] = { accountId, drCr: 'Dr' | 'Cr', amountMinor }
   *                              ↑ not `type`      ↑ PAISE, not rupees
   *
   * The journal stores exact money; only the page converts to rupees for display.
   */
  events: readonly LedgerEvent[];
  accounts: readonly LedgerAccount[];
  /** The branch being viewed. '' / undefined = consolidated. */
  activeBranchId?: string;
  headOfficeBranchId?: string;
  /** Balance AS OF this date (inclusive). Omit for "everything so far". */
  asOf?: string;
}

export interface CashBalanceResult {
  /** Dr-positive, in paise (ADR-0006). Never a float, never rupees. */
  balanceMinor: number;
  /** Formatted for a human — the ONLY string a model may quote (blueprint §3.7). */
  formatted: string;
  /** How many cash movements are behind it — lets an answer say "as of N entries". */
  entryCount: number;
  asOf: string | null;
  /**
   * FALSE when the opening was excluded because a branch is being viewed (ECR-17).
   * Surfaced, not hidden: a branch's cash book legitimately excludes the society's
   * opening, and a user comparing it to the consolidated figure deserves to know why
   * rather than conclude the software is broken.
   */
  openingIncluded: boolean;
}

/**
 * PURE — the cash balance the Cash Book page would show for this scope.
 *
 * Returns null when the cash account does not exist, exactly as the page returns [] —
 * an absent account is not a zero balance, and saying "₹0" would be a lie with a
 * confident face.
 */
export function cashBalance(input: CashBalanceInput): CashBalanceResult | null {
  const cash = input.accounts.find((a) => a.id === CASH_ACCOUNT_ID);
  if (!cash) return null;

  /* ECR-17, and the single most likely way this tool returns a wrong number: account
     openings carry no branchId, so they belong to the HEAD OFFICE. A branch view gets
     ZERO opening — otherwise every branch's book carries 100% of the society's openings
     and the branches sum to more than the consolidated. `unbranchedInScope` is the same
     predicate the page uses; it is imported, never restated. */
  const openingIncluded = unbranchedInScope(input.activeBranchId ?? '', input.headOfficeBranchId);
  const openingMinor = openingIncluded
    ? toMinor(cash.openingBalanceType === 'debit' ? cash.openingBalance : -cash.openingBalance)
    : 0;

  // The same projection the page renders (see the import note). `toDate` bounds it;
  // pre-window movements fold into the opening rather than emitting rows, so the last
  // row's running balance IS the balance as of that date.
  const rows = projectCashBook(input.events, CASH_ACCOUNT_ID, input.accounts, {
    openingMinor,
    toDate: input.asOf,
  });

  // No movements ⇒ the balance is the opening. Reading rows[last] blindly would return
  // undefined and NaN its way onto a payslip-adjacent screen.
  const balanceMinor = rows.length ? rows[rows.length - 1].runningBalanceMinor : openingMinor;

  return {
    balanceMinor,
    formatted: formatMinorInr(balanceMinor),
    entryCount: rows.length,
    asOf: input.asOf ?? null,
    openingIncluded,
  };
}

/**
 * PURE — paise → "₹1,23,456.78", Indian digit grouping.
 *
 * The model is handed THIS string and may quote nothing else (blueprint §3.7's number
 * check is a set-membership test on tool output). Negative is rendered "-₹…", not
 * "₹-…" — a cash account can legitimately go Cr in a wrong-entry situation, and the
 * minus must not hide behind the symbol.
 */
export function formatMinorInr(minor: number): string {
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const rupees = Math.floor(abs / 100);
  const paise = String(abs % 100).padStart(2, '0');
  return `${neg ? '-' : ''}₹${rupees.toLocaleString('en-IN')}.${paise}`;
}
