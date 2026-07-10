/**
 * Restore dry-run diff engine (T-31 / gap EXP-03).
 *
 * PURE and READ-ONLY. It takes the rows from an archive and a snapshot of the rows already
 * in the database, and answers one question per entity: what would a restore actually do?
 *
 * Nothing here writes. Nothing here reads a database — the caller passes both sides in.
 * That is what lets the Restore Center (T-32) show an operator exactly what is about to
 * happen BEFORE anything happens, which is the whole point of a dry run.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE FIVE OUTCOMES, AND THE ONE THAT ISN'T A NUMBER
 *
 *   insert    the archive has this row, the database does not.
 *   update    both have it, and they differ. Replace overwrites; Merge asks.
 *   skip      both have it, byte-identical. Nothing to do.
 *   conflict  both have it, they differ, and the mode does not authorise a decision.
 *   orphan    the DATABASE has a row the archive does not. Nothing inserts it, nothing
 *             updates it — but Replace mode DELETES it. An operator who is not shown this
 *             number is not being shown the restore.
 *
 * `blocked` is not a number. It is a list of reasons this entity cannot be restored at all:
 * a row with no natural key, or two rows claiming the same one. A blocked entity fails the
 * dry run rather than restoring "most of" itself.
 *
 * ABSENT IS NOT NULL, EXCEPT WHERE IT IS
 * JSON drops `undefined`, so a column the database returns as `null` and a column the
 * archive simply omits are the same fact. Treating them as different would report a
 * conflict on every row of every entity that ever gained a column. They are compared equal.
 * A field present in one side with any other value is a real difference.
 *
 * SOFT-DELETED ROWS ARE STILL ROWS (RULE 5)
 * An archived row with `isDeleted: true` is inserted, as deleted. It is not skipped. The
 * fact that a member was struck off is part of the books, and a restore that quietly
 * resurrects — or quietly forgets — that fact has changed history.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import type { EntityDescriptor } from '../export/registry.types';
import { indexByNaturalKey, describeKey, type Row } from './naturalKeys';

/** Fresh: the society is empty. Merge: keep what is there. Replace: the archive wins. */
export type RestoreMode = 'fresh' | 'merge' | 'replace';

export interface FieldDiff {
  field: string;
  /** JSON-encoded, so `1` and `"1"` are visibly different in the UI. */
  archive: string;
  current: string;
}

export interface RowConflict {
  /** Encoded natural key. Render with `describeKey`. */
  key: string;
  label: string;
  fields: FieldDiff[];
}

export interface EntityDiff {
  key: string;
  table: string;
  /** True when the archive carried no file for this entity at all. */
  absentFromArchive: boolean;
  insert: number;
  update: number;
  skip: number;
  orphan: number;
  /** Itemized. `conflicts.length === conflict count` — the UI shows every one. */
  conflicts: RowConflict[];
  /** Reasons this entity cannot be restored. Non-empty ⇒ the dry run fails. */
  blocked: string[];
}

export interface RestoreDiff {
  /** False when any entity is blocked. A restore must not proceed. */
  ok: boolean;
  mode: RestoreMode;
  entities: EntityDiff[];
  totals: { insert: number; update: number; skip: number; orphan: number; conflict: number };
  /** Every blocking reason, prefixed with its entity, so an operator sees them at once. */
  problems: string[];
}

/** How many conflicting fields to itemize per row before saying "and N more". */
const MAX_FIELDS_PER_CONFLICT = 12;

/** PURE — JSON encoding used for value comparison. Absent and null are the same fact. */
function encode(value: unknown): string {
  return value === undefined ? 'null' : JSON.stringify(value) ?? 'null';
}

/**
 * PURE — the fields on which two rows differ.
 *
 * The union of both sides' fields, so a column the archive has and the database lacks is a
 * difference, not an omission. Ordered by field name: a diff an operator has to read twice
 * because the fields moved is a diff they will stop reading.
 */
export function diffRow(archive: Row, current: Row): FieldDiff[] {
  const fields = [...new Set([...Object.keys(archive), ...Object.keys(current)])].sort();
  const out: FieldDiff[] = [];
  for (const field of fields) {
    const a = encode(archive[field]);
    const c = encode(current[field]);
    if (a !== c) out.push({ field, archive: a, current: c });
  }
  return out;
}

/**
 * PURE — diff one entity.
 *
 * `currentRows` is what the database holds for this society today. The caller reads it; this
 * function never does.
 */
export function diffEntity(
  entity: EntityDescriptor,
  archiveRows: readonly Row[] | null,
  currentRows: readonly Row[],
  mode: RestoreMode,
): EntityDiff {
  const result: EntityDiff = {
    key: entity.key,
    table: entity.table,
    absentFromArchive: archiveRows === null,
    insert: 0, update: 0, skip: 0, orphan: 0,
    conflicts: [],
    blocked: [],
  };

  const archive = archiveRows ?? [];
  const a = indexByNaturalKey(entity, archive);
  const c = indexByNaturalKey(entity, currentRows);

  // ── Blocking conditions. Checked before any counting: a blocked entity's numbers would
  //    describe a restore that is not going to happen.
  for (const row of a.keyless) {
    result.blocked.push(
      `archive row ${row.index + 1} has no natural key (missing: ${row.missing.join(', ')}) — it could not be matched, and inserting it twice is not recoverable`,
    );
  }
  for (const key of a.duplicates) {
    result.blocked.push(`the archive has two rows with the same ${entity.naturalKey.join('+')} "${describeKey(entity, key)}"`);
  }
  for (const key of c.duplicates) {
    result.blocked.push(`the database already has two rows with the same ${entity.naturalKey.join('+')} "${describeKey(entity, key)}" — the restore cannot tell which one to update`);
  }
  // Keyless rows already in the database do not block: the restore never touches them.
  // They are counted as orphans below, because Replace would delete them.

  // Fresh mode means "into an empty society". If it isn't empty, say so plainly rather
  // than quietly turning into a Merge.
  if (mode === 'fresh' && currentRows.length > 0) {
    result.blocked.push(`Fresh restore requires an empty table, but ${entity.table} already holds ${currentRows.length} row(s)`);
  }

  // ── Counting. Runs even when blocked, so the operator sees the size of what was refused.
  for (const [key, archiveRow] of a.byKey) {
    const currentRow = c.byKey.get(key);
    if (!currentRow) {
      result.insert++;
      continue;
    }
    const fields = diffRow(archiveRow, currentRow);
    if (fields.length === 0) {
      result.skip++;
      continue;
    }
    if (mode === 'replace') {
      // The archive is authoritative. There is nothing to ask.
      result.update++;
    } else {
      result.conflicts.push({
        key,
        label: describeKey(entity, key),
        fields: fields.slice(0, MAX_FIELDS_PER_CONFLICT),
      });
    }
  }

  // Rows the database has and the archive does not.
  result.orphan = currentRows.length - [...c.byKey.keys()].filter(k => a.byKey.has(k)).length;

  return result;
}

/**
 * PURE — diff a whole restore.
 *
 * `entities` is the insert plan from `planRestore` — never the raw registry. Anything the
 * plan refuses to insert (`voucher_entry`, `audit_log`) must not appear in a diff either,
 * or an operator would be shown a number of rows that is never going to be written.
 */
export function diffRestore(
  entities: readonly EntityDescriptor[],
  archiveRows: Record<string, readonly Row[] | undefined>,
  currentRows: Record<string, readonly Row[] | undefined>,
  mode: RestoreMode,
): RestoreDiff {
  const diffs = entities.map(e =>
    diffEntity(e, archiveRows[e.key] ?? null, currentRows[e.key] ?? [], mode),
  );

  const totals = diffs.reduce(
    (t, d) => ({
      insert: t.insert + d.insert,
      update: t.update + d.update,
      skip: t.skip + d.skip,
      orphan: t.orphan + d.orphan,
      conflict: t.conflict + d.conflicts.length,
    }),
    { insert: 0, update: 0, skip: 0, orphan: 0, conflict: 0 },
  );

  const problems = diffs.flatMap(d => d.blocked.map(b => `${d.key}: ${b}`));

  return { ok: problems.length === 0, mode, entities: diffs, totals, problems };
}

/** PURE — one line an operator can read before deciding. Hindi first (RULE 7). */
export function summarizeDiff(diff: RestoreDiff, hi = true): string {
  if (!diff.ok) {
    return hi
      ? `यह restore नहीं चल सकता — ${diff.problems.length} समस्याएँ।`
      : `This restore cannot run — ${diff.problems.length} problem(s).`;
  }
  const { insert, update, skip, orphan, conflict } = diff.totals;
  if (conflict > 0) {
    return hi
      ? `${conflict} पंक्तियों पर टकराव है — हर एक पर आपका निर्णय चाहिए।`
      : `${conflict} row(s) conflict — each needs your decision.`;
  }
  const deleted = diff.mode === 'replace' && orphan > 0
    ? (hi ? `, ${orphan} मिटाई जाएँगी` : `, ${orphan} deleted`)
    : '';
  return hi
    ? `${insert} नई पंक्तियाँ, ${update} बदली जाएँगी, ${skip} पहले से वैसी ही${deleted}।`
    : `${insert} inserted, ${update} updated, ${skip} unchanged${deleted}.`;
}
