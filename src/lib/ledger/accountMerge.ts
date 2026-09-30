/**
 * Account merge → voucher re-points + journal events (T-09 / ADR-0001). PURE.
 *
 * Merging account `removeId` into `keepId` re-points every voucher leg from removeId to keepId. After
 * the T-09 cutover every statement reads the JOURNAL, so re-pointing only the vouchers table would
 * leave the postings on removeId in ledger_events (the table says keepId, the reports say removeId).
 * So each re-pointed voucher that has a live posting in the journal is journaled exactly like an
 * edit (updateVoucher): `voucher.reversed` of its CURRENT posting + `voucher.reposted` with the new
 * legs. The log is never mutated in place (CL-2).
 *
 * Vouchers that get NO event (table re-point only):
 *   • cancelled (isDeleted) — their posted + cancelled events already net to zero, and the aggregate
 *     is dropped by resolveCurrentVouchers; journaling a repost would resurrect it;
 *   • pending approval / no posting in the journal — nothing is posted yet, so there is nothing to
 *     reverse, and seeding a `voucher.posted` would post a voucher that has not been approved. When it
 *     is approved later it posts with its (already re-pointed) legs.
 *
 * The caller must hold the FULL journal in `events` (journalLoadedRef) — sequences are derived from it
 * and a partial log would collide on the WORM unique (aggregate, sequence) index.
 */
import type { Voucher } from '@/types';
import { buildEvent, type LedgerEvent } from './event';
import { currentPostingEventId } from './aggregateState';
import { voucherPostingLines, voucherEventMeta, type EventPostingLine } from './voucherEvent';

/** PURE — the voucher with every removeId reference re-pointed to keepId, or null when it has none. */
export function repointVoucher(v: Voucher, keepId: string, removeId: string): Voucher | null {
  let changed = false;
  const next: Voucher = { ...v };
  if (next.debitAccountId === removeId) { next.debitAccountId = keepId; changed = true; }
  if (next.creditAccountId === removeId) { next.creditAccountId = keepId; changed = true; }
  if (next.lines && next.lines.some(l => l.accountId === removeId)) {
    next.lines = next.lines.map(l => (l.accountId === removeId ? { ...l, accountId: keepId } : l));
    changed = true;
  }
  return changed ? next : null;
}

/** A voucher gets merge events only when it is live AND has a posting in the journal to reverse. */
export function isJournaledForMerge(v: Voucher, events: readonly LedgerEvent[]): boolean {
  return !v.isDeleted && v.approvalStatus !== 'pending' && !!currentPostingEventId(events, v.id);
}

export interface AccountMergeInput {
  vouchers: readonly Voucher[];
  /** The FULL journal (every event of the tenant). */
  events: readonly LedgerEvent[];
  keepId: string;
  removeId: string;
  tenantId: string;
  jurisdiction?: string;
  producerId: string | null;
  /** Injected — ISO time stamped on every event. */
  occurredAt: string;
  /** Injected — a globally-unique id per event (crypto.randomUUID at the call site). */
  newEventId: () => string;
}

export interface AccountMergePlan {
  /** Every voucher that references removeId, before and after the re-point (cancelled ones included). */
  changed: { before: Voucher; after: Voucher }[];
  /** reversed + reposted pairs, in voucher order — append as ONE atomic batch. */
  events: LedgerEvent[];
  /** How many vouchers got a reversed + reposted pair. */
  journaledCount: number;
}

function legsOf(payload: unknown): EventPostingLine[] | null {
  const arr = payload && typeof payload === 'object' ? (payload as { lines?: unknown }).lines : undefined;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out: EventPostingLine[] = [];
  for (const l of arr) {
    const x = l as EventPostingLine;
    if (!x || typeof x.accountId !== 'string' || (x.drCr !== 'Dr' && x.drCr !== 'Cr') || !Number.isInteger(x.amountMinor)) return null;
    out.push({ accountId: x.accountId, drCr: x.drCr, amountMinor: x.amountMinor });
  }
  return out;
}

/**
 * PURE — plan the merge: the re-pointed vouchers and the journal events that move their postings.
 * The reversed half carries the flipped legs of the posting it points at (reversalOf), so it nets
 * that exact event to zero even if the journal and the vouchers table had drifted; the repost carries
 * the re-pointed voucher's legs, so afterwards the journal equals the table for every merged voucher.
 */
export function planAccountMerge(input: AccountMergeInput): AccountMergePlan {
  const { vouchers, events, keepId, removeId } = input;
  if (!keepId || !removeId || keepId === removeId) throw new RangeError('account merge: keepId and removeId must be two different accounts');

  const changed: { before: Voucher; after: Voucher }[] = [];
  const out: LedgerEvent[] = [];
  let journaledCount = 0;

  for (const v of vouchers) {
    const after = repointVoucher(v, keepId, removeId);
    if (!after) continue;
    changed.push({ before: v, after });
    if (!isJournaledForMerge(v, events)) continue;

    const target = currentPostingEventId(events, v.id)!;
    const targetEvent = events.find(e => e.eventId === target);
    const reversalLines = (legsOf(targetEvent?.payload) ?? voucherPostingLines(v))
      .map(l => ({ ...l, drCr: (l.drCr === 'Dr' ? 'Cr' : 'Dr') as 'Dr' | 'Cr' }));
    let seq = 0;
    for (const e of events) if (e.aggregateType === 'voucher' && e.aggregateId === v.id && e.sequence > seq) seq = e.sequence;
    const base = {
      tenantId: input.tenantId, jurisdiction: input.jurisdiction,
      aggregateType: 'voucher' as const, aggregateId: v.id,
      producer: { kind: 'human' as const, id: input.producerId },
    };
    const meta = { mergedAccountId: removeId, intoAccountId: keepId, reason: 'account-merge' };
    out.push(
      buildEvent({ ...base, eventType: 'voucher.reversed', sequence: seq + 1, reversalOf: target, payload: { lines: reversalLines, ...voucherEventMeta(v), ...meta } }, { eventId: input.newEventId(), occurredAt: input.occurredAt }),
      buildEvent({ ...base, eventType: 'voucher.reposted', sequence: seq + 2, payload: { lines: voucherPostingLines(after), ...voucherEventMeta(after), ...meta } }, { eventId: input.newEventId(), occurredAt: input.occurredAt }),
    );
    journaledCount++;
  }
  return { changed, events: out, journaledCount };
}
