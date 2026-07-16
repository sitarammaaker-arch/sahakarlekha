/**
 * Authoritative event append — the primitive at the heart of journal-first writes (T-09
 * acceptance, slice 3).
 *
 * Today a voucher's save is authoritative when the `vouchers` TABLE row is confirmed; the ledger
 * event is a best-effort SHADOW appended afterwards. Journal-first INVERTS this: a durable,
 * VERIFIED append to the append-only journal IS the save; the table becomes a rebuildable
 * projection (slice 2). This function is that inversion's core — it appends the event and confirms
 * it actually persisted (insert alone can return no error yet write no row under an RLS/cache edge,
 * exactly as persistVoucher's verify-read guards the table today).
 *
 * PURE + INJECTABLE (no supabase import) so it is unit-tested in isolation: the caller passes an
 * `insert` and a `verify` that hit the real ledger_events table. Returns a definite ok/fail — the
 * caller rolls back the optimistic UI on `!ok` (a failed save the user must SEE, RULE 1), and on
 * `ok` treats the write as durable regardless of whether the downstream table projection succeeds.
 *
 * NOT wired into any live path yet (dormant): the addVoucher inversion (numbering-first ordering,
 * table best-effort) is slice 4, and the per-tenant flip stays behind the T-09 soak (R3).
 */
import type { LedgerEvent } from './event';

export interface AuthoritativeAppendIO {
  /** Durably insert the event row. Resolve `{ error }` (null on success) — never throw. */
  insert: (event: LedgerEvent) => Promise<{ error: string | null }>;
  /** Read the row back by eventId to confirm it persisted. `found=false` ⇒ the insert did not stick. */
  verify: (eventId: string) => Promise<{ found: boolean; error: string | null }>;
  /**
   * Durably insert MANY event rows in ONE atomic statement (all rows or none) — required for a
   * multi-event append (an edit journals a reverse+repost PAIR). Resolve `{ error }`, never throw.
   * Only needed by persistEventsAuthoritative when appending ≥2 events; single appends never call it.
   */
  insertMany?: (events: LedgerEvent[]) => Promise<{ error: string | null }>;
}

export interface AppendResult {
  ok: boolean;
  /** present only when ok=false — the message to surface to the operator. */
  error?: string;
}

/**
 * PURE — append `event` authoritatively: insert, then verify it persisted. `ok:true` only when the
 * row is confirmed durable. Any insert error, verify error, or missing-row verify ⇒ `ok:false` with
 * the reason (so the caller can roll back the optimistic write and show a destructive toast).
 */
export async function persistEventAuthoritative(event: LedgerEvent, io: AuthoritativeAppendIO): Promise<AppendResult> {
  let ins: { error: string | null };
  try {
    ins = await io.insert(event);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (ins.error) return { ok: false, error: ins.error };

  let ver: { found: boolean; error: string | null };
  try {
    ver = await io.verify(event.eventId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (ver.error) return { ok: false, error: ver.error };
  if (!ver.found) return { ok: false, error: 'event not found after insert — the append did not persist' };
  return { ok: true };
}

/**
 * PURE — append MANY events authoritatively as one unit. An edit journals a reverse+repost PAIR; a
 * WORM log cannot un-append, so a half-written pair (reversal stuck, repost lost) is a permanent
 * parity break. This inserts the whole batch in ONE atomic statement, then verifies EVERY row stuck
 * — `ok:true` only when all are confirmed durable, so the caller treats the edit as saved or rolls
 * the whole thing back (RULE 1), never half.
 *
 *   • 0 events  → ok:true (a postings-neutral edit appends nothing — vacuously durable);
 *   • 1 event   → delegates to persistEventAuthoritative (no batch IO needed);
 *   • ≥2 events → requires io.insertMany (atomic); any insert error, verify error, or a single
 *                 missing row ⇒ ok:false with the reason.
 */
export async function persistEventsAuthoritative(events: LedgerEvent[], io: AuthoritativeAppendIO): Promise<AppendResult> {
  if (events.length === 0) return { ok: true };
  if (events.length === 1) return persistEventAuthoritative(events[0], io);
  if (!io.insertMany) return { ok: false, error: 'multi-event append requires an insertMany IO' };

  let ins: { error: string | null };
  try {
    ins = await io.insertMany(events);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (ins.error) return { ok: false, error: ins.error };

  // Verify EVERY event stuck — an atomic insert is all-or-nothing, but the same RLS/cache edge that
  // can drop a single row can drop the batch, so confirm each before calling the edit saved.
  for (const ev of events) {
    let ver: { found: boolean; error: string | null };
    try {
      ver = await io.verify(ev.eventId);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (ver.error) return { ok: false, error: ver.error };
    if (!ver.found) return { ok: false, error: `event ${ev.eventId} not found after batch insert — the append did not persist` };
  }
  return { ok: true };
}
