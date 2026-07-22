/**
 * Payroll run state machine (Phase-5 §8). PURE — no I/O, no clock, no randomness.
 *
 * The run lifecycle:
 *   draft → verified → approved → locked → posted → paid
 * with two off-ramps:
 *   · cancelled    — pre-post only (no GL effect)
 *   · rolled_back  — post-post correction (append-only reversal; original retained)
 * and "reject" sending a run back one step (verified→draft, approved→verified).
 *
 * This module owns ONLY the legal *shape* of transitions and the event→state mapping
 * (Phase-4 `pay_event_type`). The governance/SoD/approval-matrix and FY/period-lock guards
 * that decide *whether a caller may* perform a transition live in the governance engine
 * (Phase-12) — not here. Keeping this pure makes the lifecycle deterministic and testable
 * without a database.
 */

export type RunState =
  | 'draft'
  | 'verified'
  | 'approved'
  | 'locked'
  | 'posted'
  | 'paid'
  | 'cancelled'
  | 'rolled_back';

export type PayEventType =
  | 'initiated'
  | 'calculated'
  | 'verified'
  | 'approved'
  | 'locked'
  | 'posted'
  | 'paid'
  | 'reversed'
  | 'cancelled';

/** Runtime list of every PayEventType (for validation; mirrors the type + Phase-4 enum). */
export const PAY_EVENT_TYPES: readonly PayEventType[] = [
  'initiated', 'calculated', 'verified', 'approved', 'locked', 'posted', 'paid', 'reversed', 'cancelled',
];

/** Legal transitions per state. `cancelled`/`rolled_back` are terminal (no outgoing edges). */
const ALLOWED: Readonly<Record<RunState, readonly RunState[]>> = {
  draft: ['verified', 'cancelled'],
  verified: ['approved', 'draft', 'cancelled'], // reject → draft
  approved: ['locked', 'verified', 'cancelled'], // reject → verified
  locked: ['posted'],
  posted: ['paid', 'rolled_back'],
  paid: ['rolled_back'],
  cancelled: [],
  rolled_back: [],
};

export const RUN_STATES: readonly RunState[] = Object.keys(ALLOWED) as RunState[];
export const TERMINAL_STATES: readonly RunState[] = ['cancelled', 'rolled_back'];
export const INITIAL_STATE: RunState = 'draft';

/** Is `to` a legal next state from `from`? */
export function canTransition(from: RunState, to: RunState): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

/** Throw on an illegal transition (the guard the run orchestrator asserts before applying). */
export function assertTransition(from: RunState, to: RunState): void {
  if (!canTransition(from, to)) {
    throw new Error(`PAY-RUN-STATE: illegal transition ${from} → ${to}`);
  }
}

export function isTerminal(state: RunState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * The run state a lifecycle event drives to (Phase-4 `pay_event_type`). `calculated` is
 * within-draft work and does NOT move the lifecycle, so it maps to nothing (a no-op event).
 */
const EVENT_TO_STATE: Readonly<Partial<Record<PayEventType, RunState>>> = {
  initiated: 'draft',
  verified: 'verified',
  approved: 'approved',
  locked: 'locked',
  posted: 'posted',
  paid: 'paid',
  cancelled: 'cancelled',
  reversed: 'rolled_back',
};

/**
 * Fold one lifecycle event onto the current state. Returns the new state.
 * - `calculated` (and any non-lifecycle event) → unchanged.
 * - re-applying an event that targets the current state → unchanged (idempotent replay).
 * - otherwise the transition must be legal, else it throws (append-only journals should
 *   never contain an illegal lifecycle sequence).
 */
export function stateAfterEvent(current: RunState, event: PayEventType): RunState {
  const target = EVENT_TO_STATE[event];
  if (target === undefined) return current; // e.g. 'calculated'
  if (current === target) return current; // idempotent
  assertTransition(current, target);
  return target;
}

/** Replay an ordered event stream to the run's current state (starting from `draft`). */
export function replayRunState(events: readonly PayEventType[], from: RunState = INITIAL_STATE): RunState {
  return events.reduce<RunState>((state, ev) => stateAfterEvent(state, ev), from);
}
