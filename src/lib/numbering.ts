/**
 * Document-number parse/format for the server-authoritative numbering authority
 * (T-03 / ADR-0005). PURE — no DB, no clock.
 *
 * An official number is `BOOK/FY/SEQ` — e.g. `RCP/2025-26/0001`. The server sequence
 * `next_document_number(society, book, fy)` atomically issues the SEQ (gapless, collision-
 * free); these helpers split a client-provisional number into its (book, fy, width) and
 * reassemble it with the server-issued SEQ, preserving the original zero-pad width. Keeping
 * this out of DataContext makes the one place numbers are shaped testable without Supabase.
 */
export interface DocNumberParts {
  /** The register/book key — the prefix, e.g. 'RCP'. Doubles as the sequence's `book`. */
  book: string;
  /** Financial year, e.g. '2025-26'. */
  fy: string;
  /** The current sequence value parsed from the provisional number. */
  seq: number;
  /** Zero-pad width of the SEQ segment, so a reissued number keeps the same look. */
  width: number;
}

/** PURE — split `BOOK/FY/SEQ` into parts. Returns null for anything not in that exact shape. */
export function parseDocNumber(no: string | undefined | null): DocNumberParts | null {
  const parts = (no ?? '').split('/');
  if (parts.length !== 3) return null;
  const [book, fy, seqStr] = parts;
  if (!book || !fy || !/^[0-9]+$/.test(seqStr)) return null;
  return { book, fy, seq: parseInt(seqStr, 10), width: seqStr.length };
}

/** PURE — reassemble `BOOK/FY/SEQ`, zero-padding SEQ to at least `width` digits. */
export function formatDocNumber(book: string, fy: string, seq: number, width: number): string {
  return `${book}/${fy}/${String(Math.trunc(seq)).padStart(Math.max(0, width), '0')}`;
}

/** The server sequence, injected: returns the next number for (society, book, fy), or null on
 *  failure. Injecting it keeps issueOfficialNumber testable without Supabase and reusable
 *  across voucher / sale / purchase (T-03 / ADR-0005). */
export type DocSeqRpc = (societyId: string, book: string, fy: string) => Promise<number | null>;

/**
 * Issue the OFFICIAL number for a client-provisional `BOOK/FY/SEQ`, taking the SEQ from the
 * server sequence. The ONE numbering rule every save path shares. Returns the provisional
 * number UNCHANGED when it isn't well-formed, or when the rpc throws / fails / returns a
 * non-positive number — the offline/error fallback, with the caller's unique-index
 * collision-retry as the safety net (so it's correct even before the sequences are seeded).
 */
export async function issueOfficialNumber(
  rpc: DocSeqRpc,
  societyId: string,
  provisional: string | undefined,
): Promise<string | undefined> {
  const parsed = parseDocNumber(provisional);
  if (!parsed) return provisional;
  let n: number | null;
  try {
    n = await rpc(societyId, parsed.book, parsed.fy);
  } catch {
    return provisional;
  }
  if (n === null || !Number.isFinite(n) || n <= 0) return provisional;
  return formatDocNumber(parsed.book, parsed.fy, n, parsed.width);
}
