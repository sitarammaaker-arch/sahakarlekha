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
