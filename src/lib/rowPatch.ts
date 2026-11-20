/**
 * ARCH-04 (product audit 2026-11-17) — an edit sends ONLY the columns it changed.
 *
 * Every update* path used to rebuild the whole row from the snapshot this tab loaded at login and upsert it. A tab
 * open since morning, fixing a phone number, wrote back its stale copy of every other column — undoing another
 * user's newer share capital, loan amount, wage or account parent. Now the write is an UPDATE of the changed columns
 * only, so a column this edit did not touch is never sent and cannot be overwritten.
 *
 * changedColumns(before, next): every key of `next` (the row the old upsert would have sent) whose value differs
 * from before[key] — so the patch is never MORE than the old upsert, and never misses a change. `id` / `society_id`
 * are never sent. An `undefined` value is left out exactly as JSON left it out of the upsert (a caller that must
 * CLEAR a column sends null / false explicitly, as updateAccount does).
 *
 * patchRow(): the write. Nothing changed → no request. `.select('id')` turns "0 rows updated" (row gone, or RLS
 * refused) into an error, so the caller's RULE-1 rollback + toast runs instead of a silent no-op success.
 */
import { supabase } from '@/lib/supabase';

const NEVER_SENT = new Set(['id', 'society_id']);

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The columns of `next` that differ from `before` (PURE). */
export function changedColumns(before: object | null | undefined, next: object): Record<string, unknown> {
  const prev = (before ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next as Record<string, unknown>)) {
    if (NEVER_SENT.has(k) || v === undefined) continue;
    if (!same(v, prev[k])) patch[k] = v;
  }
  return patch;
}

export type PatchResult = { error: { message: string; code?: string; details?: string } | null };

export const ROW_NOT_UPDATED = 'क्लाउड पर यह रिकॉर्ड नहीं मिला या इसे बदलने की अनुमति नहीं है (row not found or not permitted)';

/** UPDATE `table` set <changed columns> where id = `id`; resolves like the old upsert's `{ error }`. */
export function patchRow(table: string, id: string, before: object | null | undefined, next: object): PromiseLike<PatchResult> {
  const patch = changedColumns(before, next);
  if (Object.keys(patch).length === 0) return Promise.resolve({ error: null });
  return supabase.from(table).update(patch).eq('id', id).select('id').then(({ data, error }) => ({
    error: error ?? (!data?.length ? { message: ROW_NOT_UPDATED } : null),
  }));
}
