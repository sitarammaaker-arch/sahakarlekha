/**
 * Run aggregate projection (Phase-5 §8/§9, mirrors ledger/aggregateState). PURE, order-independent.
 *
 * Folds a run's append-only pay_event stream into its CURRENT view: lifecycle state, a timeline,
 * and reversal awareness. This is the projection the orchestrator, reporting, and AI read instead
 * of re-deriving from the raw log — the single place the journal is resolved to "where is this run
 * now". Composes the foundation bricks: the event envelope (payEvent) for the stream + gapless
 * invariant, and the state machine (runState) for the lifecycle fold. Corrections are reversing
 * events (append-only); the original stays in the stream and is recorded as reversed.
 */

import { type PayEvent, isReversal, assertGaplessSequence } from './payEvent.ts';
import { type RunState, type PayEventType, stateAfterEvent, INITIAL_STATE, isTerminal } from './runState.ts';

export interface RunTimelineEntry {
  sequence: number;
  eventType: PayEventType;
  state: RunState;
  occurredAt: string;
}

export interface RunAggregate {
  runId: string;
  societyId: string;
  currentState: RunState;
  lastSequence: number;
  eventCount: number;
  reversalCount: number;
  isTerminal: boolean;
  /** eventIds that have been reversed (their id appears as some event's reversalOf). */
  reversedEventIds: string[];
  timeline: RunTimelineEntry[];
  postedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  reversedAt?: string;
}

/**
 * PURE — project a run's event stream to its aggregate. Input order does not matter (folds by
 * sequence). Throws if the stream is empty, spans more than one run, or is not gapless — a bad
 * projection is worse than none.
 */
export function projectRunAggregate(events: readonly PayEvent[]): RunAggregate {
  if (!Array.isArray(events) || events.length === 0) {
    throw new RangeError('projectRunAggregate: at least one event is required');
  }
  const runId = events[0].aggregateId;
  const societyId = events[0].societyId;
  for (const e of events) {
    if (e.aggregateId !== runId) throw new RangeError('projectRunAggregate: events span more than one run');
  }
  assertGaplessSequence(events, runId);

  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);

  let state: RunState = INITIAL_STATE;
  const timeline: RunTimelineEntry[] = [];
  const reversed = new Set<string>();
  let reversalCount = 0;
  const agg: Partial<RunAggregate> = {};

  for (const e of ordered) {
    state = stateAfterEvent(state, e.eventType);
    timeline.push({ sequence: e.sequence, eventType: e.eventType, state, occurredAt: e.occurredAt });
    if (isReversal(e)) {
      reversalCount++;
      if (e.reversalOf) reversed.add(e.reversalOf);
    }
    if (e.eventType === 'posted') agg.postedAt = e.occurredAt;
    else if (e.eventType === 'paid') agg.paidAt = e.occurredAt;
    else if (e.eventType === 'cancelled') agg.cancelledAt = e.occurredAt;
    else if (e.eventType === 'reversed') agg.reversedAt = e.occurredAt;
  }

  const last = ordered[ordered.length - 1];
  return {
    runId,
    societyId,
    currentState: state,
    lastSequence: last.sequence,
    eventCount: ordered.length,
    reversalCount,
    isTerminal: isTerminal(state),
    reversedEventIds: [...reversed],
    timeline,
    ...agg,
  };
}
