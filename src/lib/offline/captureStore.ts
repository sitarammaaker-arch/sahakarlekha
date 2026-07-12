/**
 * Durable persistence for the offline capture queue (T-32 wiring — the durable local-store half).
 *
 * The pure captureQueue module (captureQueue.ts) owns the model and the serialize/deserialize
 * CONTRACT; this thin adapter is its durable medium — the browser's localStorage, the same store
 * the rest of the app persists to (storage.ts). It adds no new model and changes no existing
 * behavior: load on startup, save after each mutation, so a field secretary's captures survive an
 * app restart.
 *
 * It honors the pure "corruption surfaces" guarantee (RULE 1): a durable store that cannot be parsed
 * is REPORTED (corrupt: true), never silently coerced to an empty queue that would hide lost work.
 * The Storage handle is injectable so the persistence is unit-testable without a browser; it
 * defaults to localStorage in the app.
 */
import { serializeQueue, deserializeQueue, type QueuedEntry } from './captureQueue';

/** localStorage key for the durable capture queue — follows the app's `sahayata_` convention. */
export const CAPTURE_QUEUE_KEY = 'sahayata_capture_queue';

export interface LoadResult {
  queue: QueuedEntry[];
  /** True when the store held data that could not be parsed — surfaced so the caller can alert the
   *  user rather than silently lose field captures. */
  corrupt: boolean;
}

/**
 * Load the durable capture queue. A missing store yields an empty queue; an unparseable/malformed
 * store yields an empty queue WITH `corrupt: true` (the pure deserialize refuses to drop entries
 * silently). If localStorage itself is inaccessible (private mode), returns empty without flagging
 * corruption — there is simply nothing persisted.
 */
export function loadCaptureQueue(store: Storage = localStorage): LoadResult {
  let raw: string | null;
  try {
    raw = store.getItem(CAPTURE_QUEUE_KEY);
  } catch {
    return { queue: [], corrupt: false };
  }
  if (raw == null) return { queue: [], corrupt: false };
  const res = deserializeQueue(raw);
  return res.ok ? { queue: res.queue, corrupt: false } : { queue: [], corrupt: true };
}

/**
 * Persist the capture queue durably (survives app restart), via the pure serializer. A storage
 * failure (quota / private mode) is swallowed — the in-memory queue remains authoritative for the
 * session and the next successful save catches up; it is never a reason to lose the in-memory data.
 */
export function saveCaptureQueue(queue: readonly QueuedEntry[], store: Storage = localStorage): void {
  try {
    store.setItem(CAPTURE_QUEUE_KEY, serializeQueue(queue));
  } catch {
    /* quota exceeded / storage unavailable — in-memory queue stays authoritative this session */
  }
}
