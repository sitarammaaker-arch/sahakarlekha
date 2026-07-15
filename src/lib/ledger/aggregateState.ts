/**
 * Current voucher state from the event log (T-09 / ADR-0001). PURE. The ONE place the append-only
 * journal is resolved to each voucher's CURRENT effective transaction, shared by every ledger
 * transaction/statement projection (cash book, member ledger, R&P) so they cannot diverge (RULE 2):
 *   • a CANCELLED voucher (has a `voucher.cancelled` event) → dropped (isDeleted in the app);
 *   • an EDITED voucher (`voucher.reposted`) → the latest reposted legs (posted+reversed nett out);
 *   • otherwise → the `voucher.posted` legs.
 * Balances (trial balance etc.) sum ALL events and don't need this — only transaction LISTS do.
 */
import type { LedgerEvent } from './event';
import { isValidMinor } from '../money';

export interface CurrentLeg { accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number; }

export interface CurrentVoucher {
  id: string;
  date: string;
  voucherNo: string;
  narration: string;
  createdAt: string;
  memberId: string;
  /** voucher amount in RUPEES (payload.amount) — some reports use it directly (e.g. member ledger). */
  amount: number;
  legs: CurrentLeg[];
  /** journal-first-write (slice 1/2): the remaining vouchers-table fields, so the row is rebuildable. */
  type: string;
  branchId: string;
  createdBy: string;
}

function legsOf(payload: unknown): CurrentLeg[] {
  if (!payload || typeof payload !== 'object') return [];
  const arr = (payload as { lines?: unknown }).lines;
  if (!Array.isArray(arr)) return [];
  const out: CurrentLeg[] = [];
  for (const l of arr) {
    if (l && typeof l === 'object'
      && typeof (l as CurrentLeg).accountId === 'string'
      && ((l as CurrentLeg).drCr === 'Dr' || (l as CurrentLeg).drCr === 'Cr')
      && isValidMinor((l as CurrentLeg).amountMinor)) {
      out.push({ accountId: (l as CurrentLeg).accountId, drCr: (l as CurrentLeg).drCr, amountMinor: (l as CurrentLeg).amountMinor });
    }
  }
  return out;
}
const str = (p: unknown, k: string): string => {
  const v = p && typeof p === 'object' ? (p as Record<string, unknown>)[k] : undefined;
  return typeof v === 'string' ? v : '';
};
const num = (p: unknown, k: string): number => {
  const v = p && typeof p === 'object' ? (p as Record<string, unknown>)[k] : undefined;
  return typeof v === 'number' ? v : 0;
};

/**
 * PURE — resolve every voucher aggregate in the log to its one current effective transaction
 * (unsorted). Skips cancelled aggregates; for an edited one takes the latest reposted event, else the
 * posted event. Non-voucher aggregates (account.opening) are ignored.
 */
export function resolveCurrentVouchers(events: readonly LedgerEvent[]): CurrentVoucher[] {
  const byAgg = new Map<string, LedgerEvent[]>();
  for (const e of Array.isArray(events) ? events : []) {
    if (e.aggregateType !== 'voucher') continue;
    (byAgg.get(e.aggregateId) ?? byAgg.set(e.aggregateId, []).get(e.aggregateId)).push(e);
  }
  const out: CurrentVoucher[] = [];
  for (const [id, evs] of byAgg) {
    if (evs.some((e) => e.eventType === 'voucher.cancelled')) continue;
    const reposted = evs.filter((e) => e.eventType === 'voucher.reposted');
    const ev = reposted.length ? reposted[reposted.length - 1] : evs.find((e) => e.eventType === 'voucher.posted');
    if (!ev) continue;
    const p = ev.payload;
    out.push({ id, date: str(p, 'date') || ev.occurredAt.slice(0, 10), voucherNo: str(p, 'voucherNo'), narration: str(p, 'narration'), createdAt: str(p, 'createdAt'), memberId: str(p, 'memberId'), amount: num(p, 'amount'), legs: legsOf(p), type: str(p, 'type'), branchId: str(p, 'branchId'), createdBy: str(p, 'createdBy') });
  }
  return out;
}

/**
 * PURE — the eventId of a voucher aggregate's CURRENT effective posting: its latest `voucher.reposted`
 * (an edited voucher), else its `voucher.posted`. This is the event a NEW reversing event
 * (voucher.cancelled, or the reversed half of an edit) should point its `reversalOf` at (CL-2 lineage)
 * — computed BEFORE the reversing event is appended, so the not-yet-added cancel/reversed isn't seen.
 */
export function currentPostingEventId(events: readonly LedgerEvent[], aggregateId: string): string | undefined {
  let postedId: string | undefined;
  let repostId: string | undefined;
  let repostSeq = -1;
  for (const e of Array.isArray(events) ? events : []) {
    if (e.aggregateType !== 'voucher' || e.aggregateId !== aggregateId) continue;
    if (e.eventType === 'voucher.posted') postedId = e.eventId;
    else if (e.eventType === 'voucher.reposted' && e.sequence > repostSeq) { repostSeq = e.sequence; repostId = e.eventId; }
  }
  return repostId ?? postedId;
}
