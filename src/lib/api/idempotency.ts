/**
 * API idempotency (T-24 / API Constitution API-P9, IE-2; ADR-0006 exactly-once).
 *
 * PURE. Every mutating API call carries an IDEMPOTENCY KEY; retries, replays, and network failures
 * must never double-post — financial operations are effectively exactly-once. This module is the
 * SSOT for the decision the write path takes BEFORE applying an effect, given the record of
 * already-seen keys:
 *
 *   new       — the key is unseen → proceed, apply the effect, then record it.
 *   replay    — the key was seen with the SAME request → return the recorded result, apply nothing.
 *   conflict  — the key was reused with a DIFFERENT request, or is missing → refuse; never a second
 *               effect (a reused key must mean the same operation, IE-4 no silent partial effect).
 *
 * The request FINGERPRINT is supplied by the caller (a canonical hash of the request) — this module
 * only compares it, so it computes no hash and does no I/O. Deterministic; holds no state.
 */

export interface IdempotencyRecord {
  key: string;
  /** A canonical fingerprint of the original request — same key must mean the same request. */
  requestFingerprint: string;
  /** The recorded outcome to replay on a retry. */
  result: unknown;
}

export type IdempotencyOutcome =
  | { status: 'new' }
  | { status: 'replay'; result: unknown }
  | { status: 'conflict'; reason: string };

/**
 * PURE — how must a mutating call with this idempotency key be handled, against the seen-key
 * record? A missing key on a mutating call is itself a conflict (API-P9 requires one). A reused
 * key with a different request is refused — retries are safe, key-reuse for a new effect is not.
 */
export function checkIdempotency(
  key: string,
  requestFingerprint: string,
  seen: ReadonlyMap<string, IdempotencyRecord>,
): IdempotencyOutcome {
  if (!key) return { status: 'conflict', reason: 'a mutating call must carry an idempotency key (API-P9)' };
  const prior = seen.get(key);
  if (!prior) return { status: 'new' };
  if (prior.requestFingerprint !== requestFingerprint) {
    return { status: 'conflict', reason: 'idempotency key reused with a different request' };
  }
  return { status: 'replay', result: prior.result };
}

/**
 * PURE — the record to persist after a successful NEW mutation, so a later retry of the same key
 * replays this result instead of posting again. The caller writes it transactionally with the
 * effect (the same-transaction guarantee is the wire layer's job; the shape is fixed here).
 */
export function recordIdempotency(key: string, requestFingerprint: string, result: unknown): IdempotencyRecord {
  return { key, requestFingerprint, result };
}
