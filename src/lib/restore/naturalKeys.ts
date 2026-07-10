/**
 * Natural-key indexing for restore (T-31 / gap EXP-03).
 *
 * PURE. Given an entity and some rows, produce the key each row matches on.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY A ROW WITHOUT A KEY MUST STOP THE RESTORE
 *
 * The natural key is how a merge-restore decides "this archived row and that live row are
 * the same row". If a row's key is null, it matches nothing — so a naive restore inserts
 * it. Run the restore twice and you have inserted it twice. Run it after a partial failure
 * and you have inserted it twice. Duplicate members, duplicate vouchers, a Trial Balance
 * that no longer ties.
 *
 * There is no safe default here. Inserting is wrong (duplicates), skipping is wrong (silent
 * data loss). So a keyless row is neither: it BLOCKS its entity, and a human is told which
 * row and which field. Fail closed.
 *
 * NO NORMALISATION. `'ABC '` and `'ABC'` are different keys. Trimming would silently merge
 * two rows a human deliberately kept apart; not trimming, at worst, reports a conflict the
 * human can see. Only one of those two failures is recoverable.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import type { EntityDescriptor } from '../export/registry.types';

/** A row as it travels in the archive: whatever `select('*')` returned, JSON round-tripped. */
export type Row = Record<string, unknown>;

/** Why a row could not be given a key. */
export interface KeylessRow {
  /** Zero-based position in the source array, so a human can find the line in the NDJSON. */
  index: number;
  /** The naturalKey fields that were null, undefined or empty. */
  missing: string[];
}

export interface KeyIndex {
  /** key → row. Only rows with a complete key. */
  byKey: Map<string, Row>;
  /** Keys that appeared more than once. Ambiguous: the same key cannot name two rows. */
  duplicates: string[];
  /** Rows that have no usable key at all. */
  keyless: KeylessRow[];
}

/**
 * PURE — the composite key for one row, or null when any component is missing.
 *
 * Encoded as a JSON array of strings rather than joined with a separator: `['a:b']` and
 * `['a', 'b']` must not collide, and no separator character is safe against Devanagari
 * names, account codes and free-text document numbers.
 */
export function keyOf(entity: EntityDescriptor, row: Row): string | null {
  const parts: string[] = [];
  for (const field of entity.naturalKey) {
    const value = row[field];
    if (value === null || value === undefined || value === '') return null;
    parts.push(String(value));
  }
  // An entity with no naturalKey cannot be merged at all. validateRegistry already refuses
  // to let one exist; this is the belt to that braces.
  if (parts.length === 0) return null;
  return JSON.stringify(parts);
}

/** PURE — the naturalKey fields that are missing from a row. Empty when the key is complete. */
export function missingKeyFields(entity: EntityDescriptor, row: Row): string[] {
  if (entity.naturalKey.length === 0) return ['(entity declares no naturalKey)'];
  return entity.naturalKey.filter(f => {
    const v = row[f];
    return v === null || v === undefined || v === '';
  });
}

/**
 * PURE — index rows by natural key, reporting every ambiguity rather than the first.
 *
 * A duplicate key is not "last one wins". Two archived rows sharing a key means the archive
 * cannot say which live row each corresponds to, and picking one silently would overwrite
 * real data with a coin flip.
 */
export function indexByNaturalKey(entity: EntityDescriptor, rows: readonly Row[]): KeyIndex {
  const byKey = new Map<string, Row>();
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const keyless: KeylessRow[] = [];

  rows.forEach((row, index) => {
    const key = keyOf(entity, row);
    if (key === null) {
      keyless.push({ index, missing: missingKeyFields(entity, row) });
      return;
    }
    if (seen.has(key)) {
      if (!duplicates.includes(key)) duplicates.push(key);
      return;                     // the first row stays; the plan is blocked anyway
    }
    seen.add(key);
    byKey.set(key, row);
  });

  return { byKey, duplicates, keyless };
}

/** PURE — a human-readable rendering of an encoded key, for conflict lists and toasts. */
export function describeKey(entity: EntityDescriptor, key: string): string {
  let parts: string[];
  try {
    parts = JSON.parse(key);
  } catch {
    return key;
  }
  if (entity.naturalKey.length === 1) return parts[0];
  return entity.naturalKey.map((f, i) => `${f}=${parts[i]}`).join(', ');
}
