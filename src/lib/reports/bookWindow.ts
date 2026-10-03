/**
 * PURE — opening / closing balance of a Cash Book or Bank Book DATE WINDOW (audit A-05).
 *
 * The pages used to print the account's all-time opening balance and the all-time closing
 * balance, whatever date filter or branch was active — so a book filtered to a month showed
 * the wrong opening, and a branch view showed the Head Office opening. The running balance
 * on each entry already carries the truth, so derive both figures from it.
 *
 * `entriesUpToTo` = every entry from the start of time up to the window's end date, in book
 * order (what `getCashBookEntries(undefined, toDate)` returns). `openingInScope` = the
 * account's own opening balance when it belongs to the active scope (Head Office rule), else 0.
 *
 * Dependency-free so scripts/test-book-window.mjs can import it directly.
 */
export interface BookRow { date: string; runningBalance: number }

export function bookWindow<T extends BookRow>(
  entriesUpToTo: readonly T[],
  fromDate: string | undefined,
  openingInScope: number,
): { opening: number; closing: number; window: T[] } {
  const before = fromDate ? entriesUpToTo.filter(e => e.date < fromDate) : [];
  const window = fromDate ? entriesUpToTo.filter(e => e.date >= fromDate) : [...entriesUpToTo];
  const opening = before.length > 0 ? before[before.length - 1].runningBalance : openingInScope;
  const closing = window.length > 0 ? window[window.length - 1].runningBalance : opening;
  return { opening, closing, window };
}
