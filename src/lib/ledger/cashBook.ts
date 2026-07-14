/**
 * Cash / Bank book from the event journal (T-09 / ADR-0001). PURE. The ledger-native equivalent of
 * DataContext.getCashBookEntries / getBankBookEntries — a running-balance transaction list for one
 * cash/bank account.
 *
 * Uses the shared current-voucher resolution (resolveCurrentVouchers — cancelled dropped, edited →
 * latest reposted, else posted), sorts by (date, createdAt) — the getCashBookEntries order the running
 * balance depends on — with particulars = narration || contra-account name, exact paise (T-02), and
 * pre-fromDate/post-toDate windowing.
 *
 * NOT WIRED yet — the T-09 cut will gate getCashBookEntries on this (flag + a per-report parity check)
 * after a re-seed, validated row-by-row against getCashBookEntries. See the T-09 runbook §2b.
 */
import type { LedgerAccount } from '@/types';
import type { LedgerEvent } from './event';
import { resolveCurrentVouchers } from './aggregateState';

export interface LedgerCashRow {
  /** the voucher (aggregate) id. */
  id: string;
  date: string;
  voucherNo: string;
  particulars: string;
  type: 'receipt' | 'payment';
  amountMinor: number;
  runningBalanceMinor: number;
}

/**
 * PURE — the running cash/bank book for `accountId`. `opts.openingMinor` seeds the running balance
 * (Dr-positive); pre-`fromDate` movements fold into it (no row); rows are within [fromDate, toDate].
 */
export function projectCashBook(
  events: readonly LedgerEvent[],
  accountId: string,
  accounts: readonly LedgerAccount[],
  opts: { openingMinor: number; fromDate?: string; toDate?: string },
): LedgerCashRow[] {
  const acctName = new Map(accounts.map((a) => [a.id, a.name]));

  // Current transactions, in the getCashBookEntries order (date, then createdAt).
  const current = resolveCurrentVouchers(events);
  current.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  // Accumulate the running balance; pre-fromDate folds into opening, post-toDate is excluded.
  let running = opts.openingMinor;
  const rows: LedgerCashRow[] = [];
  for (const c of current) {
    if (opts.toDate && c.date > opts.toDate) continue;
    const cashLegs = c.legs.filter((l) => l.accountId === accountId);
    if (cashLegs.length === 0) continue;
    const contra = c.legs.find((l) => l.accountId !== accountId);
    const particulars = c.narration || (contra ? (acctName.get(contra.accountId) ?? '') : '');
    for (const l of cashLegs) {
      running += l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor;
      if (opts.fromDate && c.date < opts.fromDate) continue; // fold into opening, emit no row
      rows.push({ id: c.id, date: c.date, voucherNo: c.voucherNo, particulars, type: l.drCr === 'Dr' ? 'receipt' : 'payment', amountMinor: l.amountMinor, runningBalanceMinor: running });
    }
  }
  return rows;
}
