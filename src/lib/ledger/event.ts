/**
 * Ledger event — the envelope of the append-only journal that is the SYSTEM OF RECORD
 * (T-06 / ADR-0001, INV-1; Canonical CL-2/CL-4/CL-7).
 *
 * PURE. Financial truth is an append-only stream of immutable events; balances, registers and
 * reports are PROJECTIONS derived by replay (replay.ts). A correction is a new REVERSING event
 * that references the original — never a mutation or a delete (CL-2). This is what retires the
 * RULE 1 failure class: a failed write is a non-event, so there is nothing to diverge.
 *
 * The envelope carries WHO / WHAT / WHEN / WHY / provenance (the Canonical Audit Envelope; the
 * API event contract, EVT-2; and AI-A attribution): a `producer` principal — human, AI agent,
 * import or integration — with an on-behalf-of, so an AI agent's events are attributed exactly
 * like a human's. `eventId` and `occurredAt` are INJECTED so an event is deterministic under
 * test and a server writer can stamp the real time.
 */

export type EventPrincipalKind = 'human' | 'agent' | 'import' | 'integration';

/** WHO caused the event. An AI agent (AI-A2) records the human it acted on behalf of. */
export interface EventPrincipal {
  kind: EventPrincipalKind;
  id?: string | null;
  onBehalfOf?: string | null;
}

export interface LedgerEvent {
  eventId: string;
  /** Versioned, past-tense fact — e.g. 'voucher.posted', 'voucher.reversed', 'member.admitted'. */
  eventType: string;
  schemaVersion: number;
  tenantId: string;
  jurisdiction: string;
  aggregateType: string;
  aggregateId: string;
  /** Per-(tenant, aggregate) ordering, 1-based. Gapless per aggregate. */
  sequence: number;
  /** ISO event time (injected). */
  occurredAt: string;
  producer: EventPrincipal;
  /** The eventId this event reverses (CL-2). Present only on reversing events. */
  reversalOf?: string;
  /** Versioned payload contract (typed at the edge; opaque here). */
  payload: unknown;
}

export interface BuildEventInput {
  eventType: string;
  schemaVersion?: number;
  tenantId: string;
  jurisdiction?: string;
  aggregateType: string;
  aggregateId: string;
  sequence: number;
  producer: EventPrincipal;
  reversalOf?: string;
  payload: unknown;
}

export interface EventContext {
  /** Injected — a globally-unique id (crypto.randomUUID at the call site). */
  eventId: string;
  /** Injected ISO time. */
  occurredAt: string;
}

const PRINCIPAL_KINDS: ReadonlySet<string> = new Set(['human', 'agent', 'import', 'integration']);

/**
 * PURE — shape and VALIDATE a ledger event. Throws on a malformed envelope: a bad event of
 * record is worse than a rejected write (the whole point of an event log is that what it holds
 * is trustworthy).
 */
export function buildEvent(input: BuildEventInput, ctx: EventContext): LedgerEvent {
  const req = (v: unknown, name: string) => {
    if (typeof v !== 'string' || v.trim().length === 0) throw new RangeError(`ledger event: ${name} is required`);
  };
  req(ctx.eventId, 'eventId');
  req(ctx.occurredAt, 'occurredAt');
  req(input.eventType, 'eventType');
  req(input.tenantId, 'tenantId');
  req(input.aggregateType, 'aggregateType');
  req(input.aggregateId, 'aggregateId');
  if (!input.producer || !PRINCIPAL_KINDS.has(input.producer.kind)) {
    throw new RangeError(`ledger event: producer.kind must be one of ${[...PRINCIPAL_KINDS].join('/')}`);
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new RangeError(`ledger event: sequence must be a positive integer, got ${input.sequence}`);
  }
  return {
    eventId: ctx.eventId,
    eventType: input.eventType,
    schemaVersion: input.schemaVersion ?? 1,
    tenantId: input.tenantId,
    jurisdiction: input.jurisdiction ?? '',
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    sequence: input.sequence,
    occurredAt: ctx.occurredAt,
    producer: input.producer,
    ...(input.reversalOf ? { reversalOf: input.reversalOf } : {}),
    payload: input.payload,
  };
}

/** PURE — is this a reversing (correction) event? */
export function isReversal(e: LedgerEvent): boolean {
  return typeof e.reversalOf === 'string' && e.reversalOf.length > 0;
}

export interface ReverseOptions {
  /** The next sequence for the aggregate (a reversal is a NEW event, appended — never a delete). */
  sequence: number;
  producer: EventPrincipal;
  /** The reversing payload — for a posting, the original with Dr/Cr flipped (caller-computed,
   *  since only the caller knows the payload shape). */
  payload: unknown;
  /** WHY the correction was made (CL-7). */
  reason?: string;
  /** Override the reversal eventType; defaults to `<aggregateType>.reversed`. */
  eventType?: string;
}

/**
 * PURE — build the reversing event for an original (CL-2). Same aggregate, a NEW (later)
 * sequence, `reversalOf` set to the original's id. The original event stays in the log
 * forever; the reversal nets it out on replay. Corrections never mutate or delete.
 */
export function reverseEvent(original: LedgerEvent, ctx: EventContext, opts: ReverseOptions): LedgerEvent {
  if (!original?.eventId) throw new RangeError('reverseEvent: original event has no id');
  return buildEvent(
    {
      eventType: opts.eventType ?? `${original.aggregateType}.reversed`,
      schemaVersion: original.schemaVersion,
      tenantId: original.tenantId,
      jurisdiction: original.jurisdiction,
      aggregateType: original.aggregateType,
      aggregateId: original.aggregateId,
      sequence: opts.sequence,
      producer: opts.producer,
      reversalOf: original.eventId,
      payload: opts.reason ? { ...(opts.payload as object), reason: opts.reason } : opts.payload,
    },
    ctx,
  );
}
