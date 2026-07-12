/**
 * Reversing corrections — how a posted record is fixed (T-08 / ADR-0001; Canonical CL-2, CL-9;
 * RULE 3).
 *
 * PURE. A posted event is IMMUTABLE. It is never edited or deleted — it is CORRECTED by
 * appending new events:
 *
 *   cancel  = append a REVERSING event (the original's legs, every Dr/Cr flipped). Original +
 *             reversal net to zero on replay; the original stays in the log forever.
 *   edit    = reverse + RE-POST the corrected figures on the same voucher. History becomes
 *             [posted, reversed, posted] and the net effect is the corrected voucher.
 *   cascade = when a parent is reversed, its dependents are reversed too (RULE 3 / CL-9) —
 *             linked vouchers, sub-ledger effects, stock. The caller supplies the dependent set
 *             (the domain knows the graph); every original is retained.
 *
 * This is what retires the RULE 1 failure class at the model level: there is no in-place edit to
 * lose or diverge — only appends. Amounts are exact minor units (T-02); the fix is verified by
 * replaying the projections (T-07), which net every corrected account to the right figure.
 */
import { buildEvent, type LedgerEvent, type EventContext, type EventPrincipal } from './event';

interface Leg {
  accountId: string;
  drCr: 'Dr' | 'Cr';
  amountMinor: number;
}

const FLIP: Record<'Dr' | 'Cr', 'Dr' | 'Cr'> = { Dr: 'Cr', Cr: 'Dr' };

function legsOf(event: LedgerEvent): Leg[] {
  const arr = (event.payload as { lines?: unknown } | null)?.lines;
  return Array.isArray(arr) ? (arr as Leg[]) : [];
}

export interface ReverseOptions {
  /** The next sequence for the aggregate — a reversal is APPENDED, never a delete. */
  sequence: number;
  producer: EventPrincipal;
  /** WHY the correction was made (CL-7). */
  reason?: string;
}

/**
 * PURE — the reversing event for a posted voucher (CL-2). Its payload is the original's legs
 * with every Dr/Cr flipped, so it nets the original out on replay. A new sequence, `reversalOf`
 * set to the original's id, and the original object is NEVER touched (a new event is returned).
 */
export function reverseVoucher(original: LedgerEvent, ctx: EventContext, opts: ReverseOptions): LedgerEvent {
  const flipped = legsOf(original).map((l) => ({ ...l, drCr: FLIP[l.drCr] }));
  return buildEvent(
    {
      eventType: `${original.aggregateType}.reversed`,
      schemaVersion: original.schemaVersion,
      tenantId: original.tenantId,
      jurisdiction: original.jurisdiction,
      aggregateType: original.aggregateType,
      aggregateId: original.aggregateId,
      sequence: opts.sequence,
      producer: opts.producer,
      reversalOf: original.eventId,
      payload: { lines: flipped, ...(opts.reason ? { reason: opts.reason } : {}) },
    },
    ctx,
  );
}

/** PURE — CANCEL = append the reversal only (nothing re-posted). */
export function cancelVoucher(original: LedgerEvent, ctx: EventContext, opts: ReverseOptions): LedgerEvent {
  return reverseVoucher(original, ctx, opts);
}

/** PURE — RE-POST: the corrected voucher as a new posted event on the SAME aggregate (the
 *  voucher keeps its identity; the reversal + repost are its correction history). */
export function repostVoucher(
  original: LedgerEvent,
  correctedLines: readonly Leg[],
  ctx: EventContext,
  opts: { sequence: number; producer: EventPrincipal },
): LedgerEvent {
  return buildEvent(
    {
      eventType: original.eventType,
      schemaVersion: original.schemaVersion,
      tenantId: original.tenantId,
      jurisdiction: original.jurisdiction,
      aggregateType: original.aggregateType,
      aggregateId: original.aggregateId,
      sequence: opts.sequence,
      producer: opts.producer,
      payload: { lines: [...correctedLines] },
    },
    ctx,
  );
}

export interface EditOptions {
  reverse: { ctx: EventContext; sequence: number };
  repost: { ctx: EventContext; sequence: number };
  producer: EventPrincipal;
  reason?: string;
}

/**
 * PURE — EDIT = reverse + repost. Returns the TWO events to append (the original stays). The net
 * effect on the ledger is the corrected figures; the full history is [posted, reversed, posted].
 */
export function editVoucher(original: LedgerEvent, correctedLines: readonly Leg[], opts: EditOptions): [LedgerEvent, LedgerEvent] {
  const reversal = reverseVoucher(original, opts.reverse.ctx, { sequence: opts.reverse.sequence, producer: opts.producer, reason: opts.reason });
  const repost = repostVoucher(original, correctedLines, opts.repost.ctx, { sequence: opts.repost.sequence, producer: opts.producer });
  return [reversal, repost];
}

export interface ReversalRequest {
  original: LedgerEvent;
  ctx: EventContext;
  sequence: number;
}

/**
 * PURE — cascade a reversal across a parent AND its dependents (RULE 3 / CL-9). The caller
 * supplies the full set to reverse (the domain knows the dependency graph — a sale's voucher,
 * its GST voucher, its stock movement, the sub-ledger effect). Returns a reversal per request;
 * every original is retained. Reversing a parent without its dependents is exactly the
 * ghost-balance/orphan bug this enforces against.
 */
export function cascadeReversal(requests: readonly ReversalRequest[], producer: EventPrincipal, reason?: string): LedgerEvent[] {
  return requests.map((r) => reverseVoucher(r.original, r.ctx, { sequence: r.sequence, producer, reason }));
}
