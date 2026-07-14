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
/** Sentinel `fy` for FY-less sequences (asset/item/employee `BOOK/SEQ`) in document_sequences, so
 *  they get one gapless per-(society, book) sequence rather than per-year. */
export const NO_FY = '-';

export interface DocNumberParts {
  /** The register/book key — the prefix, e.g. 'RCP'. Doubles as the sequence's `book`. */
  book: string;
  /** Financial year, e.g. '2025-26'. `null` for FY-less 2-part numbers (`AST/0001`). */
  fy: string | null;
  /** The current sequence value parsed from the provisional number. */
  seq: number;
  /** Zero-pad width of the SEQ segment, so a reissued number keeps the same look. */
  width: number;
}

/** PURE — split a doc number into parts. Handles `BOOK/FY/SEQ` (3-part, e.g. `RCP/2025-26/0001`)
 *  and the FY-less `BOOK/SEQ` (2-part, e.g. `AST/0001`, `ITM/001`, `EMP/001`). Returns null for
 *  anything else (including no-separator prefixes like farmer `F0001`, deliberately unsupported). */
export function parseDocNumber(no: string | undefined | null): DocNumberParts | null {
  const parts = (no ?? '').split('/');
  if (parts.length === 3) {
    const [book, fy, seqStr] = parts;
    if (!book || !fy || !/^[0-9]+$/.test(seqStr)) return null;
    return { book, fy, seq: parseInt(seqStr, 10), width: seqStr.length };
  }
  if (parts.length === 2) {
    const [book, seqStr] = parts;
    if (!book || !/^[0-9]+$/.test(seqStr)) return null;
    return { book, fy: null, seq: parseInt(seqStr, 10), width: seqStr.length };
  }
  return null;
}

/** PURE — reassemble a doc number, zero-padding SEQ to at least `width` digits. `BOOK/FY/SEQ` when
 *  fy is set, else the FY-less `BOOK/SEQ`. */
export function formatDocNumber(book: string, fy: string | null, seq: number, width: number): string {
  const s = String(Math.trunc(seq)).padStart(Math.max(0, width), '0');
  return fy ? `${book}/${fy}/${s}` : `${book}/${s}`;
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
    // FY-less 2-part numbers share one per-book sequence, keyed by the NO_FY sentinel.
    n = await rpc(societyId, parsed.book, parsed.fy ?? NO_FY);
  } catch {
    return provisional;
  }
  if (n === null || !Number.isFinite(n) || n <= 0) return provisional;
  return formatDocNumber(parsed.book, parsed.fy, n, parsed.width);
}
