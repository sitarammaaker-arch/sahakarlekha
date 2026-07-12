/**
 * Outbound event stream — transactional-outbox projection (T-25 / API Constitution EVT-1..7; ADR-0001).
 *
 * PURE. Outbound integration is EVENT-NATIVE, projected from the immutable event log (ADR-0001),
 * never screen-scraped or polled (API-P5). This module is the SSOT for the outbound CONTRACT event
 * and the delivery semantics every consumer relies on:
 *
 *   EVT-1  one outbox entry per committed ledger fact — an emitted event always corresponds to a
 *          durably-committed fact and vice versa (the transactional WRITE is the wire layer's job;
 *          the 1:1 projection is fixed here).
 *   EVT-2  a canonical envelope (wire shape, distinct from storage — API-P1) with pseudonymous PII.
 *   EVT-3  at-least-once delivery + consumer idempotency by eventId; ordering per aggregate/tenant,
 *          NOT global.
 *   EVT-4  replayable from a durable cursor — rebuild consumer state, no lost-webhook data loss.
 *   EVT-5  corrections are new reversing events referencing the original (carries reversalOf; CL-2).
 *   EVT-6  no event carries data the consumer isn't entitled to (capability + tenant + jurisdiction).
 *   EVT-7  events are a versioned contract (schemaVersion; additively evolved).
 *
 * No I/O; deterministic (times/ids come from the already-committed ledger event).
 */
import type { LedgerEvent } from '@/lib/ledger/event';
import type { Capability } from '@/lib/navigation/capabilities';

/** The outbound CONTRACT event — the wire shape, deliberately distinct from internal storage
 *  (API-P1/EVT-2). A projection of a committed ledger event; a versioned payload, never a table dump. */
export interface OutboundEvent {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  tenantId: string;
  jurisdiction: string;
  aggregate: { type: string; id: string };
  sequence: number;
  occurredAt: string;
  producer: { kind: string; id?: string | null; onBehalfOf?: string | null };
  /** Present only on a reversing/compensating event (EVT-5 / CL-2). */
  reversalOf?: string;
  payload: unknown;
}

/**
 * PURE — project a committed ledger event (T-06) into the outbound contract envelope (EVT-1/EVT-2).
 * One outbound event per committed fact; the reversal link is carried so a consumer sees a
 * correction as a new fact, never an edit (EVT-5).
 */
export function projectOutboundEvent(e: LedgerEvent): OutboundEvent {
  const out: OutboundEvent = {
    eventId: e.eventId,
    eventType: e.eventType,
    schemaVersion: e.schemaVersion,
    tenantId: e.tenantId,
    jurisdiction: e.jurisdiction,
    aggregate: { type: e.aggregateType, id: e.aggregateId },
    sequence: e.sequence,
    occurredAt: e.occurredAt,
    producer: { kind: e.producer.kind, id: e.producer.id ?? null, onBehalfOf: e.producer.onBehalfOf ?? null },
    payload: e.payload,
  };
  if (e.reversalOf) out.reversalOf = e.reversalOf;
  return out;
}

/**
 * PURE — EVT-3 consumer idempotency: drop events already seen by eventId. Delivery is at-least-once,
 * so a consumer deduplicates; order is preserved.
 */
export function dedupeByEventId(events: readonly OutboundEvent[], seenIds: ReadonlySet<string>): OutboundEvent[] {
  const out: OutboundEvent[] = [];
  const within = new Set<string>();
  for (const e of events) {
    if (seenIds.has(e.eventId) || within.has(e.eventId)) continue;
    within.add(e.eventId);
    out.push(e);
  }
  return out;
}

/** The ordering scope: ordering is guaranteed per (tenant, aggregate), never globally (EVT-3). */
export function aggregateKey(e: Pick<OutboundEvent, 'tenantId' | 'aggregate'>): string {
  return `${e.tenantId}::${e.aggregate.type}::${e.aggregate.id}`;
}

/** A durable replay cursor: the last-delivered sequence per aggregate key (EVT-4). */
export type StreamCursor = Record<string, number>;

/**
 * PURE — EVT-4: the events a consumer has NOT yet seen, given its cursor — those whose per-aggregate
 * sequence is beyond the last delivered. Replaying from an empty cursor yields the whole stream.
 */
export function eventsAfter(events: readonly OutboundEvent[], cursor: StreamCursor): OutboundEvent[] {
  return events.filter((e) => e.sequence > (cursor[aggregateKey(e)] ?? 0));
}

/** PURE — advance a cursor after delivering `events` (EVT-4). The new cursor holds the max sequence
 *  seen per aggregate, so a resume delivers each fact exactly once per aggregate stream. */
export function advanceCursor(cursor: StreamCursor, events: readonly OutboundEvent[]): StreamCursor {
  const next: StreamCursor = { ...cursor };
  for (const e of events) {
    const k = aggregateKey(e);
    if (e.sequence > (next[k] ?? 0)) next[k] = e.sequence;
  }
  return next;
}

/** PURE — EVT-3: is the stream in per-aggregate order? For each aggregate the sequences must be
 *  strictly increasing in delivery order. (Cross-aggregate interleaving is allowed — no global order.) */
export function isInAggregateOrder(events: readonly OutboundEvent[]): boolean {
  const last: Record<string, number> = {};
  for (const e of events) {
    const k = aggregateKey(e);
    if (k in last && e.sequence <= last[k]) return false;
    last[k] = e.sequence;
  }
  return true;
}

/** A consumer/webhook subscription — a principal on the trust plane (EVT-6 / AUTH-3). */
export interface Subscription {
  tenantId: string;
  jurisdiction: string;
  /** Capabilities the consumer holds — it may only receive events of a data class it is entitled to. */
  scopes: readonly Capability[];
}

/**
 * PURE — EVT-6: may this event be delivered to this subscription? No cross-tenant reach, no
 * cross-jurisdiction egress (API-P6), and if the event's data class requires a capability the
 * consumer must hold it — no event carries data the consumer isn't entitled to. `capabilityFor`
 * maps an eventType → its required capability (null = no capability gate), declared contract-first.
 */
export function isDeliverable(
  e: OutboundEvent,
  sub: Subscription,
  capabilityFor: (eventType: string) => Capability | null,
): boolean {
  if (e.tenantId !== sub.tenantId) return false;
  if (e.jurisdiction !== sub.jurisdiction) return false;
  const needed = capabilityFor(e.eventType);
  return needed == null || sub.scopes.includes(needed);
}
