/**
 * Offline field capture — durable local queue (T-32 / TASK3.6; RULE 1 offline; ADR-0001).
 *
 * PURE. A part-time secretary in a village must be able to capture field entries with NO network,
 * and lose nothing when the app restarts. This module is the SSOT for the durable queue those
 * captures sit in until sync (T-33). Its guarantees:
 *
 *   • Fail-CLOSED capture — only the initial scope (collection/receipt, TASK3.6) is accepted; a
 *     malformed or out-of-scope capture is refused at the boundary, never queued as a bad entry.
 *   • Idempotent — each entry carries a stable client-generated localId (the key the server dedupes
 *     on at sync, T-33); a re-capture of the same localId never duplicates.
 *   • Never dropped — an entry stays queued until a sync SUCCEEDS; a failed sync is retained for
 *     retry (RULE 1 extended offline; T-33's fail-closed rollback).
 *   • Survives restart — a deterministic serialize/deserialize round-trip is the contract behind
 *     durability; a corrupt store SURFACES an error rather than silently losing entries.
 *
 * The actual local-store write (IndexedDB) and the capture UI are the wire layer; times/ids are
 * injected. No I/O here; deterministic.
 */

/** The initial offline scope (TASK3.6): only field collection & receipt capture. Everything else is
 *  online-only until integrity-safe sync (T-33) is proven. */
export type CaptureKind = 'collection' | 'receipt';
const CAPTURE_KINDS: ReadonlySet<string> = new Set(['collection', 'receipt']);

export type QueueStatus = 'pending' | 'synced' | 'failed';
const QUEUE_STATUSES: ReadonlySet<string> = new Set(['pending', 'synced', 'failed']);

export interface QueuedEntry {
  /** Stable, client-generated id — the idempotency key the server dedupes on at sync (T-33). */
  localId: string;
  kind: CaptureKind;
  /** ISO capture time (injected). */
  capturedAt: string;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  /** The captured payload (opaque; validated by the capture form at the edge). */
  payload: unknown;
}

export interface CaptureInput {
  localId: string;
  kind: CaptureKind;
  capturedAt: string;
  payload: unknown;
}

export interface EnqueueResult {
  ok: boolean;
  queue?: QueuedEntry[];
  reason?: string;
}

/**
 * PURE — append a captured field entry to the durable queue. Fail-CLOSED: rejects an out-of-scope
 * kind, a missing localId/capturedAt, or a DUPLICATE localId (idempotent). The new entry starts
 * 'pending'. Returns a NEW queue (the input is not mutated).
 */
export function enqueue(queue: readonly QueuedEntry[], input: CaptureInput): EnqueueResult {
  if (typeof input.localId !== 'string' || input.localId.trim().length === 0) {
    return { ok: false, reason: 'capture needs a stable localId (idempotency key)' };
  }
  if (!CAPTURE_KINDS.has(input.kind)) {
    return { ok: false, reason: `capture kind "${input.kind}" is out of the initial offline scope (collection/receipt only)` };
  }
  if (typeof input.capturedAt !== 'string' || Number.isNaN(Date.parse(input.capturedAt))) {
    return { ok: false, reason: 'capture needs a valid capturedAt timestamp' };
  }
  if (queue.some((e) => e.localId === input.localId)) {
    // Idempotent: a re-capture of the same localId is a no-op, not a duplicate.
    return { ok: true, queue: [...queue] };
  }
  const entry: QueuedEntry = {
    localId: input.localId,
    kind: input.kind,
    capturedAt: input.capturedAt,
    status: 'pending',
    attempts: 0,
    payload: input.payload,
  };
  return { ok: true, queue: [...queue, entry] };
}

/** PURE — entries still awaiting sync: 'pending' or 'failed' (a failed entry stays queued for retry,
 *  never dropped). */
export function pendingEntries(queue: readonly QueuedEntry[]): QueuedEntry[] {
  return queue.filter((e) => e.status !== 'synced');
}

/** PURE — mark an entry synced after the server durably accepted it (T-33). No-op if unknown. */
export function markSynced(queue: readonly QueuedEntry[], localId: string): QueuedEntry[] {
  return queue.map((e) => (e.localId === localId ? { ...e, status: 'synced', lastError: undefined } : e));
}

/**
 * PURE — record a FAILED sync attempt: increments attempts, records the error, and KEEPS the entry
 * in the queue (fail closed — unsynced data is retained locally, never dropped).
 */
export function markFailed(queue: readonly QueuedEntry[], localId: string, error: string): QueuedEntry[] {
  return queue.map((e) => (e.localId === localId ? { ...e, status: 'failed', attempts: e.attempts + 1, lastError: error } : e));
}

/** PURE — serialize the queue for the durable store. Deterministic, so a restart round-trips exactly. */
export function serializeQueue(queue: readonly QueuedEntry[]): string {
  return JSON.stringify(queue);
}

export type DeserializeResult =
  | { ok: true; queue: QueuedEntry[] }
  | { ok: false; reason: string };

/**
 * PURE — reconstruct the queue from the durable store. A valid blob round-trips 1:1. A blob that is
 * unparseable, not an array, or contains a malformed entry is REFUSED (ok:false) — never silently
 * coerced to an empty or partial queue, so a corruption surfaces instead of losing field work
 * (RULE 1). The caller decides how to recover.
 */
export function deserializeQueue(raw: string): DeserializeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'durable queue is not valid JSON — refusing to drop field captures' };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: 'durable queue is not an array' };
  for (let i = 0; i < parsed.length; i++) {
    const e = parsed[i] as Partial<QueuedEntry>;
    if (!e || typeof e.localId !== 'string' || !CAPTURE_KINDS.has(e.kind as string) ||
        !QUEUE_STATUSES.has(e.status as string) || typeof e.capturedAt !== 'string' ||
        !Number.isInteger(e.attempts)) {
      return { ok: false, reason: `durable queue entry ${i} is malformed — refusing to load a corrupt queue` };
    }
  }
  return { ok: true, queue: parsed as QueuedEntry[] };
}
