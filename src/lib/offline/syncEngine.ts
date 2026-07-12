/**
 * Integrity-safe sync engine (T-33 / TASK3.6 §21; RULE 1; ADR-0001). PURE decision core.
 *
 * Drives the durable capture queue (T-32) against the server, applying the conflict policy
 * (conflict.ts) with two non-negotiable invariants:
 *
 *   • FAIL CLOSED — an entry that does not durably commit (locked period, human-needed conflict, or
 *     transport failure) is RETAINED in the local queue, never dropped (T-33 rollback).
 *   • NO SILENT DIVERGENCE — every entry present before a sync is accounted for after: it is either
 *     marked synced or still queued. Nothing vanishes and nothing double-posts (localId idempotency).
 *
 * planSync makes the decisions; applyDecisions folds them back into the queue (reusing T-32's
 * markSynced/markFailed); accountsForAll asserts the divergence invariant. The live transport (which
 * actually appends to the ledger and reports success/failure) is the wire layer. No I/O; deterministic.
 */
import { markSynced, markFailed, type QueuedEntry } from './captureQueue';
import { resolveConflict, isRetained, type ConflictOutcome, type SyncEntry, type ServerView } from './conflict';

export interface SyncDecision {
  localId: string;
  outcome: ConflictOutcome;
  /** True when the entry is (or already was) durably applied server-side — it can be marked synced. */
  committed: boolean;
  /** True when the entry stays in the local queue (retained for retry / human resolution). */
  retained: boolean;
  reason?: string;
}

/**
 * PURE — plan the sync of a batch of entries against the server view. Each entry gets exactly one
 * decision via the conflict policy; nothing is ever dropped. 'apply' and 'skip_duplicate' are
 * committed; 'reject_locked' and 'needs_human' are retained locally and surfaced.
 */
export function planSync(entries: readonly SyncEntry[], server: ServerView): SyncDecision[] {
  return entries.map((e) => {
    const outcome = resolveConflict(e, server);
    const retained = isRetained(outcome);
    return {
      localId: e.localId,
      outcome,
      committed: !retained, // 'apply' commits now, 'skip_duplicate' was already committed
      retained,
      reason: outcome === 'reject_locked'
        ? 'target FY/period is locked (RULE 6) — retained locally'
        : outcome === 'needs_human'
          ? 'concurrent change on the server — needs human resolution'
          : undefined,
    };
  });
}

/**
 * PURE — fold sync decisions back into the durable queue. A committed entry is marked synced; a
 * retained entry is marked failed WITH its reason (kept for retry / human action). An entry with no
 * decision is left untouched. Reuses T-32's queue transitions, so the "never dropped" guarantee is
 * inherited.
 */
export function applyDecisions(queue: readonly QueuedEntry[], decisions: readonly SyncDecision[]): QueuedEntry[] {
  let next = [...queue];
  for (const d of decisions) {
    if (d.committed) next = markSynced(next, d.localId);
    else if (d.retained) next = markFailed(next, d.localId, d.reason ?? 'retained');
  }
  return next;
}

/**
 * PURE — the no-silent-divergence invariant: every entry present before the sync is present after
 * (as synced or still queued). Nothing vanished. (TASK3.6 §21 / RULE 1.)
 */
export function accountsForAll(before: readonly QueuedEntry[], after: readonly QueuedEntry[]): boolean {
  if (before.length !== after.length) return false;
  const afterIds = new Set(after.map((e) => e.localId));
  return before.every((e) => afterIds.has(e.localId));
}
