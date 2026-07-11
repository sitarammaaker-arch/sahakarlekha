/**
 * Document numbering — the canonical format + the server-authority seam (T-03 / ADR-0005,
 * gap CA-03).
 *
 * PURE (the format) + injectable (the issuer). Statutory audit requires GAPLESS,
 * non-duplicated sequential numbers. Client-side numbering from in-memory / localStorage
 * state gaps and collides across devices (the collision-retry in DataContext is the scar).
 * The fix: numbers are issued by a single server authority — an atomic DB sequence
 * (next_document_number in supabase-tables.sql) — and formatted HERE, the one place the
 * number's shape is defined.
 *
 * FORMAT — `PREFIX/YYYY/YY/NNN`, e.g. `RV/2025/26/001`. Identical to the legacy
 * storage.getNextVoucherNo output, so a server-issued number is a drop-in replacement (the
 * cutover, which assigns the number at durable append, pairs with the event ledger, T-06).
 */

export interface DocumentNumberParts {
  /** Book/register prefix, e.g. 'RV' (receipt), 'PV' (payment), 'JV' (journal). */
  prefix: string;
  /** Financial year, e.g. '2025-26'. */
  fy: string;
  /** The monotonic sequence number within (book, fy). */
  seq: number;
}

/**
 * PURE — compose the canonical document number. `fy` is the '2025-26' form; the '-' becomes
 * a '/' in the number (matching the legacy format). `seq` is zero-padded to at least 3.
 */
export function composeDocumentNumber(prefix: string, fy: string, seq: number): string {
  if (!prefix) throw new RangeError('document number: prefix is required');
  if (!Number.isInteger(seq) || seq < 1) {
    throw new RangeError(`document number: seq must be a positive integer, got ${seq}`);
  }
  return `${prefix}/${fy.replace('-', '/')}/${String(seq).padStart(3, '0')}`;
}

/** PURE — parse a document number back into parts, or null if it does not match the format. */
export function parseDocumentNumber(no: string): DocumentNumberParts | null {
  if (typeof no !== 'string') return null;
  const m = /^([^/]+)\/(\d{4})\/(\d{2})\/(\d+)$/.exec(no.trim());
  if (!m) return null;
  return { prefix: m[1], fy: `${m[2]}-${m[3]}`, seq: parseInt(m[4], 10) };
}

/**
 * The server sequence authority: given (society, book, fy) it returns the next monotonic
 * number, atomically and gaplessly. Injected so this module owns the FORMAT, not the
 * transport — the real implementation calls the `next_document_number` RPC; a test passes a
 * fake. This is the seam the client-side counter is replaced by (cutover pairs with T-06).
 */
export type SequenceIssuer = (societyId: string, book: string, fy: string) => Promise<number>;

/**
 * Issue the next official document number from the server authority and format it. Throws if
 * the authority returns an invalid number rather than composing a wrong one — a bad number
 * of record is worse than a failed save the user can retry.
 */
export async function issueDocumentNumber(
  issue: SequenceIssuer,
  args: { prefix: string; book: string; societyId: string; fy: string },
): Promise<string> {
  const seq = await issue(args.societyId, args.book, args.fy);
  if (!Number.isInteger(seq) || seq < 1) {
    throw new RangeError(`the sequence authority returned an invalid number: ${seq}`);
  }
  return composeDocumentNumber(args.prefix, args.fy, seq);
}
