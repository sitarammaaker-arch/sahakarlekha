/**
 * Sync conflict policy — no silent divergence (T-33 / TASK3.6 §21; RULE 1, RULE 6; CL-2).
 *
 * PURE. When an offline capture reaches the server, it must reconcile with current server state
 * WITHOUT ever silently diverging or dropping data (TASK3.6 §21, RULE 1). Because the system of
 * record is an append-only event ledger (T-06), most captures are independent APPENDS with no true
 * conflict. This module classifies each entry into one of four outcomes — and crucially, NONE of
 * them discards data:
 *
 *   apply          — a new, independent fact — append it (the common case).
 *   skip_duplicate — already durably applied (idempotent by localId) — a replay, not a second
 *                    effect (API-P9 / T-32 localId).
 *   reject_locked  — the target FY/period is now locked (RULE 6) — the entry is REJECTED but
 *                    RETAINED locally and surfaced; never forced into a locked period.
 *   needs_human    — an optimistic-concurrency conflict (the offline edit was made against a stale
 *                    base) — NOT clobbered by last-write-wins; a human resolves; the entry is
 *                    retained.
 *
 * No I/O; deterministic.
 */

export type ConflictOutcome = 'apply' | 'skip_duplicate' | 'reject_locked' | 'needs_human';

export interface SyncEntry {
  localId: string;
  kind: 'collection' | 'receipt';
  /** True if the FY/period this entry posts into is now locked (RULE 6). */
  targetPeriodLocked?: boolean;
  /** For an edit to an existing aggregate: the server version the offline edit was based on. */
  baseVersion?: number;
}

export interface ServerView {
  /** localIds already durably applied server-side — the idempotency set. */
  syncedLocalIds: ReadonlySet<string>;
  /** The current server version of the targeted aggregate (for optimistic concurrency). */
  currentVersion?: number;
}

/**
 * PURE — resolve how an offline entry meets current server state. The order matters: an already-
 * applied entry is a replay first (idempotent); a locked period is refused before any version
 * check; a stale-base edit needs a human; otherwise it applies. NEVER returns "drop" — every path
 * either commits or retains the entry (no silent divergence).
 */
export function resolveConflict(entry: SyncEntry, server: ServerView): ConflictOutcome {
  if (server.syncedLocalIds.has(entry.localId)) return 'skip_duplicate';
  if (entry.targetPeriodLocked) return 'reject_locked';
  if (
    entry.baseVersion != null &&
    server.currentVersion != null &&
    entry.baseVersion !== server.currentVersion
  ) {
    return 'needs_human';
  }
  return 'apply';
}

/** PURE — does this outcome keep the entry in the local queue (retained for retry/human), rather
 *  than resolve it? reject_locked and needs_human are retained; apply/skip_duplicate are resolved. */
export function isRetained(outcome: ConflictOutcome): boolean {
  return outcome === 'reject_locked' || outcome === 'needs_human';
}
