/**
 * Payroll event envelope (Phase-4 `pay_calc.pay_event`, Phase-5 §8 / ADR-0001 extended). PURE —
 * no I/O, no clock, no randomness; `eventId` and `occurredAt` are INJECTED so events are
 * deterministic under test and a server writer stamps the real id/time.
 *
 * Payroll has its OWN append-only journal (`pay_event`), distinct from the ledger's
 * `ledger_events`. So this is a distinct envelope shaped to the `pay_event` table — but it
 * REUSES, not re-defines:
 *   · `EventPrincipalKind` (human|agent|import|integration) from the ledger event — one producer
 *     model, so an AI agent's payroll events are attributed exactly like a human's (ADR-0010);
 *   · `PayEventType` + `PAY_EVENT_TYPES` from runState.ts — one source for the lifecycle vocabulary.
 *
 * Corrections are REVERSING events (a new, later-sequence event with `reversalOf` set) — never a
 * mutation or delete. Gapless per-(society, run) sequence is the invariant.
 */

import type { EventPrincipalKind } from '@/lib/ledger/event';
import { type PayEventType, PAY_EVENT_TYPES } from './runState.ts';

/** WHO caused the event (Phase-4 `producer_kind` + `on_behalf_of` + `actor_email`). */
export interface PayEventProducer {
  kind: EventPrincipalKind;
  actorEmail: string;
  /** The human an AI agent acted on behalf of (ADR-0010). */
  onBehalfOf?: string | null;
}

/** One immutable payroll journal event — mirrors the `pay_calc.pay_event` columns (camelCase). */
export interface PayEvent {
  eventId: string;
  societyId: string;
  aggregateType: 'pay_run';
  aggregateId: string;
  /** Gapless, 1-based per (society, aggregate). */
  sequence: number;
  eventType: PayEventType;
  producerKind: EventPrincipalKind;
  onBehalfOf?: string | null;
  actorEmail: string;
  occurredAt: string;
  payload: unknown;
  schemaVersion: number;
  /** The eventId this event reverses (only on 'reversed' corrections). */
  reversalOf?: string;
}

export interface BuildPayEventInput {
  societyId: string;
  aggregateId: string;
  sequence: number;
  eventType: PayEventType;
  producer: PayEventProducer;
  payload?: unknown;
  schemaVersion?: number;
  reversalOf?: string;
}

export interface PayEventContext {
  /** Injected globally-unique id (crypto.randomUUID at the call site). */
  eventId: string;
  /** Injected ISO time. */
  occurredAt: string;
}

const PRINCIPAL_KINDS: ReadonlySet<string> = new Set(['human', 'agent', 'import', 'integration']);
const EVENT_TYPES: ReadonlySet<string> = new Set(PAY_EVENT_TYPES);

/**
 * PURE — shape and VALIDATE a payroll event. Throws on a malformed envelope: a bad event of
 * record is worse than a rejected write.
 */
export function buildPayEvent(input: BuildPayEventInput, ctx: PayEventContext): PayEvent {
  const req = (v: unknown, name: string) => {
    if (typeof v !== 'string' || v.trim().length === 0) throw new RangeError(`pay event: ${name} is required`);
  };
  req(ctx.eventId, 'eventId');
  req(ctx.occurredAt, 'occurredAt');
  req(input.societyId, 'societyId');
  req(input.aggregateId, 'aggregateId');
  req(input.producer?.actorEmail, 'producer.actorEmail');
  if (!input.producer || !PRINCIPAL_KINDS.has(input.producer.kind)) {
    throw new RangeError(`pay event: producer.kind must be one of ${[...PRINCIPAL_KINDS].join('/')}`);
  }
  if (!EVENT_TYPES.has(input.eventType)) {
    throw new RangeError(`pay event: eventType must be a PayEventType, got ${String(input.eventType)}`);
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new RangeError(`pay event: sequence must be a positive integer, got ${input.sequence}`);
  }
  if (input.eventType === 'reversed' && !input.reversalOf) {
    throw new RangeError("pay event: a 'reversed' event must carry reversalOf");
  }
  return {
    eventId: ctx.eventId,
    societyId: input.societyId,
    aggregateType: 'pay_run',
    aggregateId: input.aggregateId,
    sequence: input.sequence,
    eventType: input.eventType,
    producerKind: input.producer.kind,
    ...(input.producer.onBehalfOf != null ? { onBehalfOf: input.producer.onBehalfOf } : {}),
    actorEmail: input.producer.actorEmail,
    occurredAt: ctx.occurredAt,
    payload: input.payload ?? {},
    schemaVersion: input.schemaVersion ?? 1,
    ...(input.reversalOf ? { reversalOf: input.reversalOf } : {}),
  };
}

/** PURE — is this a reversing (correction) event? */
export function isReversal(e: PayEvent): boolean {
  return typeof e.reversalOf === 'string' && e.reversalOf.length > 0;
}

/** PURE — the next gapless sequence for an aggregate given the events already in the journal. */
export function nextSequence(events: readonly PayEvent[], aggregateId: string): number {
  let max = 0;
  for (const e of events) if (e.aggregateId === aggregateId && e.sequence > max) max = e.sequence;
  return max + 1;
}

/**
 * PURE — assert the events for one aggregate form a gapless 1..N sequence (the journal invariant).
 * Throws with the first gap/duplicate found.
 */
export function assertGaplessSequence(events: readonly PayEvent[], aggregateId: string): void {
  const seqs = events.filter((e) => e.aggregateId === aggregateId).map((e) => e.sequence).sort((a, b) => a - b);
  for (let i = 0; i < seqs.length; i++) {
    if (seqs[i] !== i + 1) {
      throw new RangeError(`pay event: sequence not gapless for ${aggregateId} — expected ${i + 1}, got ${seqs[i]}`);
    }
  }
}

export interface ReversePayEventOptions {
  sequence: number;
  producer: PayEventProducer;
  payload?: unknown;
  reason?: string;
}

/**
 * PURE — build the reversing event for an original (append-only correction). Same aggregate, a
 * NEW (later) sequence, `reversalOf` set to the original's id. The original stays forever.
 */
export function reversePayEvent(original: PayEvent, ctx: PayEventContext, opts: ReversePayEventOptions): PayEvent {
  if (!original?.eventId) throw new RangeError('reversePayEvent: original event has no id');
  return buildPayEvent(
    {
      societyId: original.societyId,
      aggregateId: original.aggregateId,
      sequence: opts.sequence,
      eventType: 'reversed',
      producer: opts.producer,
      reversalOf: original.eventId,
      schemaVersion: original.schemaVersion,
      payload: opts.reason ? { reversalOf: original.eventId, reason: opts.reason } : { reversalOf: original.eventId },
    },
    ctx,
  );
}
