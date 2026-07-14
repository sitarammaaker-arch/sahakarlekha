/**
 * Cash / Bank book from the event journal (T-09 / ADR-0001). PURE. The ledger-native equivalent of
 * DataContext.getCashBookEntries / getBankBookEntries — a running-balance transaction list for one
 * cash/bank account.
 *
 * A transaction LIST (unlike a balance) must show each aggregate's CURRENT state, not its whole
 * append-only history, so this resolves each voucher aggregate to one effective transaction:
 *   • a CANCELLED voucher (has a `voucher.cancelled` event) → excluded entirely (isDeleted in the app);
 *   • an EDITED voucher (`voucher.reposted`) → the latest reposted legs (posted+reversed nett out);
 *   • otherwise → the `voucher.posted` legs.
 * Rows sort by (date, createdAt) — the same order getCashBookEntries uses (the running balance depends
 * on it), which is why the payload carries `createdAt` (see voucherEventMeta). particulars =
 * narration || contra-account name. Exact paise throughout (T-02).
 *
 * NOT WIRED yet — the T-09 cut will gate getCashBookEntries on this (flag + a per-report parity check)
 * after a re-seed; building + testing the projection in isolation first. See the T-09 runbook §2b.
 */
import type { LedgerAccount } from '@/types';
import type { LedgerEvent } from './event';
import { isValidMinor } from '../money';

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

interface Leg { accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number; }

function legsOf(payload: unknown): Leg[] {
  if (!payload || typeof payload !== 'object') return [];
  const arr = (payload as { lines?: unknown }).lines;
  if (!Array.isArray(arr)) return [];
  const out: Leg[] = [];
  for (const l of arr) {
    if (l && typeof l === 'object'
      && typeof (l as Leg).accountId === 'string'
      && ((l as Leg).drCr === 'Dr' || (l as Leg).drCr === 'Cr')
      && isValidMinor((l as Leg).amountMinor)) {
      out.push({ accountId: (l as Leg).accountId, drCr: (l as Leg).drCr, amountMinor: (l as Leg).amountMinor });
    }
  }
  return out;
}

const str = (payload: unknown, key: string): string => {
  const v = payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[key] : undefined;
  return typeof v === 'string' ? v : '';
};

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

  // 1. Resolve each voucher aggregate to its ONE current effective event (or drop it if cancelled).
  const byAgg = new Map<string, LedgerEvent[]>();
  for (const e of Array.isArray(events) ? events : []) {
    if (e.aggregateType !== 'voucher') continue; // account.opening etc. are not cash-book transactions
    (byAgg.get(e.aggregateId) ?? byAgg.set(e.aggregateId, []).get(e.aggregateId)).push(e);
  }
  const current: { id: string; date: string; voucherNo: string; narration: string; createdAt: string; legs: Leg[] }[] = [];
  for (const [id, evs] of byAgg) {
    if (evs.some((e) => e.eventType === 'voucher.cancelled')) continue; // deleted → not in the cash book
    const reposted = evs.filter((e) => e.eventType === 'voucher.reposted');
    const ev = reposted.length ? reposted[reposted.length - 1] : evs.find((e) => e.eventType === 'voucher.posted');
    if (!ev) continue;
    const p = ev.payload;
    current.push({ id, date: str(p, 'date') || ev.occurredAt.slice(0, 10), voucherNo: str(p, 'voucherNo'), narration: str(p, 'narration'), createdAt: str(p, 'createdAt'), legs: legsOf(p) });
  }

  // 2. Sort by (date, createdAt) — the exact order getCashBookEntries uses.
  current.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  // 3. Accumulate the running balance; pre-fromDate folds into opening, post-toDate is excluded.
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
