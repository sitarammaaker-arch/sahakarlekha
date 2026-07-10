/**
 * NDJSON — one JSON object per line (T-24).
 *
 * PURE. No I/O.
 *
 * WHY NDJSON AND NOT ONE BIG JSON ARRAY (blueprint §5.1):
 *
 *   - streamable in and out; a writer never holds the whole table as one string
 *   - a corrupt line loses one row, not the file
 *   - row counts are verifiable by counting newlines, without parsing
 *   - it converts to CSV trivially, which is what the Migration Center needs
 *
 * EVERY LINE IS CANONICALIZED. Two backups of identical data must produce identical
 * bytes, or their sha256 digests differ and verification fails on files nobody touched.
 * Postgres does not promise column order in `select *`, and JSON.stringify preserves
 * whatever order the driver produced. Sorting keys per line is what makes the digest a
 * property of the DATA rather than of the day it was fetched.
 */
import { canonicalize } from './integrity';

export type Row = Record<string, unknown>;

export class NdjsonParseError extends Error {
  /** 1-based line number of the offending row. */
  readonly line: number;

  // Written out rather than as a TypeScript parameter property: Node's type stripping is
  // strip-only, and `constructor(public readonly line: number)` is a transform, not a type.
  // scripts/ imports these modules directly, so they must survive stripping.
  constructor(line: number, message: string) {
    super(`line ${line}: ${message}`);
    this.name = 'NdjsonParseError';
    this.line = line;
  }
}

/**
 * PURE — serialize rows, one canonical JSON object per line, with a trailing newline.
 *
 * An empty table yields an empty string, not "\n". A file of zero bytes and a file of one
 * newline hash differently, and "the table was empty" must have exactly one representation.
 */
export function toNdjson(rows: readonly Row[]): string {
  if (rows.length === 0) return '';
  return rows.map(row => canonicalize(row)).join('\n') + '\n';
}

/**
 * PURE — parse NDJSON back into rows.
 *
 * Blank lines are skipped (a trailing newline is normal). A malformed line THROWS, naming
 * the line number: a restore that silently drops row 4,132 because its JSON was truncated
 * is the failure this whole workstream exists to prevent.
 */
export function parseNdjson(text: string): Row[] {
  const rows: Row[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (e) {
      throw new NdjsonParseError(i + 1, e instanceof Error ? e.message : 'invalid JSON');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new NdjsonParseError(i + 1, 'each line must be a JSON object');
    }
    rows.push(parsed as Row);
  }

  return rows;
}

/**
 * PURE — count rows without parsing. The manifest records a row count; a verifier should
 * be able to check it against a 900 MB file without building 900 MB of objects.
 */
export function countNdjsonRows(text: string): number {
  if (text.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++;
  // A final line without its newline still counts as a row.
  if (text.charCodeAt(text.length - 1) !== 10) count++;
  return count;
}
