/**
 * Server-side document numbering support (Feature 6).
 *
 * Document numbers (SL/PUR/SRET/PRET/voucher) are minted client-side (max+1) for
 * a fast, offline-capable, optimistic-first flow. A per-society UNIQUE index on the
 * number is the authoritative guard: two tills can never persist the same number —
 * the second upsert fails with Postgres error 23505. The client detects that here,
 * bumps to the next number, restamps local state, and retries.
 */
export const MAX_RENUMBER_RETRIES = 5;

/** True when a Supabase error is a unique-constraint (duplicate key) violation. */
export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const m = (error.message || '').toLowerCase();
  return m.includes('duplicate key value') || m.includes('unique constraint') || m.includes('already exists');
}

/**
 * ECR-17 Phase 5: `branchId` rides in the step-1 base upsert — the branch-scoped RLS
 * SELECT policies (migration 039) need it on the row from birth, or a branch-restricted
 * user's own fresh row is invisible to its verify-read. True when the failure is
 * PostgREST's stale-schema-cache "column not found" for exactly that column; the caller
 * retries once without it, so the base save NEVER fails because of the branch column
 * (RULE 1: the base upsert must always succeed on a pre-migration database).
 */
export function isMissingBranchColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const m = error.message || '';
  if (!m.includes('branchId')) return false;
  return error.code === 'PGRST204' || /schema cache|could not find/i.test(m);
}

/**
 * PostgREST rejects an ENTIRE .update() when one column is absent from its schema
 * cache (a pre-migration database) — it writes NONE of the others and returns PGRST204
 * "Could not find the 'X' column of 'T' in the schema cache". Our step-2 "extras" update
 * bundles many columns at once (GST/TDS/TCS/customerId/…), so a single un-migrated column
 * silently dropped EVERY extra. That is how, for months, purchases across societies saved
 * their base row but lost all GST — and only a console.warn nobody read was written.
 *
 * Given the failing error and the payload we tried to write, this returns the payload
 * MINUS the one offending column, so the caller can retry and still land every column that
 * DOES exist. Loop it (a DB may lack several columns); each call strictly shrinks the
 * payload, so it terminates. Returns null when the error is NOT a missing-column error, or
 * the column name can't be parsed, or it isn't in the payload — the caller then stops and
 * surfaces the failure instead of looping.
 *
 * SAFETY: this never adds a key and never removes a key not named by the server, so it can
 * only ever cause MORE of the intended columns to be written to an already-saved row — it
 * cannot corrupt or drop good data. On a fully-migrated DB the first update succeeds and
 * this is never called.
 */
export function payloadWithoutMissingColumn<T extends Record<string, unknown>>(
  error: { code?: string; message?: string } | null | undefined,
  payload: T,
): T | null {
  if (!error) return null;
  const msg = error.message || '';
  const isMissingCol = error.code === 'PGRST204' || /schema cache|could not find/i.test(msg);
  if (!isMissingCol) return null;
  const col = msg.match(/'([^']+)' column/)?.[1] ?? msg.match(/column ['"]?([A-Za-z0-9_]+)['"]?/)?.[1];
  if (!col || !Object.prototype.hasOwnProperty.call(payload, col)) return null;
  const { [col]: _dropped, ...rest } = payload;
  return rest as T;
}

/**
 * Next sequence number for a `PREFIX/<fy>/<NNN>` document series, from the rows
 * already known locally. Mirrors the inline max+1 used across the save paths so
 * a renumber-retry lands on a fresh candidate.
 */
export function nextDocSeq(existingNumbers: (string | undefined)[], fy: string): number {
  let max = 0;
  for (const no of existingNumbers) {
    if (!no || !no.includes(fy)) continue;
    const m = no.match(/\/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}
